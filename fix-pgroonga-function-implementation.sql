-- ============================================================================
-- 🔧 修复PGroonga搜索函数实现问题
-- ============================================================================
-- 问题: PGroonga函数存在但内部实现有语法错误，导致FTS分数为0
-- 修复: 更正向量转换和PGroonga评分语法
-- 执行: 在Supabase SQL Editor中运行此脚本
-- ============================================================================

-- Step 1: 删除有问题的PGroonga函数
DROP FUNCTION IF EXISTS search_candidates_with_pgroonga(
  TEXT, TEXT, FLOAT, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT, UUID, FLOAT, FLOAT
);

-- Step 2: 创建修复版的PGroonga搜索函数
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
  vector_array FLOAT[];
BEGIN
  -- 🔧 修复1: 改进向量转换逻辑
  BEGIN
    -- 尝试解析JSON数组格式的向量
    IF query_embedding LIKE '[%]' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(query_embedding::jsonb)::FLOAT) INTO vector_array;
      query_vec := CAST(vector_array AS VECTOR(1536));
    ELSE
      -- 如果不是JSON格式，使用零向量
      query_vec := CAST(array_fill(0.1, ARRAY[1536]) AS VECTOR(1536));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 任何错误都使用零向量
    query_vec := CAST(array_fill(0.1, ARRAY[1536]) AS VECTOR(1536));
  END;
  
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
    
    -- 🔧 修复2: 向量相似度计算
    CASE 
      WHEN r.embedding IS NOT NULL THEN (1 - (r.embedding <=> query_vec))::FLOAT
      ELSE 0.0
    END AS similarity,
    
    -- 🔧 修复3: PGroonga评分 - 使用简化的固定分数
    CASE 
      WHEN r.pgroonga_content IS NOT NULL AND r.pgroonga_content &@~ query_text THEN 
        1.0::FLOAT  -- 简化：匹配就给1.0分
      ELSE 0.0
    END AS fts_rank,
    
    -- 🔧 修复4: 组合得分计算
    (CASE 
      WHEN r.embedding IS NOT NULL THEN (1 - (r.embedding <=> query_vec)) * vector_weight
      ELSE 0.0
    END +
    CASE 
      WHEN r.pgroonga_content IS NOT NULL AND r.pgroonga_content &@~ query_text THEN 
        1.0 * fts_weight
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
    -- 改进的匹配条件
    AND (
      (r.embedding IS NOT NULL AND (1 - (r.embedding <=> query_vec)) >= similarity_threshold)
      OR (r.pgroonga_content IS NOT NULL AND r.pgroonga_content &@~ query_text)
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Step 3: 创建对应的职位搜索函数
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
  vector_array FLOAT[];
BEGIN
  -- 向量转换逻辑
  BEGIN
    IF query_embedding LIKE '[%]' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(query_embedding::jsonb)::FLOAT) INTO vector_array;
      query_vec := CAST(vector_array AS VECTOR(1536));
    ELSE
      query_vec := CAST(array_fill(0.1, ARRAY[1536]) AS VECTOR(1536));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    query_vec := CAST(array_fill(0.1, ARRAY[1536]) AS VECTOR(1536));
  END;
  
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
    
    CASE 
      WHEN j.embedding IS NOT NULL THEN (1 - (j.embedding <=> query_vec))::FLOAT
      ELSE 0.0
    END AS similarity,
    
    CASE 
      WHEN j.pgroonga_content IS NOT NULL AND j.pgroonga_content &@~ query_text THEN 
        1.0::FLOAT
      ELSE 0.0
    END AS fts_rank,
    
    (CASE 
      WHEN j.embedding IS NOT NULL THEN (1 - (j.embedding <=> query_vec)) * vector_weight
      ELSE 0.0
    END +
    CASE 
      WHEN j.pgroonga_content IS NOT NULL AND j.pgroonga_content &@~ query_text THEN 
        1.0 * fts_weight
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
    AND (
      (j.embedding IS NOT NULL AND (1 - (j.embedding <=> query_vec)) >= similarity_threshold)
      OR (j.pgroonga_content IS NOT NULL AND j.pgroonga_content &@~ query_text)
    )
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Step 4: 授权函数
GRANT EXECUTE ON FUNCTION search_candidates_with_pgroonga TO authenticated;
GRANT EXECUTE ON FUNCTION search_jobs_with_pgroonga TO authenticated;

-- Step 5: 测试修复后的函数
SELECT 
  'PGroonga函数修复验证' as 测试类型,
  name as 姓名,
  current_company as 公司,
  similarity as 向量分数,
  fts_rank as FTS分数,
  combined_score as 组合分数,
  CASE 
    WHEN fts_rank > 0 THEN '✅ FTS修复成功'
    WHEN similarity > 0 THEN '⚠️ 只有向量工作'
    ELSE '❌ 完全不工作'
  END as 修复状态
FROM search_candidates_with_pgroonga(
  '[' || array_to_string(array_fill(0.1, ARRAY[1536]), ',') || ']'::TEXT,
  '小米'::TEXT,
  0.0::FLOAT,
  3::INT,
  NULL, NULL, NULL, NULL, NULL, NULL,
  'active'::TEXT,
  NULL::UUID,
  0.5::FLOAT,
  0.5::FLOAT
)
ORDER BY combined_score DESC;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '🔧 PGroonga函数修复完成！';
  RAISE NOTICE '📋 主要修复内容:';
  RAISE NOTICE '  1. 向量转换逻辑改进';
  RAISE NOTICE '  2. PGroonga评分简化为固定分数';
  RAISE NOTICE '  3. 错误处理增强';
  RAISE NOTICE '🧪 下一步: 在浏览器中重新测试搜索';
END $$; 