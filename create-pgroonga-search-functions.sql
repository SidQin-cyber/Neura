-- ============================================================================
-- 创建PGroonga搜索函数 - 集成向量和PGroonga全文搜索
-- ============================================================================

-- 创建候选人搜索函数，集成PGroonga和向量搜索
CREATE OR REPLACE FUNCTION search_candidates_with_pgroonga(
  query_embedding TEXT,
  query_text TEXT,
  similarity_threshold FLOAT DEFAULT 0.05,
  match_count INT DEFAULT 100,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min INT DEFAULT NULL,
  salary_max INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  user_id_param UUID DEFAULT NULL,
  fts_weight FLOAT DEFAULT 0.3,
  vector_weight FLOAT DEFAULT 0.7
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
  summary TEXT,
  relocation_preferences TEXT[],
  projects JSONB,
  status TEXT,
  similarity FLOAT,
  fts_rank FLOAT,
  combined_score FLOAT,
  full_text_content TEXT
) AS $$
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
    r.summary,
    r.relocation_preferences,
    r.projects,
    r.status,
    (1 - (r.embedding <=> query_vec))::FLOAT AS similarity,
    -- 使用PGroonga计算相似度分数
    CASE 
      WHEN r.pgroonga_content &@~ query_text THEN 
        pgroonga_score(tableoid, ctid)::FLOAT
      ELSE 0.0
    END AS fts_rank,
    -- 组合得分：向量相似度 + PGroonga得分
    ((1 - (r.embedding <=> query_vec)) * vector_weight +
      CASE 
        WHEN r.pgroonga_content &@~ query_text THEN 
          pgroonga_score(tableoid, ctid) * fts_weight
        ELSE 0.0
      END)::FLOAT AS combined_score,
    COALESCE(r.pgroonga_content, '') AS full_text_content
    
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
    -- 混合搜索条件：向量相似度或PGroonga全文匹配
    AND ((1 - (r.embedding <=> query_vec)) >= similarity_threshold
         OR r.pgroonga_content &@~ query_text)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 创建职位搜索函数，集成PGroonga
CREATE OR REPLACE FUNCTION search_jobs_with_pgroonga(
  query_embedding TEXT,
  query_text TEXT,
  similarity_threshold FLOAT DEFAULT 0.05,
  match_count INT DEFAULT 100,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min_filter INT DEFAULT NULL,
  salary_max_filter INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  fts_weight FLOAT DEFAULT 0.3,
  vector_weight FLOAT DEFAULT 0.7
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
  job_summary TEXT,
  team_info JSONB,
  growth_opportunities TEXT[],
  work_environment TEXT,
  company_culture TEXT,
  remote_policy TEXT,
  urgency_level TEXT,
  status TEXT,
  similarity FLOAT,
  fts_rank FLOAT,
  combined_score FLOAT,
  full_text_content TEXT
) AS $$
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
    j.job_summary,
    j.team_info,
    j.growth_opportunities,
    j.work_environment,
    j.company_culture,
    j.remote_policy,
    j.urgency_level,
    j.status,
    (1 - (j.embedding <=> query_vec))::FLOAT AS similarity,
    -- 使用PGroonga计算相似度分数
    CASE 
      WHEN j.pgroonga_content &@~ query_text THEN 
        pgroonga_score(tableoid, ctid)::FLOAT
      ELSE 0.0
    END AS fts_rank,
    -- 组合得分
    ((1 - (j.embedding <=> query_vec)) * vector_weight +
      CASE 
        WHEN j.pgroonga_content &@~ query_text THEN 
          pgroonga_score(tableoid, ctid) * fts_weight
        ELSE 0.0
      END)::FLOAT AS combined_score,
    COALESCE(j.pgroonga_content, '') AS full_text_content
    
  FROM jobs j
  WHERE 
    j.status = status_filter
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR j.experience_required >= experience_min)
    AND (experience_max IS NULL OR j.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR cardinality(skills_filter) = 0 OR j.skills_required && skills_filter)
    -- 混合搜索条件
    AND ((1 - (j.embedding <=> query_vec)) >= similarity_threshold
         OR j.pgroonga_content &@~ query_text)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 测试新函数
DO $$
BEGIN
  RAISE NOTICE 'PGroonga search functions created successfully!';
  RAISE NOTICE 'Functions available:';
  RAISE NOTICE '- search_candidates_with_pgroonga()';
  RAISE NOTICE '- search_jobs_with_pgroonga()';
END $$; 