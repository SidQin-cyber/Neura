-- 修复数据类型不匹配问题
-- 将FLOAT类型改为REAL类型以匹配PostgreSQL的期望

-- 删除现有函数
DROP FUNCTION IF EXISTS search_candidates_rpc;
DROP FUNCTION IF EXISTS search_jobs_rpc;

-- 重新创建候选人搜索函数，使用REAL类型
CREATE OR REPLACE FUNCTION search_candidates_rpc(
  query_embedding     TEXT,
  query_text          TEXT,          -- ⭐ 新增：原始关键词
  similarity_threshold REAL   DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min           INT    DEFAULT NULL,
  salary_max           INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active',
  fts_weight           REAL   DEFAULT 0.4, -- ⭐ 新增权重
  vector_weight        REAL   DEFAULT 0.6  -- ⭐ 新增权重
)
RETURNS TABLE (
  id                 UUID,
  name               TEXT,
  email              TEXT,
  phone              TEXT,
  current_title      TEXT,
  current_company    TEXT,
  location           TEXT,
  years_of_experience INT,
  expected_salary_min INT,
  expected_salary_max INT,
  skills             TEXT[],
  education          JSONB,
  experience         JSONB,
  certifications     JSONB,
  languages          JSONB,
  status             TEXT,
  similarity         REAL,
  fts_rank           REAL,  -- ⭐ 便于调试
  combined_score     REAL   -- ⭐ 最终排序分
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  -- 标准化查询文本并创建tsquery
  normalized_query := normalize_search_query(query_text);
  query_tsquery := websearch_to_tsquery('chinese_zh', normalized_query);
  
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
    (1 - (r.embedding <=> query_vec))::REAL                 AS similarity,
    ts_rank(r.fts_document, query_tsquery)::REAL            AS fts_rank,
    ((1 - (r.embedding <=> query_vec)) * vector_weight +
      ts_rank(r.fts_document, query_tsquery) * fts_weight)::REAL AS combined_score
  FROM resumes r
  WHERE 
    r.status = status_filter
    -- 移除用户ID过滤: AND (user_id IS NULL OR r.owner_id = user_id)
    AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR r.skills && skills_filter)
    -- 向量或关键词满足其一即可
    AND ((1 - (r.embedding <=> query_vec)) >= similarity_threshold
         OR r.fts_document @@ query_tsquery)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 重新创建职位搜索函数，使用REAL类型
CREATE OR REPLACE FUNCTION search_jobs_rpc(
  query_embedding     TEXT,
  query_text          TEXT,          -- ⭐ 新增：原始关键词
  similarity_threshold REAL   DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min_filter    INT    DEFAULT NULL,
  salary_max_filter    INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active',
  fts_weight           REAL   DEFAULT 0.4, -- ⭐ 新增权重
  vector_weight        REAL   DEFAULT 0.6  -- ⭐ 新增权重
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
  similarity REAL,
  fts_rank REAL,      -- ⭐ 便于调试
  combined_score REAL -- ⭐ 最终排序分
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  -- 标准化查询文本并创建tsquery
  normalized_query := normalize_search_query(query_text);
  query_tsquery := websearch_to_tsquery('chinese_zh', normalized_query);
  
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
    (1 - (j.embedding <=> query_vec))::REAL                 AS similarity,
    ts_rank(j.fts_document, query_tsquery)::REAL            AS fts_rank,
    ((1 - (j.embedding <=> query_vec)) * vector_weight +
      ts_rank(j.fts_document, query_tsquery) * fts_weight)::REAL AS combined_score
  FROM jobs j
  WHERE 
    j.status = status_filter
    -- 移除用户ID过滤: AND (user_id IS NULL OR j.owner_id = user_id)
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR j.experience_required >= experience_min)
    AND (experience_max IS NULL OR j.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR j.skills_required && skills_filter)
    -- 向量或关键词满足其一即可
    AND ((1 - (j.embedding <=> query_vec)) >= similarity_threshold
         OR j.fts_document @@ query_tsquery)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 授权给认证用户
GRANT EXECUTE ON FUNCTION search_candidates_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION search_jobs_rpc TO authenticated; 