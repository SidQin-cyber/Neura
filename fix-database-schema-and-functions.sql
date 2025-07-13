-- 完整的数据库修复脚本
-- 修复缺失的字段和函数

-- 1. 添加缺失的字段
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS has_embedding TEXT DEFAULT 'NO';

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS has_embedding TEXT DEFAULT 'NO';

-- 2. 更新现有记录的has_embedding字段
UPDATE resumes 
SET has_embedding = CASE 
  WHEN embedding IS NOT NULL THEN 'YES' 
  ELSE 'NO' 
END;

UPDATE jobs 
SET has_embedding = CASE 
  WHEN embedding IS NOT NULL THEN 'YES' 
  ELSE 'NO' 
END;

-- 3. 确保vector扩展已安装
CREATE EXTENSION IF NOT EXISTS vector;

-- 4. 创建候选人搜索函数
CREATE OR REPLACE FUNCTION search_candidates_rpc(
  query_embedding TEXT,
  similarity_threshold FLOAT DEFAULT 0.0,
  match_count INT DEFAULT 10,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min INT DEFAULT NULL,
  salary_max INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  current_title TEXT,
  current_company TEXT,
  location TEXT,
  years_of_experience INT,
  expected_salary_min INT,
  expected_salary_max INT,
  skills TEXT[],
  education JSONB,
  experience JSONB,
  certifications JSONB,
  languages JSONB,
  status TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec VECTOR(1536);
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.email,
    r.phone,
    r.current_title,
    r.current_company,
    r.location,
    r.years_of_experience,
    r.expected_salary_min,
    r.expected_salary_max,
    r.skills,
    r.education,
    r.experience,
    r.certifications,
    r.languages,
    r.status,
    (1 - (r.embedding <=> query_vec)) as similarity
  FROM resumes r
  WHERE 
    r.status = status_filter
    -- 修复：允许NULL owner_id的记录被搜索到
    AND (user_id IS NULL OR r.owner_id IS NULL OR r.owner_id = user_id)
    AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR r.skills && skills_filter)
    AND (1 - (r.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY r.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 5. 创建职位搜索函数
CREATE OR REPLACE FUNCTION search_jobs_rpc(
  query_embedding TEXT,
  similarity_threshold FLOAT DEFAULT 0.0,
  match_count INT DEFAULT 10,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min_filter INT DEFAULT NULL,
  salary_max_filter INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  company TEXT,
  location TEXT,
  employment_type TEXT,
  salary_min INT,
  salary_max INT,
  currency TEXT,
  description TEXT,
  requirements TEXT,
  benefits TEXT,
  skills_required TEXT[],
  experience_required INT,
  education_required TEXT,
  industry TEXT,
  department TEXT,
  status TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec VECTOR(1536);
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company,
    j.location,
    j.employment_type,
    j.salary_min,
    j.salary_max,
    j.currency,
    j.description,
    j.requirements,
    j.benefits,
    j.skills_required,
    j.experience_required,
    j.education_required,
    j.industry,
    j.department,
    j.status,
    (1 - (j.embedding <=> query_vec)) as similarity
  FROM jobs j
  WHERE 
    j.status = status_filter
    -- 修复：允许NULL owner_id的记录被搜索到
    AND (user_id IS NULL OR j.owner_id IS NULL OR j.owner_id = user_id)
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR j.experience_required >= experience_min)
    AND (experience_max IS NULL OR j.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR j.skills_required && skills_filter)
    AND (1 - (j.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY j.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 6. 创建候选人插入函数
CREATE OR REPLACE FUNCTION insert_candidate_with_embedding(
  p_owner_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_current_title TEXT DEFAULT NULL,
  p_current_company TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_years_of_experience INT DEFAULT NULL,
  p_expected_salary_min INT DEFAULT NULL,
  p_expected_salary_max INT DEFAULT NULL,
  p_skills TEXT[] DEFAULT NULL,
  p_education JSONB DEFAULT NULL,
  p_experience JSONB DEFAULT NULL,
  p_certifications JSONB DEFAULT NULL,
  p_languages JSONB DEFAULT NULL,
  p_raw_data JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_embedding TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO resumes (
    owner_id,
    name,
    email,
    phone,
    current_title,
    current_company,
    location,
    years_of_experience,
    expected_salary_min,
    expected_salary_max,
    skills,
    education,
    experience,
    certifications,
    languages,
    raw_data,
    status,
    embedding,
    has_embedding
  ) VALUES (
    p_owner_id,
    p_name,
    p_email,
    p_phone,
    p_current_title,
    p_current_company,
    p_location,
    p_years_of_experience,
    p_expected_salary_min,
    p_expected_salary_max,
    p_skills,
    p_education,
    p_experience,
    p_certifications,
    p_languages,
    p_raw_data,
    p_status,
    CASE WHEN p_embedding IS NOT NULL THEN p_embedding::VECTOR(1536) ELSE NULL END,
    CASE WHEN p_embedding IS NOT NULL THEN 'YES' ELSE 'NO' END
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- 7. 创建职位插入函数
CREATE OR REPLACE FUNCTION insert_job_with_embedding(
  p_owner_id UUID,
  p_title TEXT,
  p_company TEXT,
  p_location TEXT DEFAULT NULL,
  p_employment_type TEXT DEFAULT NULL,
  p_salary_min INT DEFAULT NULL,
  p_salary_max INT DEFAULT NULL,
  p_currency TEXT DEFAULT 'CNY',
  p_description TEXT DEFAULT NULL,
  p_requirements TEXT DEFAULT NULL,
  p_benefits TEXT DEFAULT NULL,
  p_skills_required TEXT[] DEFAULT NULL,
  p_experience_required INT DEFAULT NULL,
  p_education_required TEXT DEFAULT NULL,
  p_industry TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_raw_data JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_embedding TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO jobs (
    owner_id,
    title,
    company,
    location,
    employment_type,
    salary_min,
    salary_max,
    currency,
    description,
    requirements,
    benefits,
    skills_required,
    experience_required,
    education_required,
    industry,
    department,
    raw_data,
    status,
    embedding,
    has_embedding
  ) VALUES (
    p_owner_id,
    p_title,
    p_company,
    p_location,
    p_employment_type,
    p_salary_min,
    p_salary_max,
    p_currency,
    p_description,
    p_requirements,
    p_benefits,
    p_skills_required,
    p_experience_required,
    p_education_required,
    p_industry,
    p_department,
    p_raw_data,
    p_status,
    CASE WHEN p_embedding IS NOT NULL THEN p_embedding::VECTOR(1536) ELSE NULL END,
    CASE WHEN p_embedding IS NOT NULL THEN 'YES' ELSE 'NO' END
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- 8. 验证修复结果
DO $$
DECLARE
  resume_count INT;
  job_count INT;
  resume_embedding_count INT;
  job_embedding_count INT;
BEGIN
  -- 检查数据
  SELECT COUNT(*) INTO resume_count FROM resumes;
  SELECT COUNT(*) INTO job_count FROM jobs;
  SELECT COUNT(*) INTO resume_embedding_count FROM resumes WHERE has_embedding = 'YES';
  SELECT COUNT(*) INTO job_embedding_count FROM jobs WHERE has_embedding = 'YES';
  
  RAISE NOTICE '📊 数据统计:';
  RAISE NOTICE '  - 简历总数: %', resume_count;
  RAISE NOTICE '  - 职位总数: %', job_count;
  RAISE NOTICE '  - 有embedding的简历: %', resume_embedding_count;
  RAISE NOTICE '  - 有embedding的职位: %', job_embedding_count;
  
  -- 检查函数
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_candidates_rpc') THEN
    RAISE NOTICE '✅ search_candidates_rpc 函数已创建';
  ELSE
    RAISE NOTICE '❌ search_candidates_rpc 函数创建失败';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_jobs_rpc') THEN
    RAISE NOTICE '✅ search_jobs_rpc 函数已创建';
  ELSE
    RAISE NOTICE '❌ search_jobs_rpc 函数创建失败';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'insert_candidate_with_embedding') THEN
    RAISE NOTICE '✅ insert_candidate_with_embedding 函数已创建';
  ELSE
    RAISE NOTICE '❌ insert_candidate_with_embedding 函数创建失败';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'insert_job_with_embedding') THEN
    RAISE NOTICE '✅ insert_job_with_embedding 函数已创建';
  ELSE
    RAISE NOTICE '❌ insert_job_with_embedding 函数创建失败';
  END IF;
  
  RAISE NOTICE '�� 数据库修复完成！';
END $$; 