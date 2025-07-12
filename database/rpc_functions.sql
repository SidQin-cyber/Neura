-- Neura AI招聘平台RPC函数
-- 用于向量搜索和数据查询

-- 候选人语义搜索函数
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
    AND (1 - (r.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY r.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 职位语义搜索函数
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
    AND (1 - (j.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY j.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 获取匹配度最高的候选人-职位配对
CREATE OR REPLACE FUNCTION get_candidate_job_matches_rpc(
  candidate_id_filter UUID DEFAULT NULL,
  job_id_filter UUID DEFAULT NULL,
  match_count INT DEFAULT 10,
  min_score FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  candidate_id UUID,
  job_id UUID,
  candidate_name TEXT,
  candidate_title TEXT,
  job_title TEXT,
  job_company TEXT,
  ai_score FLOAT,
  manual_score FLOAT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.candidate_id,
    m.job_id,
    r.name AS candidate_name,
    r.current_title AS candidate_title,
    j.title AS job_title,
    j.company AS job_company,
    m.ai_score,
    m.manual_score,
    m.status,
    m.created_at
  FROM candidate_job_matches m
  JOIN resumes r ON m.candidate_id = r.id
  JOIN jobs j ON m.job_id = j.id
  WHERE
    (candidate_id_filter IS NULL OR m.candidate_id = candidate_id_filter)
    AND (job_id_filter IS NULL OR m.job_id = job_id_filter)
    AND (m.ai_score >= min_score OR m.manual_score >= min_score)
    AND (r.owner_id = auth.uid() OR j.owner_id = auth.uid())
  ORDER BY COALESCE(m.manual_score, m.ai_score) DESC
  LIMIT match_count;
END;
$$;

-- 生成AI匹配分数
CREATE OR REPLACE FUNCTION generate_ai_match_score(
  candidate_embedding VECTOR(1536),
  job_embedding VECTOR(1536)
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  similarity FLOAT;
BEGIN
  -- 计算余弦相似度
  similarity := 1 - (candidate_embedding <=> job_embedding);
  
  -- 转换为0-1之间的分数
  RETURN GREATEST(0, LEAST(1, similarity));
END;
$$;

-- 批量生成候选人-职位匹配
CREATE OR REPLACE FUNCTION batch_generate_matches_rpc(
  candidate_ids UUID[] DEFAULT NULL,
  job_ids UUID[] DEFAULT NULL,
  min_score FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  candidate_id UUID,
  job_id UUID,
  score FLOAT,
  created BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  candidate_record RECORD;
  job_record RECORD;
  match_score FLOAT;
  match_exists BOOLEAN;
BEGIN
  -- 如果没有指定候选人，则使用所有活跃候选人
  IF candidate_ids IS NULL THEN
    SELECT array_agg(id) INTO candidate_ids FROM resumes WHERE status = 'active' AND owner_id = auth.uid();
  END IF;
  
  -- 如果没有指定职位，则使用所有活跃职位
  IF job_ids IS NULL THEN
    SELECT array_agg(id) INTO job_ids FROM jobs WHERE status = 'active' AND owner_id = auth.uid();
  END IF;
  
  -- 遍历候选人和职位，生成匹配
  FOR candidate_record IN 
    SELECT id, embedding FROM resumes WHERE id = ANY(candidate_ids) AND owner_id = auth.uid()
  LOOP
    FOR job_record IN 
      SELECT id, embedding FROM jobs WHERE id = ANY(job_ids) AND owner_id = auth.uid()
    LOOP
      -- 计算匹配分数
      match_score := generate_ai_match_score(candidate_record.embedding, job_record.embedding);
      
      -- 只处理超过最低分数的匹配
      IF match_score >= min_score THEN
        -- 检查是否已存在匹配
        SELECT EXISTS(
          SELECT 1 FROM candidate_job_matches 
          WHERE candidate_id = candidate_record.id AND job_id = job_record.id
        ) INTO match_exists;
        
        -- 如果不存在，则创建新匹配
        IF NOT match_exists THEN
          INSERT INTO candidate_job_matches (candidate_id, job_id, ai_score)
          VALUES (candidate_record.id, job_record.id, match_score);
          
          RETURN QUERY SELECT candidate_record.id, job_record.id, match_score, true;
        ELSE
          -- 如果存在，则更新AI分数
          UPDATE candidate_job_matches 
          SET ai_score = match_score, updated_at = NOW()
          WHERE candidate_id = candidate_record.id AND job_id = job_record.id;
          
          RETURN QUERY SELECT candidate_record.id, job_record.id, match_score, false;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN;
END;
$$;

-- 批量生成候选人-职位匹配
CREATE OR REPLACE FUNCTION generate_candidate_job_matches_batch(
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  candidate_id UUID,
  job_id UUID,
  ai_score FLOAT,
  status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as candidate_id,
    j.id as job_id,
    generate_ai_match_score(r.embedding, j.embedding) as ai_score,
    'pending'::TEXT as status
  FROM resumes r
  CROSS JOIN jobs j
  WHERE r.status = 'active' 
    AND j.status = 'active'
    AND r.owner_id = auth.uid()
    AND j.owner_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM candidate_job_matches m 
      WHERE m.candidate_id = r.id AND m.job_id = j.id
    )
  ORDER BY generate_ai_match_score(r.embedding, j.embedding) DESC
  LIMIT limit_count;
END;
$$;

-- 插入候选人数据的函数，确保embedding正确存储
CREATE OR REPLACE FUNCTION insert_candidate_with_embedding(
  p_owner_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_current_title TEXT,
  p_current_company TEXT,
  p_location TEXT,
  p_years_of_experience INT,
  p_expected_salary_min INT,
  p_expected_salary_max INT,
  p_skills TEXT[],
  p_education JSONB,
  p_experience JSONB,
  p_certifications JSONB,
  p_languages JSONB,
  p_raw_data JSONB,
  p_status TEXT,
  p_embedding TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO resumes (owner_id, name, email, phone, current_title, current_company, location, years_of_experience, expected_salary_min, expected_salary_max, skills, education, experience, certifications, languages, raw_data, status, embedding)
  VALUES (p_owner_id, p_name, p_email, p_phone, p_current_title, p_current_company, p_location, p_years_of_experience, p_expected_salary_min, p_expected_salary_max, p_skills, p_education, p_experience, p_certifications, p_languages, p_raw_data, p_status, p_embedding::VECTOR(1536))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- 插入职位数据的函数，确保embedding正确存储
CREATE OR REPLACE FUNCTION insert_job_with_embedding(
  p_owner_id UUID,
  p_title TEXT,
  p_company TEXT,
  p_location TEXT,
  p_employment_type TEXT,
  p_salary_min INT,
  p_salary_max INT,
  p_currency TEXT,
  p_description TEXT,
  p_requirements TEXT,
  p_benefits TEXT,
  p_skills_required TEXT[],
  p_experience_required INT,
  p_education_required TEXT,
  p_industry TEXT,
  p_department TEXT,
  p_status TEXT,
  p_embedding TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO jobs (owner_id, title, company, location, employment_type, salary_min, salary_max, currency, description, requirements, benefits, skills_required, experience_required, education_required, industry, department, status, embedding)
  VALUES (p_owner_id, p_title, p_company, p_location, p_employment_type, p_salary_min, p_salary_max, p_currency, p_description, p_requirements, p_benefits, p_skills_required, p_experience_required, p_education_required, p_industry, p_department, p_status, p_embedding::VECTOR(1536))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- 获取用户的搜索统计信息
CREATE OR REPLACE FUNCTION get_search_stats_rpc(
  user_id UUID DEFAULT NULL,
  days_back INT DEFAULT 30
)
RETURNS TABLE (
  total_searches INT,
  candidate_searches INT,
  job_searches INT,
  avg_results_per_search FLOAT,
  most_common_location TEXT,
  search_trends JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id UUID;
  since_date TIMESTAMP WITH TIME ZONE;
BEGIN
  target_user_id := COALESCE(user_id, auth.uid());
  since_date := NOW() - INTERVAL '%d days' % days_back;
  
  RETURN QUERY
  SELECT
    COUNT(*)::INT AS total_searches,
    COUNT(CASE WHEN search_type = 'candidate' THEN 1 END)::INT AS candidate_searches,
    COUNT(CASE WHEN search_type = 'job' THEN 1 END)::INT AS job_searches,
    AVG(results_count)::FLOAT AS avg_results_per_search,
    MODE() WITHIN GROUP (ORDER BY filters->>'location') AS most_common_location,
    jsonb_agg(
      jsonb_build_object(
        'date', DATE(created_at),
        'searches', COUNT(*)
      )
    ) AS search_trends
  FROM search_history
  WHERE user_id = target_user_id
    AND created_at >= since_date
  GROUP BY user_id;
END;
$$;

-- 获取候选人详细信息包含相关统计
CREATE OR REPLACE FUNCTION get_candidate_details_rpc(candidate_id_param UUID)
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
  file_url TEXT,
  total_matches INT,
  total_interactions INT,
  last_interaction_date TIMESTAMP WITH TIME ZONE,
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
    r.file_url,
    COALESCE(m.total_matches, 0)::INT AS total_matches,
    COALESCE(i.total_interactions, 0)::INT AS total_interactions,
    i.last_interaction_date,
    r.created_at,
    r.updated_at
  FROM resumes r
  LEFT JOIN (
    SELECT candidate_id, COUNT(*) AS total_matches
    FROM candidate_job_matches
    WHERE candidate_id = candidate_id_param
    GROUP BY candidate_id
  ) m ON r.id = m.candidate_id
  LEFT JOIN (
    SELECT candidate_id, COUNT(*) AS total_interactions, MAX(created_at) AS last_interaction_date
    FROM interactions
    WHERE candidate_id = candidate_id_param
    GROUP BY candidate_id
  ) i ON r.id = i.candidate_id
  WHERE r.id = candidate_id_param
    AND r.owner_id = auth.uid();
END;
$$; 