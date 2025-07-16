-- 优化中文全文搜索的SQL更新
-- 执行此文件来实现真正的混合搜索功能

-- 1. 创建改进的中文TSQuery构建函数
CREATE OR REPLACE FUNCTION build_chinese_tsquery(input_text TEXT)
RETURNS TSQUERY
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_text TEXT;
  terms TEXT[];
  term TEXT;
  result_query TEXT := '';
BEGIN
  -- 标准化输入文本
  normalized_text := regexp_replace(trim(input_text), '\s+', ' ', 'g');
  
  -- 分割成词条
  terms := string_to_array(normalized_text, ' ');
  
  -- 为每个词条构建前缀查询
  FOREACH term IN ARRAY terms
  LOOP
    IF trim(term) != '' THEN
      IF result_query != '' THEN
        result_query := result_query || ' & ';
      END IF;
      -- 对于中文词汇，同时尝试精确匹配和前缀匹配
      result_query := result_query || '(' || quote_literal(trim(term)) || ' | ' || quote_literal(trim(term)) || ':*)';
    END IF;
  END LOOP;
  
  -- 如果没有有效词条，返回默认查询
  IF result_query = '' THEN
    RETURN plainto_tsquery('chinese_zh', input_text);
  END IF;
  
  -- 尝试构建查询，如果失败则回退到 plainto_tsquery
  BEGIN
    RETURN to_tsquery('chinese_zh', result_query);
  EXCEPTION WHEN OTHERS THEN
    RETURN plainto_tsquery('chinese_zh', input_text);
  END;
END;
$$;

-- 2. 更新候选人搜索函数，使用改进的中文FTS
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
  
  -- 使用改进的中文FTS查询构建器
  query_tsquery := build_chinese_tsquery(normalized_query);
  
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
      -- 改进的全文搜索匹配
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

-- 3. 修复工作搜索函数的参数名冲突问题
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
  salary_min_filter INT DEFAULT NULL,  -- 重命名参数避免冲突
  salary_max_filter INT DEFAULT NULL,  -- 重命名参数避免冲突
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
  
  -- 使用改进的中文FTS查询构建器
  query_tsquery := build_chinese_tsquery(normalized_query);
  
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
    AND (salary_min_filter IS NULL OR jobs.salary_max >= salary_min_filter)  -- 使用新参数名
    AND (salary_max_filter IS NULL OR jobs.salary_min <= salary_max_filter)  -- 使用新参数名
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR jobs.skills_required && skills_filter)
    -- 改进的匹配条件
    AND (
      -- 向量相似度匹配
      (1 - (jobs.embedding <=> query_vec)) >= similarity_threshold
      -- 改进的全文搜索匹配
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

-- 4. 测试新的FTS查询构建函数
-- 你可以运行以下查询来测试前缀匹配是否工作：
-- SELECT build_chinese_tsquery('前端');
-- SELECT build_chinese_tsquery('前端开发');
-- SELECT build_chinese_tsquery('React Vue');

-- 注释：
-- 修复了参数名冲突问题：
-- 1. 将 search_jobs_rpc 中的 salary_min/salary_max 参数重命名为 salary_min_filter/salary_max_filter
-- 2. 这样避免了与返回表中的 salary_min/salary_max 列名冲突
-- 3. 其他优化保持不变：前缀匹配、混合搜索等 