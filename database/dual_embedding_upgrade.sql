-- Neura AI招聘平台 - 双模型查询升级脚本
-- 支持text-embedding-3-small + text-embedding-3-large两阶段查询

-- 1. 添加large embedding字段
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS embedding_large VECTOR(3072);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS embedding_large VECTOR(3072);

-- 2. 创建large embedding索引
CREATE INDEX IF NOT EXISTS idx_resumes_embedding_large ON resumes USING ivfflat (embedding_large vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_embedding_large ON jobs USING ivfflat (embedding_large vector_cosine_ops);

-- 3. 双阶段候选人搜索函数
CREATE OR REPLACE FUNCTION search_candidates_dual_stage_rpc(
  query_embedding_small VECTOR(1536),
  query_embedding_large VECTOR(3072),
  similarity_threshold_small FLOAT DEFAULT 0.6,
  similarity_threshold_large FLOAT DEFAULT 0.7,
  first_stage_count INT DEFAULT 20,
  final_count INT DEFAULT 10,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min INT DEFAULT NULL,
  salary_max INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  current_title TEXT,
  current_company TEXT,
  location TEXT,
  years_of_experience INT,
  expected_salary_min INT,
  expected_salary_max INT,
  skills TEXT[],
  file_url TEXT,
  similarity_small FLOAT,
  similarity_large FLOAT,
  final_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH first_stage AS (
    -- 第一阶段：使用small embedding进行粗筛
    SELECT
      r.id,
      r.name,
      r.email,
      r.current_title,
      r.current_company,
      r.location,
      r.years_of_experience,
      r.expected_salary_min,
      r.expected_salary_max,
      r.skills,
      r.file_url,
      r.embedding_large,
      (1 - (r.embedding <=> query_embedding_small))::FLOAT AS similarity_small,
      r.created_at,
      r.updated_at
    FROM resumes r
    WHERE
      r.status = status_filter
      AND (1 - (r.embedding <=> query_embedding_small)) > similarity_threshold_small
      AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
      AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
      AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
      AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
      AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
      AND (skills_filter IS NULL OR r.skills && skills_filter)
      AND r.owner_id = auth.uid()
      AND r.embedding_large IS NOT NULL  -- 确保有large embedding
    ORDER BY r.embedding <=> query_embedding_small
    LIMIT first_stage_count
  )
  -- 第二阶段：使用large embedding进行精排
  SELECT
    fs.id,
    fs.name,
    fs.email,
    fs.current_title,
    fs.current_company,
    fs.location,
    fs.years_of_experience,
    fs.expected_salary_min,
    fs.expected_salary_max,
    fs.skills,
    fs.file_url,
    fs.similarity_small,
    (1 - (fs.embedding_large <=> query_embedding_large))::FLOAT AS similarity_large,
    -- 综合评分：70%大模型 + 30%小模型
    (0.7 * (1 - (fs.embedding_large <=> query_embedding_large)) + 0.3 * fs.similarity_small)::FLOAT AS final_score,
    fs.created_at,
    fs.updated_at
  FROM first_stage fs
  WHERE (1 - (fs.embedding_large <=> query_embedding_large)) > similarity_threshold_large
  ORDER BY final_score DESC
  LIMIT final_count;
END;
$$;

-- 4. 双阶段职位搜索函数
CREATE OR REPLACE FUNCTION search_jobs_dual_stage_rpc(
  query_embedding_small VECTOR(1536),
  query_embedding_large VECTOR(3072),
  similarity_threshold_small FLOAT DEFAULT 0.6,
  similarity_threshold_large FLOAT DEFAULT 0.7,
  first_stage_count INT DEFAULT 20,
  final_count INT DEFAULT 10,
  location_filter TEXT DEFAULT NULL,
  employment_type_filter TEXT DEFAULT NULL,
  salary_min_filter INT DEFAULT NULL,
  salary_max_filter INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  experience_required_filter INT DEFAULT NULL,
  status_filter TEXT DEFAULT 'active'
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
  skills_required TEXT[],
  experience_required INT,
  similarity_small FLOAT,
  similarity_large FLOAT,
  final_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH first_stage AS (
    -- 第一阶段：使用small embedding进行粗筛
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
      j.skills_required,
      j.experience_required,
      j.embedding_large,
      (1 - (j.embedding <=> query_embedding_small))::FLOAT AS similarity_small,
      j.created_at,
      j.updated_at
    FROM jobs j
    WHERE
      j.status = status_filter
      AND (1 - (j.embedding <=> query_embedding_small)) > similarity_threshold_small
      AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
      AND (employment_type_filter IS NULL OR j.employment_type = employment_type_filter)
      AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
      AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
      AND (skills_filter IS NULL OR j.skills_required && skills_filter)
      AND (experience_required_filter IS NULL OR j.experience_required <= experience_required_filter)
      AND j.owner_id = auth.uid()
      AND j.embedding_large IS NOT NULL  -- 确保有large embedding
    ORDER BY j.embedding <=> query_embedding_small
    LIMIT first_stage_count
  )
  -- 第二阶段：使用large embedding进行精排
  SELECT
    fs.id,
    fs.title,
    fs.company,
    fs.location,
    fs.employment_type,
    fs.salary_min,
    fs.salary_max,
    fs.currency,
    fs.description,
    fs.skills_required,
    fs.experience_required,
    fs.similarity_small,
    (1 - (fs.embedding_large <=> query_embedding_large))::FLOAT AS similarity_large,
    -- 综合评分：70%大模型 + 30%小模型
    (0.7 * (1 - (fs.embedding_large <=> query_embedding_large)) + 0.3 * fs.similarity_small)::FLOAT AS final_score,
    fs.created_at,
    fs.updated_at
  FROM first_stage fs
  WHERE (1 - (fs.embedding_large <=> query_embedding_large)) > similarity_threshold_large
  ORDER BY final_score DESC
  LIMIT final_count;
END;
$$;

-- 5. 双模型匹配分数计算函数
CREATE OR REPLACE FUNCTION calculate_dual_match_score(
  candidate_embedding_small VECTOR(1536),
  candidate_embedding_large VECTOR(3072),
  job_embedding_small VECTOR(1536),
  job_embedding_large VECTOR(3072)
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  similarity_small FLOAT;
  similarity_large FLOAT;
  final_score FLOAT;
BEGIN
  -- 计算两个模型的相似度
  similarity_small := 1 - (candidate_embedding_small <=> job_embedding_small);
  similarity_large := 1 - (candidate_embedding_large <=> job_embedding_large);
  
  -- 综合评分：70%大模型 + 30%小模型
  final_score := 0.7 * similarity_large + 0.3 * similarity_small;
  
  RETURN GREATEST(0, LEAST(1, final_score));
END;
$$;

-- 6. 批量生成双模型匹配
CREATE OR REPLACE FUNCTION generate_dual_matches_rpc(
  candidate_id_param UUID DEFAULT NULL,
  job_id_param UUID DEFAULT NULL,
  match_count INT DEFAULT 10,
  min_score FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  candidate_id UUID,
  job_id UUID,
  candidate_name TEXT,
  job_title TEXT,
  company TEXT,
  similarity_small FLOAT,
  similarity_large FLOAT,
  final_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS candidate_id,
    j.id AS job_id,
    r.name AS candidate_name,
    j.title AS job_title,
    j.company,
    (1 - (r.embedding <=> j.embedding))::FLOAT AS similarity_small,
    (1 - (r.embedding_large <=> j.embedding_large))::FLOAT AS similarity_large,
    calculate_dual_match_score(r.embedding, r.embedding_large, j.embedding, j.embedding_large) AS final_score,
    NOW() AS created_at
  FROM resumes r
  CROSS JOIN jobs j
  WHERE
    r.status = 'active'
    AND j.status = 'active'
    AND r.embedding_large IS NOT NULL
    AND j.embedding_large IS NOT NULL
    AND (candidate_id_param IS NULL OR r.id = candidate_id_param)
    AND (job_id_param IS NULL OR j.id = job_id_param)
    AND (r.owner_id = auth.uid() OR j.owner_id = auth.uid())
    AND calculate_dual_match_score(r.embedding, r.embedding_large, j.embedding, j.embedding_large) >= min_score
  ORDER BY final_score DESC
  LIMIT match_count;
END;
$$;

-- 7. 获取双模型搜索统计
CREATE OR REPLACE FUNCTION get_dual_search_stats_rpc()
RETURNS TABLE (
  total_resumes INT,
  total_jobs INT,
  resumes_with_both_embeddings INT,
  jobs_with_both_embeddings INT,
  embedding_coverage_percentage FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM resumes WHERE owner_id = auth.uid()) as total_resumes,
    (SELECT COUNT(*)::INT FROM jobs WHERE owner_id = auth.uid()) as total_jobs,
    (SELECT COUNT(*)::INT FROM resumes WHERE owner_id = auth.uid() AND embedding IS NOT NULL AND embedding_large IS NOT NULL) as resumes_with_both_embeddings,
    (SELECT COUNT(*)::INT FROM jobs WHERE owner_id = auth.uid() AND embedding IS NOT NULL AND embedding_large IS NOT NULL) as jobs_with_both_embeddings,
    (
      SELECT 
        CASE 
          WHEN (SELECT COUNT(*) FROM resumes WHERE owner_id = auth.uid()) + (SELECT COUNT(*) FROM jobs WHERE owner_id = auth.uid()) = 0 THEN 0
          ELSE (
            (SELECT COUNT(*) FROM resumes WHERE owner_id = auth.uid() AND embedding IS NOT NULL AND embedding_large IS NOT NULL) +
            (SELECT COUNT(*) FROM jobs WHERE owner_id = auth.uid() AND embedding IS NOT NULL AND embedding_large IS NOT NULL)
          )::FLOAT / (
            (SELECT COUNT(*) FROM resumes WHERE owner_id = auth.uid()) + 
            (SELECT COUNT(*) FROM jobs WHERE owner_id = auth.uid())
          )::FLOAT * 100
        END
    )::FLOAT as embedding_coverage_percentage;
END;
$$;

-- 8. 创建dual embedding生成状态表
CREATE TABLE IF NOT EXISTS dual_embedding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_name, record_id)
);

-- 启用RLS
ALTER TABLE dual_embedding_status ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Users can view their own embedding status" ON dual_embedding_status FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM resumes r WHERE r.id = record_id AND r.owner_id = auth.uid() AND table_name = 'resumes'
  ) OR EXISTS (
    SELECT 1 FROM jobs j WHERE j.id = record_id AND j.owner_id = auth.uid() AND table_name = 'jobs'
  )
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_dual_embedding_status_table_record ON dual_embedding_status(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_dual_embedding_status_status ON dual_embedding_status(status);

-- 创建更新函数
CREATE OR REPLACE FUNCTION update_dual_embedding_status(
  table_name_param TEXT,
  record_id_param UUID,
  status_param TEXT,
  error_message_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO dual_embedding_status (table_name, record_id, status, error_message)
  VALUES (table_name_param, record_id_param, status_param, error_message_param)
  ON CONFLICT (table_name, record_id) 
  DO UPDATE SET 
    status = EXCLUDED.status,
    error_message = EXCLUDED.error_message,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- 添加触发器
CREATE TRIGGER update_dual_embedding_status_updated_at 
BEFORE UPDATE ON dual_embedding_status 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建函数获取需要处理的记录
CREATE OR REPLACE FUNCTION get_records_for_dual_embedding_rpc(
  table_name_param TEXT,
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF table_name_param = 'resumes' THEN
    RETURN QUERY
    SELECT
      r.id,
      COALESCE(r.name, '') || ' ' || 
      COALESCE(r.current_title, '') || ' ' || 
      COALESCE(r.current_company, '') || ' ' || 
      COALESCE(array_to_string(r.skills, ' '), '') AS content,
      COALESCE(des.status, 'pending') AS status
    FROM resumes r
    LEFT JOIN dual_embedding_status des ON des.table_name = 'resumes' AND des.record_id = r.id
    WHERE r.owner_id = auth.uid()
      AND r.embedding IS NOT NULL
      AND r.embedding_large IS NULL
      AND COALESCE(des.status, 'pending') != 'processing'
    ORDER BY r.created_at DESC
    LIMIT limit_count;
  ELSIF table_name_param = 'jobs' THEN
    RETURN QUERY
    SELECT
      j.id,
      COALESCE(j.title, '') || ' ' || 
      COALESCE(j.company, '') || ' ' || 
      COALESCE(j.description, '') || ' ' || 
      COALESCE(array_to_string(j.skills_required, ' '), '') AS content,
      COALESCE(des.status, 'pending') AS status
    FROM jobs j
    LEFT JOIN dual_embedding_status des ON des.table_name = 'jobs' AND des.record_id = j.id
    WHERE j.owner_id = auth.uid()
      AND j.embedding IS NOT NULL
      AND j.embedding_large IS NULL
      AND COALESCE(des.status, 'pending') != 'processing'
    ORDER BY j.created_at DESC
    LIMIT limit_count;
  END IF;
END;
$$;

-- 完成脚本
SELECT 'Dual embedding upgrade completed successfully!' AS message; 