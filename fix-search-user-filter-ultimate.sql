-- 修复搜索函数用户ID过滤问题 (终极版本)
-- 彻底解决所有问题：函数重载、字段冲突、用户ID过滤

-- 彻底删除所有search_candidates_rpc函数
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc 
        WHERE proname = 'search_candidates_rpc'
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_record.proname || '(' || func_record.args || ') CASCADE';
    END LOOP;
END $$;

-- 彻底删除所有search_jobs_rpc函数
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc 
        WHERE proname = 'search_jobs_rpc'
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_record.proname || '(' || func_record.args || ') CASCADE';
    END LOOP;
END $$;

-- 重新创建候选人搜索函数，移除用户ID过滤，修复所有字段冲突
CREATE FUNCTION search_candidates_rpc(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL  DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min           INT    DEFAULT NULL,
  salary_max           INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active',
  user_id_param        UUID   DEFAULT NULL,
  fts_weight           REAL  DEFAULT 0.4,
  vector_weight        REAL  DEFAULT 0.6
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
    resumes.id,                                    -- 完全限定字段名
    resumes.name,
    resumes.email,
    resumes.phone,
    resumes.current_title,
    resumes.current_company,
    resumes.location,
    resumes.years_of_experience,
    resumes.expected_salary_min,
    resumes.expected_salary_max,
    resumes.skills,
    resumes.education,
    resumes.experience,
    resumes.certifications,
    resumes.languages,
    resumes.status,
    (1 - (resumes.embedding <=> query_vec))::REAL                 AS similarity,
    ts_rank(resumes.fts_document, query_tsquery)::REAL            AS fts_rank,
    ((1 - (resumes.embedding <=> query_vec)) * vector_weight +
      ts_rank(resumes.fts_document, query_tsquery) * fts_weight)::REAL AS combined_score
  FROM resumes                                     -- 使用完整表名
  WHERE 
    resumes.status = status_filter
    -- 移除用户ID过滤，实现数据共享
    -- AND (user_id_param IS NULL OR resumes.owner_id = user_id_param)
    AND (location_filter IS NULL OR resumes.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR resumes.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR resumes.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR resumes.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR resumes.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR resumes.skills && skills_filter)
    -- 向量或关键词满足其一即可
    AND ((1 - (resumes.embedding <=> query_vec)) >= similarity_threshold
         OR resumes.fts_document @@ query_tsquery)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 重新创建职位搜索函数，移除用户ID过滤，修复所有字段冲突
CREATE FUNCTION search_jobs_rpc(
  query_embedding     TEXT,
  query_text          TEXT,
  similarity_threshold REAL  DEFAULT 0.0,
  match_count          INT    DEFAULT 10,
  location_filter      TEXT   DEFAULT NULL,
  experience_min       INT    DEFAULT NULL,
  experience_max       INT    DEFAULT NULL,
  salary_min_filter    INT    DEFAULT NULL,
  salary_max_filter    INT    DEFAULT NULL,
  skills_filter        TEXT[] DEFAULT NULL,
  status_filter        TEXT   DEFAULT 'active',
  user_id_param        UUID   DEFAULT NULL,
  fts_weight           REAL  DEFAULT 0.4,
  vector_weight        REAL  DEFAULT 0.6
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
    jobs.id,                                    -- 完全限定字段名
    jobs.title,
    jobs.company,
    jobs.location,
    jobs.employment_type,
    jobs.salary_min,
    jobs.salary_max,
    jobs.currency,
    jobs.description,
    jobs.requirements,
    jobs.benefits,
    jobs.skills_required,
    jobs.experience_required,
    jobs.education_required,
    jobs.industry,
    jobs.department,
    jobs.status,
    (1 - (jobs.embedding <=> query_vec))::REAL                 AS similarity,
    ts_rank(jobs.fts_document, query_tsquery)::REAL            AS fts_rank,
    ((1 - (jobs.embedding <=> query_vec)) * vector_weight +
      ts_rank(jobs.fts_document, query_tsquery) * fts_weight)::REAL AS combined_score
  FROM jobs                                    -- 使用完整表名
  WHERE 
    jobs.status = status_filter
    -- 移除用户ID过滤，实现数据共享
    -- AND (user_id_param IS NULL OR jobs.owner_id = user_id_param)
    AND (location_filter IS NULL OR jobs.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR jobs.experience_required >= experience_min)
    AND (experience_max IS NULL OR jobs.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR jobs.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR jobs.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR jobs.skills_required && skills_filter)
    -- 向量或关键词满足其一即可
    AND ((1 - (jobs.embedding <=> query_vec)) >= similarity_threshold
         OR jobs.fts_document @@ query_tsquery)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 确保函数权限正确
GRANT EXECUTE ON FUNCTION search_candidates_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION search_jobs_rpc TO authenticated;

-- 验证修复
SELECT 'Ultimate fix applied - all conflicts resolved and user filtering removed' as status; 