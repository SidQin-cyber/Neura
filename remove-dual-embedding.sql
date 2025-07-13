-- 移除双模型配置，确保只使用单一embedding模型
-- 清理脚本

-- 1. 删除双模型搜索相关的函数
DROP FUNCTION IF EXISTS search_candidates_dual_stage_rpc(
    VECTOR(1536), VECTOR(3072), FLOAT, FLOAT, INT, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT
);

DROP FUNCTION IF EXISTS search_jobs_dual_stage_rpc(
    VECTOR(1536), VECTOR(3072), FLOAT, FLOAT, INT, INT, TEXT, TEXT, INT, INT, TEXT[], INT, TEXT
);

DROP FUNCTION IF EXISTS calculate_dual_match_score(
    VECTOR(1536), VECTOR(3072), VECTOR(1536), VECTOR(3072)
);

DROP FUNCTION IF EXISTS generate_dual_matches_rpc(UUID, UUID, INT, FLOAT);

DROP FUNCTION IF EXISTS get_dual_search_stats_rpc();

DROP FUNCTION IF EXISTS update_dual_embedding_status(TEXT, UUID, TEXT, TEXT);

DROP FUNCTION IF EXISTS get_records_for_dual_embedding_rpc(TEXT, INT);

-- 2. 删除双模型状态跟踪表
DROP TABLE IF EXISTS dual_embedding_status;

-- 3. 删除large embedding相关的索引
DROP INDEX IF EXISTS idx_resumes_embedding_large;
DROP INDEX IF EXISTS idx_jobs_embedding_large;

-- 4. 删除large embedding字段（可选，如果确定不再需要）
-- 注意：这会永久删除数据，请谨慎执行
-- ALTER TABLE resumes DROP COLUMN IF EXISTS embedding_large;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS embedding_large;

-- 5. 确保单模型搜索函数正常工作
-- 重新创建或更新搜索函数，确保它们使用正确的1536维向量

-- 候选人搜索函数（单模型版本）
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
    AND (user_id IS NULL OR r.owner_id = user_id)
    AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR r.skills && skills_filter)
    AND r.embedding IS NOT NULL  -- 确保有embedding
    AND (1 - (r.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY r.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 职位搜索函数（单模型版本）
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
    AND (user_id IS NULL OR j.owner_id = user_id)
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR j.experience_required >= experience_min)
    AND (experience_max IS NULL OR j.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR j.skills_required && skills_filter)
    AND j.embedding IS NOT NULL  -- 确保有embedding
    AND (1 - (j.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY j.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 6. 验证清理结果
SELECT 'Dual embedding cleanup completed successfully!' as message;

-- 7. 检查剩余的embedding相关对象
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%embedding%' 
   OR routine_name LIKE '%dual%'
ORDER BY routine_name;

-- 8. 检查表结构
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name LIKE '%embedding%' 
ORDER BY table_name, column_name; 