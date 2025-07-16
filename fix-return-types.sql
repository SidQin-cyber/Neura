-- 修正函数返回类型匹配实际数据库表结构
-- 主要问题：certifications 和 languages 在数据库中是 jsonb，不是 text[]

CREATE OR REPLACE FUNCTION search_candidates_rpc(
  query_embedding TEXT,
  query_text TEXT, 
  similarity_threshold REAL DEFAULT 0.05,
  match_count INT DEFAULT 20,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min INT DEFAULT NULL,
  salary_max INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  user_id_param UUID DEFAULT NULL,
  fts_weight REAL DEFAULT 0.3,
  vector_weight REAL DEFAULT 0.7
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
  skills TEXT[],                -- 这个是 ARRAY，保持 TEXT[]
  education JSONB,              -- 这个是 JSONB
  experience JSONB,             -- 修正：改为 JSONB（之前错误地定义为 TEXT[]）
  certifications JSONB,         -- 修正：改为 JSONB（之前错误地定义为 TEXT[]）
  languages JSONB,              -- 修正：改为 JSONB（之前错误地定义为 TEXT[]）
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
    resumes.experience,           -- 现在正确返回 JSONB
    resumes.certifications,       -- 现在正确返回 JSONB
    resumes.languages,            -- 现在正确返回 JSONB
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

-- 验证修正结果
SELECT 
  proname,
  pronargs,
  CASE 
    WHEN prosrc LIKE '%build_bilingual_tsquery%' THEN '✅ 双语FTS已启用'
    ELSE '❌ 未使用双语FTS'
  END as fts_status
FROM pg_proc 
WHERE proname = 'search_candidates_rpc'
ORDER BY oid DESC
LIMIT 1; 