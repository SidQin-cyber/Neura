-- 增强的薪资范围匹配函数
-- 支持更智能的薪资匹配逻辑和薪资数据清洗

-- 薪资数据清洗和验证函数
CREATE OR REPLACE FUNCTION clean_salary_data()
RETURNS TABLE (
  table_name TEXT,
  record_id UUID,
  original_min INT,
  original_max INT,
  cleaned_min INT,
  cleaned_max INT,
  issues TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  resume_record RECORD;
  job_record RECORD;
  issues_array TEXT[];
BEGIN
  -- 清理候选人薪资数据
  FOR resume_record IN 
    SELECT id, expected_salary_min, expected_salary_max 
    FROM resumes 
    WHERE status = 'active' 
      AND (expected_salary_min IS NOT NULL OR expected_salary_max IS NOT NULL)
  LOOP
    issues_array := ARRAY[]::TEXT[];
    
    -- 检查和修正薪资数据
    IF resume_record.expected_salary_min IS NOT NULL AND resume_record.expected_salary_max IS NOT NULL THEN
      -- 确保最小值不大于最大值
      IF resume_record.expected_salary_min > resume_record.expected_salary_max THEN
        issues_array := array_append(issues_array, 'min_greater_than_max');
        -- 交换值
        UPDATE resumes 
        SET expected_salary_min = resume_record.expected_salary_max,
            expected_salary_max = resume_record.expected_salary_min,
            updated_at = NOW()
        WHERE id = resume_record.id;
      END IF;
    END IF;
    
    -- 检查异常值
    IF resume_record.expected_salary_min IS NOT NULL AND resume_record.expected_salary_min < 1000 THEN
      issues_array := array_append(issues_array, 'min_too_low');
    END IF;
    
    IF resume_record.expected_salary_max IS NOT NULL AND resume_record.expected_salary_max > 1000000 THEN
      issues_array := array_append(issues_array, 'max_too_high');
    END IF;
    
    -- 返回清理结果
    IF array_length(issues_array, 1) > 0 THEN
      RETURN QUERY SELECT 
        'resumes'::TEXT,
        resume_record.id,
        resume_record.expected_salary_min,
        resume_record.expected_salary_max,
        resume_record.expected_salary_min,
        resume_record.expected_salary_max,
        issues_array;
    END IF;
  END LOOP;
  
  -- 清理职位薪资数据
  FOR job_record IN 
    SELECT id, salary_min, salary_max 
    FROM jobs 
    WHERE status = 'active' 
      AND (salary_min IS NOT NULL OR salary_max IS NOT NULL)
  LOOP
    issues_array := ARRAY[]::TEXT[];
    
    -- 检查和修正薪资数据
    IF job_record.salary_min IS NOT NULL AND job_record.salary_max IS NOT NULL THEN
      -- 确保最小值不大于最大值
      IF job_record.salary_min > job_record.salary_max THEN
        issues_array := array_append(issues_array, 'min_greater_than_max');
        -- 交换值
        UPDATE jobs 
        SET salary_min = job_record.salary_max,
            salary_max = job_record.salary_min,
            updated_at = NOW()
        WHERE id = job_record.id;
      END IF;
    END IF;
    
    -- 检查异常值
    IF job_record.salary_min IS NOT NULL AND job_record.salary_min < 1000 THEN
      issues_array := array_append(issues_array, 'min_too_low');
    END IF;
    
    IF job_record.salary_max IS NOT NULL AND job_record.salary_max > 1000000 THEN
      issues_array := array_append(issues_array, 'max_too_high');
    END IF;
    
    -- 返回清理结果
    IF array_length(issues_array, 1) > 0 THEN
      RETURN QUERY SELECT 
        'jobs'::TEXT,
        job_record.id,
        job_record.salary_min,
        job_record.salary_max,
        job_record.salary_min,
        job_record.salary_max,
        issues_array;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- 计算薪资匹配度分数
CREATE OR REPLACE FUNCTION calculate_salary_match_score(
  candidate_min INT,
  candidate_max INT,
  job_min INT,
  job_max INT
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  c_min INT;
  c_max INT;
  j_min INT;
  j_max INT;
  overlap_min INT;
  overlap_max INT;
  overlap_size INT;
  total_size INT;
  distance INT;
  max_range INT;
BEGIN
  -- 处理空值
  c_min := COALESCE(candidate_min, 0);
  c_max := COALESCE(candidate_max, 2147483647); -- INT最大值
  j_min := COALESCE(job_min, 0);
  j_max := COALESCE(job_max, 2147483647);
  
  -- 计算重叠区间
  overlap_min := GREATEST(c_min, j_min);
  overlap_max := LEAST(c_max, j_max);
  
  IF overlap_min > overlap_max THEN
    -- 没有重叠，计算距离
    distance := LEAST(ABS(c_min - j_max), ABS(j_min - c_max));
    max_range := GREATEST(c_max - c_min, j_max - j_min);
    
    IF max_range = 0 THEN
      RETURN 0.0;
    END IF;
    
    RETURN GREATEST(0.0, 1.0 - (distance::FLOAT / max_range::FLOAT));
  ELSE
    -- 有重叠，计算重叠比例
    overlap_size := overlap_max - overlap_min;
    total_size := GREATEST(c_max - c_min, j_max - j_min);
    
    IF total_size = 0 THEN
      RETURN 1.0; -- 完全匹配
    END IF;
    
    RETURN LEAST(1.0, overlap_size::FLOAT / total_size::FLOAT);
  END IF;
END;
$$;

-- 增强的候选人搜索函数，包含薪资匹配度
CREATE OR REPLACE FUNCTION search_candidates_enhanced_rpc(
  query_embedding VECTOR(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min INT DEFAULT NULL,
  salary_max INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  include_salary_score BOOLEAN DEFAULT TRUE
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
  similarity FLOAT,
  salary_match_score FLOAT,
  combined_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
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
    (1 - (r.embedding <=> query_embedding))::FLOAT AS similarity,
    CASE 
      WHEN include_salary_score AND (salary_min IS NOT NULL OR salary_max IS NOT NULL) 
      THEN calculate_salary_match_score(r.expected_salary_min, r.expected_salary_max, salary_min, salary_max)
      ELSE 1.0
    END AS salary_match_score,
    CASE 
      WHEN include_salary_score AND (salary_min IS NOT NULL OR salary_max IS NOT NULL) 
      THEN (
        0.7 * (1 - (r.embedding <=> query_embedding)) + 
        0.3 * calculate_salary_match_score(r.expected_salary_min, r.expected_salary_max, salary_min, salary_max)
      )::FLOAT
      ELSE (1 - (r.embedding <=> query_embedding))::FLOAT
    END AS combined_score,
    r.created_at,
    r.updated_at
  FROM resumes r
  WHERE
    r.status = status_filter
    AND (1 - (r.embedding <=> query_embedding)) > similarity_threshold
    AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR r.skills && skills_filter)
    AND r.owner_id = auth.uid()
  ORDER BY 
    CASE 
      WHEN include_salary_score AND (salary_min IS NOT NULL OR salary_max IS NOT NULL) 
      THEN combined_score 
      ELSE similarity 
    END DESC
  LIMIT match_count;
END;
$$;

-- 增强的职位搜索函数，包含薪资匹配度
CREATE OR REPLACE FUNCTION search_jobs_enhanced_rpc(
  query_embedding VECTOR(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20,
  location_filter TEXT DEFAULT NULL,
  employment_type_filter TEXT DEFAULT NULL,
  salary_min_filter INT DEFAULT NULL,
  salary_max_filter INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  experience_required_filter INT DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  include_salary_score BOOLEAN DEFAULT TRUE
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
  similarity FLOAT,
  salary_match_score FLOAT,
  combined_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
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
    j.skills_required,
    j.experience_required,
    (1 - (j.embedding <=> query_embedding))::FLOAT AS similarity,
    CASE 
      WHEN include_salary_score AND (salary_min_filter IS NOT NULL OR salary_max_filter IS NOT NULL) 
      THEN calculate_salary_match_score(salary_min_filter, salary_max_filter, j.salary_min, j.salary_max)
      ELSE 1.0
    END AS salary_match_score,
    CASE 
      WHEN include_salary_score AND (salary_min_filter IS NOT NULL OR salary_max_filter IS NOT NULL) 
      THEN (
        0.7 * (1 - (j.embedding <=> query_embedding)) + 
        0.3 * calculate_salary_match_score(salary_min_filter, salary_max_filter, j.salary_min, j.salary_max)
      )::FLOAT
      ELSE (1 - (j.embedding <=> query_embedding))::FLOAT
    END AS combined_score,
    j.created_at,
    j.updated_at
  FROM jobs j
  WHERE
    j.status = status_filter
    AND (1 - (j.embedding <=> query_embedding)) > similarity_threshold
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (employment_type_filter IS NULL OR j.employment_type = employment_type_filter)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR j.skills_required && skills_filter)
    AND (experience_required_filter IS NULL OR j.experience_required <= experience_required_filter)
    AND j.owner_id = auth.uid()
  ORDER BY 
    CASE 
      WHEN include_salary_score AND (salary_min_filter IS NOT NULL OR salary_max_filter IS NOT NULL) 
      THEN combined_score 
      ELSE similarity 
    END DESC
  LIMIT match_count;
END;
$$;

-- 获取薪资统计信息
CREATE OR REPLACE FUNCTION get_salary_statistics_rpc()
RETURNS TABLE (
  entity_type TEXT,
  avg_min_salary FLOAT,
  avg_max_salary FLOAT,
  median_min_salary FLOAT,
  median_max_salary FLOAT,
  min_salary INT,
  max_salary INT,
  count_with_salary INT,
  total_count INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 候选人薪资统计
  RETURN QUERY
  SELECT 
    'candidates'::TEXT,
    AVG(expected_salary_min)::FLOAT,
    AVG(expected_salary_max)::FLOAT,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY expected_salary_min)::FLOAT,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY expected_salary_max)::FLOAT,
    MIN(LEAST(expected_salary_min, expected_salary_max)),
    MAX(GREATEST(expected_salary_min, expected_salary_max)),
    COUNT(*) FILTER (WHERE expected_salary_min IS NOT NULL OR expected_salary_max IS NOT NULL)::INT,
    COUNT(*)::INT
  FROM resumes
  WHERE status = 'active' AND owner_id = auth.uid();
  
  -- 职位薪资统计
  RETURN QUERY
  SELECT 
    'jobs'::TEXT,
    AVG(salary_min)::FLOAT,
    AVG(salary_max)::FLOAT,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_min)::FLOAT,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_max)::FLOAT,
    MIN(LEAST(salary_min, salary_max)),
    MAX(GREATEST(salary_min, salary_max)),
    COUNT(*) FILTER (WHERE salary_min IS NOT NULL OR salary_max IS NOT NULL)::INT,
    COUNT(*)::INT
  FROM jobs
  WHERE status = 'active' AND owner_id = auth.uid();
  
  RETURN;
END;
$$;

-- 薪资匹配建议函数
CREATE OR REPLACE FUNCTION get_salary_recommendations_rpc(
  candidate_id_param UUID DEFAULT NULL,
  job_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  recommendation_type TEXT,
  title TEXT,
  description TEXT,
  score FLOAT,
  details JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  candidate_record RECORD;
  job_record RECORD;
  match_score FLOAT;
  recommendation_details JSONB;
BEGIN
  -- 获取候选人信息
  IF candidate_id_param IS NOT NULL THEN
    SELECT * INTO candidate_record 
    FROM resumes 
    WHERE id = candidate_id_param AND owner_id = auth.uid();
  END IF;
  
  -- 获取职位信息
  IF job_id_param IS NOT NULL THEN
    SELECT * INTO job_record 
    FROM jobs 
    WHERE id = job_id_param AND owner_id = auth.uid();
  END IF;
  
  -- 如果有候选人和职位，计算匹配度
  IF candidate_record IS NOT NULL AND job_record IS NOT NULL THEN
    match_score := calculate_salary_match_score(
      candidate_record.expected_salary_min,
      candidate_record.expected_salary_max,
      job_record.salary_min,
      job_record.salary_max
    );
    
    recommendation_details := jsonb_build_object(
      'candidate_salary_min', candidate_record.expected_salary_min,
      'candidate_salary_max', candidate_record.expected_salary_max,
      'job_salary_min', job_record.salary_min,
      'job_salary_max', job_record.salary_max,
      'match_score', match_score
    );
    
    IF match_score >= 0.8 THEN
      RETURN QUERY SELECT 
        'high_match'::TEXT,
        '薪资期望高度匹配'::TEXT,
        '候选人的薪资期望与职位薪资范围重叠度很高，建议优先考虑'::TEXT,
        match_score,
        recommendation_details;
    ELSIF match_score >= 0.6 THEN
      RETURN QUERY SELECT 
        'medium_match'::TEXT,
        '薪资期望基本匹配'::TEXT,
        '候选人的薪资期望与职位薪资范围有部分重叠，可以进一步沟通'::TEXT,
        match_score,
        recommendation_details;
    ELSE
      RETURN QUERY SELECT 
        'low_match'::TEXT,
        '薪资期望存在差距'::TEXT,
        '候选人的薪资期望与职位薪资范围差距较大，需要评估是否可以调整'::TEXT,
        match_score,
        recommendation_details;
    END IF;
  END IF;
  
  RETURN;
END;
$$; 