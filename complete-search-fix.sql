-- 完整的搜索功能修复方案
-- 解决所有搜索不返回结果的问题

-- 1. 确保vector扩展已安装
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 删除现有的函数（避免签名冲突）
DROP FUNCTION IF EXISTS search_candidates_rpc(TEXT, TEXT, FLOAT, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT, UUID, FLOAT, FLOAT);
DROP FUNCTION IF EXISTS search_jobs_rpc(TEXT, TEXT, FLOAT, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT, UUID, FLOAT, FLOAT);
DROP FUNCTION IF EXISTS search_candidates_rpc(TEXT, FLOAT, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT, UUID);
DROP FUNCTION IF EXISTS search_jobs_rpc(TEXT, FLOAT, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT, UUID);

-- 3. 创建与API完全匹配的搜索函数
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
  similarity FLOAT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  file_url TEXT
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
    (1 - (r.embedding <=> query_vec)) as similarity,
    r.created_at,
    r.updated_at,
    r.file_url
  FROM resumes r
  WHERE 
    r.status = status_filter
    AND r.embedding IS NOT NULL
    AND (user_id IS NULL OR r.owner_id = user_id)
    AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR r.skills && skills_filter)
    AND (1 - (r.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY r.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 4. 创建与API完全匹配的职位搜索函数
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
  similarity FLOAT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
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
    (1 - (j.embedding <=> query_vec)) as similarity,
    j.created_at,
    j.updated_at
  FROM jobs j
  WHERE 
    j.status = status_filter
    AND j.embedding IS NOT NULL
    AND (user_id IS NULL OR j.owner_id = user_id)
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR j.experience_required >= experience_min)
    AND (experience_max IS NULL OR j.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR j.skills_required && skills_filter)
    AND (1 - (j.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY j.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 5. 创建插入候选人函数（确保embedding正确存储）
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
    embedding
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
    CASE WHEN p_embedding IS NOT NULL THEN p_embedding::VECTOR(1536) ELSE NULL END
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- 6. 检查并修复现有数据的embedding问题
DO $$
DECLARE
  user_id UUID := '98abb085-2969-46c5-b370-213a27a52f2e';
  resume_count INT;
  embedding_count INT;
BEGIN
  -- 检查用户数据
  SELECT COUNT(*) INTO resume_count FROM resumes WHERE owner_id = user_id;
  SELECT COUNT(*) INTO embedding_count FROM resumes WHERE owner_id = user_id AND embedding IS NOT NULL;
  
  RAISE NOTICE '用户 % 的数据统计:', user_id;
  RAISE NOTICE '- 总简历数: %', resume_count;
  RAISE NOTICE '- 有embedding的简历数: %', embedding_count;
  
  -- 如果有数据但没有embedding，给出提示
  IF resume_count > 0 AND embedding_count = 0 THEN
    RAISE NOTICE '⚠️ 发现问题：用户有简历数据但没有embedding向量';
    RAISE NOTICE '解决方案：重新上传简历文件，或者联系管理员手动添加embedding';
  END IF;
END $$;

-- 7. 测试搜索功能
DO $$
DECLARE
  test_embedding TEXT := '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']';
  result_count INT;
  user_id UUID := '98abb085-2969-46c5-b370-213a27a52f2e';
BEGIN
  -- 测试搜索函数
  SELECT COUNT(*) INTO result_count
  FROM search_candidates_rpc(
    test_embedding,
    0.0,  -- similarity_threshold
    10,   -- match_count
    NULL, -- location_filter
    NULL, -- experience_min
    NULL, -- experience_max
    NULL, -- salary_min
    NULL, -- salary_max
    ARRAY[]::TEXT[], -- skills_filter
    'active', -- status_filter
    user_id -- user_id
  );
  
  RAISE NOTICE '🧪 搜索功能测试结果: % 条记录', result_count;
  
  IF result_count = 0 THEN
    RAISE NOTICE '❌ 搜索仍然返回0条结果';
    RAISE NOTICE '可能的原因：';
    RAISE NOTICE '1. 数据没有embedding向量';
    RAISE NOTICE '2. 数据状态不是active';
    RAISE NOTICE '3. owner_id不匹配';
  ELSE
    RAISE NOTICE '✅ 搜索功能正常工作';
  END IF;
END $$;

-- 8. 验证函数创建
DO $$
BEGIN
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
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 搜索功能修复完成！';
  RAISE NOTICE '';
  RAISE NOTICE '📋 修复内容：';
  RAISE NOTICE '1. 更新搜索函数签名与API完全匹配';
  RAISE NOTICE '2. 添加embedding IS NOT NULL检查';
  RAISE NOTICE '3. 包含所有必要的返回字段';
  RAISE NOTICE '4. 确保插入函数正确处理embedding';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 现在请测试搜索功能！';
END $$; 