-- 修复函数重载冲突问题
-- 删除所有冲突的搜索函数，重新创建统一的函数

-- ========================================
-- 第一步：删除所有现有的搜索函数
-- ========================================

-- 删除所有可能的 search_candidates_rpc 函数版本
DROP FUNCTION IF EXISTS search_candidates_rpc CASCADE;

-- 删除所有可能的 search_jobs_rpc 函数版本
DROP FUNCTION IF EXISTS search_jobs_rpc CASCADE;

-- 确保 vector 扩展已安装
CREATE EXTENSION IF NOT EXISTS vector;

-- ========================================
-- 第二步：重新创建候选人搜索函数
-- ========================================

CREATE OR REPLACE FUNCTION search_candidates_rpc(
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
  similarity         FLOAT,
  fts_rank           FLOAT,
  combined_score     FLOAT,
  created_at         TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ,
  file_url           TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
BEGIN
  -- 将文本向量转换为 VECTOR 类型
  BEGIN
    query_vec := query_embedding::VECTOR(1536);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '向量转换失败: %', SQLERRM;
  END;
  
  -- 准备全文搜索查询
  IF query_text IS NOT NULL AND query_text != '' THEN
    normalized_query := regexp_replace(query_text, '[^\w\s\u4e00-\u9fff]', ' ', 'g');
    normalized_query := regexp_replace(normalized_query, '\s+', ' ', 'g');
    normalized_query := trim(normalized_query);
    
    IF normalized_query != '' THEN
      query_tsquery := plainto_tsquery('chinese', normalized_query);
    END IF;
  END IF;
  
  -- 执行混合搜索
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.phone,
    c.current_title,
    c.current_company,
    c.location,
    c.years_of_experience,
    c.expected_salary_min,
    c.expected_salary_max,
    c.skills,
    c.education,
    c.experience,
    c.certifications,
    c.languages,
    c.status,
    
    -- 向量相似度
    (1 - (c.embedding <=> query_vec))::FLOAT as similarity,
    
    -- 全文搜索排名
    CASE 
      WHEN query_tsquery IS NOT NULL THEN
        ts_rank(c.search_vector, query_tsquery)::FLOAT
      ELSE 0.0
    END as fts_rank,
    
    -- 综合分数
    (
      vector_weight * (1 - (c.embedding <=> query_vec)) +
      fts_weight * CASE 
        WHEN query_tsquery IS NOT NULL THEN
          ts_rank(c.search_vector, query_tsquery)
        ELSE 0.0
      END
    )::FLOAT as combined_score,
    
    c.created_at,
    c.updated_at,
    c.file_url
    
  FROM public.candidates c
  WHERE 
    c.embedding IS NOT NULL
    AND (status_filter IS NULL OR c.status = status_filter)
    AND (location_filter IS NULL OR c.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR c.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR c.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR c.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR c.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR array_length(skills_filter, 1) IS NULL OR skills_filter <@ c.skills)
    AND (
      (1 - (c.embedding <=> query_vec)) >= similarity_threshold
      OR
      (query_tsquery IS NOT NULL AND c.search_vector @@ query_tsquery)
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- ========================================
-- 第三步：重新创建职位搜索函数
-- ========================================

CREATE OR REPLACE FUNCTION search_jobs_rpc(
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
  similarity FLOAT,
  fts_rank FLOAT,
  combined_score FLOAT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  query_vec     VECTOR(1536);
  query_tsquery TSQUERY;
  normalized_query TEXT;
BEGIN
  -- 将文本向量转换为 VECTOR 类型
  BEGIN
    query_vec := query_embedding::VECTOR(1536);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '向量转换失败: %', SQLERRM;
  END;
  
  -- 准备全文搜索查询
  IF query_text IS NOT NULL AND query_text != '' THEN
    normalized_query := regexp_replace(query_text, '[^\w\s\u4e00-\u9fff]', ' ', 'g');
    normalized_query := regexp_replace(normalized_query, '\s+', ' ', 'g');
    normalized_query := trim(normalized_query);
    
    IF normalized_query != '' THEN
      query_tsquery := plainto_tsquery('chinese', normalized_query);
    END IF;
  END IF;
  
  -- 执行混合搜索
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
    
    -- 向量相似度
    (1 - (j.embedding <=> query_vec))::FLOAT as similarity,
    
    -- 全文搜索排名
    CASE 
      WHEN query_tsquery IS NOT NULL THEN
        ts_rank(j.search_vector, query_tsquery)::FLOAT
      ELSE 0.0
    END as fts_rank,
    
    -- 综合分数
    (
      vector_weight * (1 - (j.embedding <=> query_vec)) +
      fts_weight * CASE 
        WHEN query_tsquery IS NOT NULL THEN
          ts_rank(j.search_vector, query_tsquery)
        ELSE 0.0
      END
    )::FLOAT as combined_score,
    
    j.created_at,
    j.updated_at
    
  FROM public.jobs j
  WHERE 
    j.embedding IS NOT NULL
    AND (status_filter IS NULL OR j.status = status_filter)
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR j.experience_required >= experience_min)
    AND (experience_max IS NULL OR j.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR array_length(skills_filter, 1) IS NULL OR skills_filter <@ j.skills_required)
    AND (
      (1 - (j.embedding <=> query_vec)) >= similarity_threshold
      OR
      (query_tsquery IS NOT NULL AND j.search_vector @@ query_tsquery)
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- ========================================
-- 第四步：创建向量索引（如果不存在）
-- ========================================

-- 为候选人表创建向量索引
CREATE INDEX IF NOT EXISTS idx_candidates_embedding 
ON public.candidates USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 为职位表创建向量索引
CREATE INDEX IF NOT EXISTS idx_jobs_embedding 
ON public.jobs USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ========================================
-- 第五步：验证函数创建
-- ========================================

-- 验证函数是否创建成功
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'search_candidates_rpc' 
    AND routine_type = 'FUNCTION'
  ) THEN
    RAISE NOTICE '✅ search_candidates_rpc 函数创建成功';
  ELSE
    RAISE NOTICE '❌ search_candidates_rpc 函数创建失败';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'search_jobs_rpc' 
    AND routine_type = 'FUNCTION'
  ) THEN
    RAISE NOTICE '✅ search_jobs_rpc 函数创建成功';
  ELSE
    RAISE NOTICE '❌ search_jobs_rpc 函数创建失败';
  END IF;
END $$; 