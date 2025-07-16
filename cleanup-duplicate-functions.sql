-- 清理重复的搜索函数，确保使用最新的双语版本

-- 1. 删除旧版本的search_candidates_rpc函数（14参数版本）
DROP FUNCTION IF EXISTS search_candidates_rpc(
  TEXT, TEXT, REAL, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT, UUID, REAL, REAL
);

-- 2. 删除其他可能的旧版本
DROP FUNCTION IF EXISTS search_candidates_rpc(
  TEXT, TEXT, REAL, INT, REAL, REAL, TEXT, TEXT, INT, INT, INT, INT, TEXT[], UUID
);

-- 3. 确保新版本存在且正确 (重新创建双语版本)
CREATE OR REPLACE FUNCTION search_candidates_rpc(
  query_text TEXT,
  query_embedding TEXT,
  similarity_threshold REAL DEFAULT 0.05,
  match_count INT DEFAULT 20,
  vector_weight REAL DEFAULT 0.7,
  fts_weight REAL DEFAULT 0.3,
  status_filter TEXT DEFAULT 'active',
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min INT DEFAULT NULL,
  salary_max INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL
)
RETURNS TABLE(
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
  certifications TEXT[],
  languages TEXT[],
  status TEXT,
  similarity REAL,
  fts_rank REAL,
  combined_score REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  -- 标准化查询文本
  normalized_query := normalize_search_query(query_text);
  
  -- 使用双语FTS查询构建器 (这是关键!)
  query_tsquery := build_bilingual_tsquery(normalized_query);
  
  RETURN QUERY
  SELECT 
    resumes.id,
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
    (1 - (resumes.embedding <=> query_vec))::REAL AS similarity,
    ts_rank(resumes.fts_document, query_tsquery)::REAL AS fts_rank,
    ((1 - (resumes.embedding <=> query_vec)) * vector_weight +
      ts_rank(resumes.fts_document, query_tsquery) * fts_weight)::REAL AS combined_score
  FROM resumes
  WHERE 
    resumes.status = status_filter
    AND (location_filter IS NULL OR resumes.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR resumes.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR resumes.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR resumes.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR resumes.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR resumes.skills && skills_filter)
    -- 改进的匹配条件：支持多种搜索方式
    AND (
      -- 向量相似度匹配
      (1 - (resumes.embedding <=> query_vec)) >= similarity_threshold
      -- 双语全文搜索匹配
      OR resumes.fts_document @@ query_tsquery
      -- 标题模糊匹配（处理中文分词问题）
      OR resumes.current_title ILIKE '%' || query_text || '%'
      -- 姓名模糊匹配
      OR resumes.name ILIKE '%' || query_text || '%'
      -- 公司名匹配
      OR resumes.current_company ILIKE '%' || query_text || '%'
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 4. 同样清理并重新创建工作搜索函数
DROP FUNCTION IF EXISTS search_jobs_rpc(
  TEXT, TEXT, REAL, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT, UUID, REAL, REAL
);

DROP FUNCTION IF EXISTS search_jobs_rpc(
  TEXT, TEXT, REAL, INT, REAL, REAL, TEXT, TEXT, INT, INT, INT, INT, TEXT[]
);

CREATE OR REPLACE FUNCTION search_jobs_rpc(
  query_text TEXT,
  query_embedding TEXT,
  similarity_threshold REAL DEFAULT 0.05,
  match_count INT DEFAULT 20,
  vector_weight REAL DEFAULT 0.7,
  fts_weight REAL DEFAULT 0.3,
  status_filter TEXT DEFAULT 'active',
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min_filter INT DEFAULT NULL,
  salary_max_filter INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  company TEXT,
  location TEXT,
  employment_type TEXT,
  experience_level TEXT,
  salary_min INT,
  salary_max INT,
  description TEXT,
  requirements TEXT,
  benefits TEXT,
  skills_required TEXT[],
  education_required TEXT,
  status TEXT,
  similarity REAL,
  fts_rank REAL,
  combined_score REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  -- 标准化查询文本
  normalized_query := normalize_search_query(query_text);
  
  -- 使用双语FTS查询构建器
  query_tsquery := build_bilingual_tsquery(normalized_query);
  
  RETURN QUERY
  SELECT 
    jobs.id,
    jobs.title,
    jobs.company,
    jobs.location,
    jobs.employment_type,
    jobs.experience_level,
    jobs.salary_min,
    jobs.salary_max,
    jobs.description,
    jobs.requirements,
    jobs.benefits,
    jobs.skills_required,
    jobs.education_required,
    jobs.status,
    (1 - (jobs.embedding <=> query_vec))::REAL AS similarity,
    ts_rank(jobs.fts_document, query_tsquery)::REAL AS fts_rank,
    ((1 - (jobs.embedding <=> query_vec)) * vector_weight +
      ts_rank(jobs.fts_document, query_tsquery) * fts_weight)::REAL AS combined_score
  FROM jobs
  WHERE 
    jobs.status = status_filter
    AND (location_filter IS NULL OR jobs.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR CASE 
      WHEN jobs.experience_level = 'entry' THEN 0
      WHEN jobs.experience_level = 'mid' THEN 3
      WHEN jobs.experience_level = 'senior' THEN 5
      WHEN jobs.experience_level = 'lead' THEN 8
      ELSE 0
    END >= experience_min)
    AND (experience_max IS NULL OR CASE 
      WHEN jobs.experience_level = 'entry' THEN 2
      WHEN jobs.experience_level = 'mid' THEN 5
      WHEN jobs.experience_level = 'senior' THEN 10
      WHEN jobs.experience_level = 'lead' THEN 15
      ELSE 15
    END <= experience_max)
    AND (salary_min_filter IS NULL OR jobs.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR jobs.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR jobs.skills_required && skills_filter)
    -- 改进的匹配条件
    AND (
      -- 向量相似度匹配
      (1 - (jobs.embedding <=> query_vec)) >= similarity_threshold
      -- 双语全文搜索匹配
      OR jobs.fts_document @@ query_tsquery
      -- 标题模糊匹配
      OR jobs.title ILIKE '%' || query_text || '%'
      -- 公司名匹配
      OR jobs.company ILIKE '%' || query_text || '%'
      -- 描述模糊匹配
      OR jobs.description ILIKE '%' || query_text || '%'
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- 验证清理结果
SELECT 
  proname,
  pronargs,
  substring(prosrc, 1, 100) as function_preview
FROM pg_proc 
WHERE proname IN ('search_candidates_rpc', 'search_jobs_rpc')
ORDER BY proname, pronargs; 