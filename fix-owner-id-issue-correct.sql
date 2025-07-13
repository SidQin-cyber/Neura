-- 修复 NULL owner_id 问题的正确脚本
-- 保持原有函数签名，只修复搜索逻辑

-- 1. 修复候选人搜索函数
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

-- 2. 修复职位搜索函数
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

-- 3. 测试修复是否成功
DO $$
BEGIN
  -- 检查函数是否存在
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_candidates_rpc') THEN
    RAISE NOTICE '✅ search_candidates_rpc 函数已更新';
  ELSE
    RAISE NOTICE '❌ search_candidates_rpc 函数不存在';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_jobs_rpc') THEN
    RAISE NOTICE '✅ search_jobs_rpc 函数已更新';
  ELSE
    RAISE NOTICE '❌ search_jobs_rpc 函数不存在';
  END IF;
  
  RAISE NOTICE '🔧 搜索函数修复完成！现在应该可以返回 NULL owner_id 的记录了。';
END $$;

-- 4. 可选：为现有的NULL owner_id记录分配默认用户
-- 如果你想要修复数据完整性，可以运行以下代码：
/*
DO $$
DECLARE
  default_user_id UUID;
  updated_resumes INT;
  updated_jobs INT;
BEGIN
  -- 获取第一个用户作为默认用户（或者你可以指定特定用户）
  SELECT id INTO default_user_id FROM auth.users LIMIT 1;
  
  IF default_user_id IS NOT NULL THEN
    -- 更新NULL owner_id的简历
    UPDATE resumes 
    SET owner_id = default_user_id 
    WHERE owner_id IS NULL;
    
    GET DIAGNOSTICS updated_resumes = ROW_COUNT;
    
    -- 更新NULL owner_id的职位
    UPDATE jobs 
    SET owner_id = default_user_id 
    WHERE owner_id IS NULL;
    
    GET DIAGNOSTICS updated_jobs = ROW_COUNT;
    
    RAISE NOTICE '✅ 已为 % 个简历和 % 个职位分配默认用户ID: %', 
                 updated_resumes, updated_jobs, default_user_id;
  ELSE
    RAISE NOTICE '❌ 没有找到用户，无法分配默认owner_id';
  END IF;
END $$;
*/ 