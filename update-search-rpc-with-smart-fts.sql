-- 更新搜索RPC函数以使用智能FTS匹配
-- 这将显著提升中文搜索效果

-- 1. 创建升级版的候选人搜索函数
CREATE OR REPLACE FUNCTION search_candidates_rpc_v2(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold FLOAT  DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min           INT    DEFAULT NULL,
  salary_max           INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active',
  user_id_param        UUID   DEFAULT NULL,
  fts_weight           FLOAT  DEFAULT 0.4,
  vector_weight        FLOAT  DEFAULT 0.6
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
  fts_rank           REAL,
  combined_score     REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
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
    (1 - (r.embedding <=> query_vec))::REAL AS similarity,
    -- 🔥 使用智能FTS匹配替代标准ts_rank
    GREATEST(
      smart_fts_rank(r.fts_document, query_text),
      fallback_text_match(r.name, r.current_company, r.current_title, query_text)
    )::REAL AS fts_rank,
    -- 组合分数使用增强的FTS分数
    ((1 - (r.embedding <=> query_vec)) * vector_weight +
      GREATEST(
        smart_fts_rank(r.fts_document, query_text),
        fallback_text_match(r.name, r.current_company, r.current_title, query_text)
      ) * fts_weight)::REAL AS combined_score
  FROM resumes r
  WHERE 
    r.status = status_filter
    AND (user_id_param IS NULL OR r.owner_id = user_id_param)
    AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR r.skills && skills_filter)
    -- 改进的匹配条件
    AND ((1 - (r.embedding <=> query_vec)) >= similarity_threshold
         OR smart_fts_rank(r.fts_document, query_text) > 0
         OR fallback_text_match(r.name, r.current_company, r.current_title, query_text) > 0)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 2. 创建升级版的职位搜索函数
CREATE OR REPLACE FUNCTION search_jobs_rpc_v2(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold FLOAT  DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min_filter    INT    DEFAULT NULL,
  salary_max_filter    INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active',
  user_id_param        UUID   DEFAULT NULL,
  fts_weight           FLOAT  DEFAULT 0.4,
  vector_weight        FLOAT  DEFAULT 0.6
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
  fts_rank REAL,
  combined_score REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
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
    (1 - (j.embedding <=> query_vec))::REAL AS similarity,
    -- 🔥 使用智能FTS匹配
    GREATEST(
      smart_fts_rank(j.fts_document, query_text),
      fallback_text_match(j.title, j.company, j.description, query_text)
    )::REAL AS fts_rank,
    -- 组合分数
    ((1 - (j.embedding <=> query_vec)) * vector_weight +
      GREATEST(
        smart_fts_rank(j.fts_document, query_text),
        fallback_text_match(j.title, j.company, j.description, query_text)
      ) * fts_weight)::REAL AS combined_score
  FROM jobs j
  WHERE 
    j.status = status_filter
    AND (user_id_param IS NULL OR j.owner_id = user_id_param)
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR j.experience_required >= experience_min)
    AND (experience_max IS NULL OR j.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR j.skills_required && skills_filter)
    -- 改进的匹配条件
    AND ((1 - (j.embedding <=> query_vec)) >= similarity_threshold
         OR smart_fts_rank(j.fts_document, query_text) > 0
         OR fallback_text_match(j.title, j.company, j.description, query_text) > 0)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 3. 授权新函数
GRANT EXECUTE ON FUNCTION search_candidates_rpc_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION search_jobs_rpc_v2 TO authenticated;

-- 4. 测试新函数
SELECT 
  name,
  current_company,
  similarity,
  fts_rank,
  combined_score
FROM search_candidates_rpc_v2(
  '[' || repeat('0.1,', 1535) || '0.1]',  -- 测试向量
  '小米',                                  -- 查询文本
  0.01,                                   -- similarity_threshold
  10,                                     -- match_count
  NULL,                                   -- location_filter
  NULL, NULL,                             -- experience range
  NULL, NULL,                             -- salary range
  NULL,                                   -- skills_filter
  'active',                               -- status_filter
  NULL,                                   -- user_id_param
  0.5,                                    -- fts_weight
  0.5                                     -- vector_weight
)
ORDER BY combined_score DESC; 