-- ============================================================================
-- 中文分词修复脚本 (PGroonga版本) - 修复搜索无结果问题
-- ============================================================================
-- 问题：chinese_zh配置使用default parser，无法正确处理中文分词
-- 解决：启用PGroonga扩展，这是专为中文等亚洲语言设计的全文搜索引擎
-- 优势：PGroonga比jieba更强大，支持更好的中文分词和模糊匹配
-- ============================================================================

-- Step 1: 检查并启用PGroonga扩展
DO $$
BEGIN
  -- 检查pgroonga是否已安装
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgroonga') THEN
    CREATE EXTENSION IF NOT EXISTS pgroonga;
    RAISE NOTICE 'PGroonga extension enabled successfully';
  ELSE
    RAISE NOTICE 'PGroonga extension already exists';
  END IF;
END $$;

-- Step 2: 检查当前扩展状态
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pgroonga', 'vector');

-- Step 3: 为候选人表添加PGroonga全文搜索索引
-- 首先添加PGroonga搜索列（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'resumes' AND column_name = 'pgroonga_content') THEN
    ALTER TABLE resumes ADD COLUMN pgroonga_content TEXT;
    RAISE NOTICE 'Added pgroonga_content column to resumes table';
  ELSE
    RAISE NOTICE 'pgroonga_content column already exists in resumes table';
  END IF;
END $$;

-- Step 4: 为职位表添加PGroonga全文搜索索引
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'pgroonga_content') THEN
    ALTER TABLE jobs ADD COLUMN pgroonga_content TEXT;
    RAISE NOTICE 'Added pgroonga_content column to jobs table';
  ELSE
    RAISE NOTICE 'pgroonga_content column already exists in jobs table';
  END IF;
END $$;

-- Step 5: 填充候选人PGroonga搜索内容
UPDATE resumes SET pgroonga_content = 
  COALESCE(name, '') || ' ' ||
  COALESCE(current_title, '') || ' ' ||
  COALESCE(current_company, '') || ' ' ||
  COALESCE(location, '') || ' ' ||
  COALESCE(summary, '') || ' ' ||
  CASE 
    WHEN skills IS NOT NULL 
    THEN array_to_string(skills, ' ')
    ELSE ''
  END || ' ' ||
  CASE 
    WHEN experience IS NOT NULL 
    THEN (
      SELECT string_agg(
        COALESCE(exp->>'title', '') || ' ' ||
        COALESCE(exp->>'company', '') || ' ' ||
        COALESCE(array_to_string(ARRAY(SELECT jsonb_array_elements_text(exp->'description')), ' '), ''),
        ' '
      )
      FROM jsonb_array_elements(experience) exp
    )
    ELSE ''
  END || ' ' ||
  CASE 
    WHEN projects IS NOT NULL 
    THEN (
      SELECT string_agg(
        COALESCE(proj->>'name', '') || ' ' ||
        COALESCE(proj->>'description', '') || ' ' ||
        COALESCE(array_to_string(ARRAY(SELECT jsonb_array_elements_text(proj->'tech_stack')), ' '), ''),
        ' '
      )
      FROM jsonb_array_elements(projects) proj
    )
    ELSE ''
  END
WHERE pgroonga_content IS NULL OR pgroonga_content = '';

-- Step 6: 填充职位PGroonga搜索内容
UPDATE jobs SET pgroonga_content =
  COALESCE(title, '') || ' ' ||
  COALESCE(company, '') || ' ' ||
  COALESCE(location, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(requirements, '') || ' ' ||
  COALESCE(job_summary, '') || ' ' ||
  CASE 
    WHEN skills_required IS NOT NULL 
    THEN array_to_string(skills_required, ' ')
    ELSE ''
  END || ' ' ||
  COALESCE(benefits, '') || ' ' ||
  COALESCE(industry, '') || ' ' ||
  COALESCE(department, '')
WHERE pgroonga_content IS NULL OR pgroonga_content = '';

-- Step 7: 创建PGroonga全文搜索索引
-- 候选人表索引
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resumes_pgroonga') THEN
    CREATE INDEX idx_resumes_pgroonga ON resumes USING pgroonga (pgroonga_content);
    RAISE NOTICE 'Created PGroonga index for resumes table';
  ELSE
    RAISE NOTICE 'PGroonga index for resumes already exists';
  END IF;
END $$;

-- 职位表索引
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_jobs_pgroonga') THEN
    CREATE INDEX idx_jobs_pgroonga ON jobs USING pgroonga (pgroonga_content);
    RAISE NOTICE 'Created PGroonga index for jobs table';
  ELSE
    RAISE NOTICE 'PGroonga index for jobs already exists';
  END IF;
END $$;

-- Step 8: 创建改进的搜索函数，集成PGroonga和向量搜索
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
    r.pgroonga_content AS full_text_content
    
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

-- Step 9: 创建职位搜索函数，集成PGroonga
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
    j.pgroonga_content AS full_text_content
    
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

-- Step 10: 测试PGroonga中文搜索
DO $$
BEGIN
  RAISE NOTICE 'Testing PGroonga Chinese search functionality...';
END $$;

-- 测试中文全文搜索
SELECT 'PGroonga Test - Chinese search:' as test_type,
  COUNT(*) as match_count
FROM resumes 
WHERE pgroonga_content &@~ '5年 Java 开发'
AND status = 'active';

-- 测试职位搜索
SELECT 'PGroonga Test - Job search:' as test_type,
  COUNT(*) as match_count
FROM jobs 
WHERE pgroonga_content &@~ '前端 工程师'
AND status = 'active';

-- 测试模糊匹配
SELECT 'PGroonga Test - Fuzzy search:' as test_type,
  COUNT(*) as match_count
FROM resumes 
WHERE pgroonga_content &@~ 'React Vue JavaScript'
AND status = 'active';

-- 最终完成消息
DO $$
BEGIN
  RAISE NOTICE 'PGroonga Chinese FTS setup completed!';
  RAISE NOTICE 'New search functions created:';
  RAISE NOTICE '- search_candidates_with_pgroonga()';
  RAISE NOTICE '- search_jobs_with_pgroonga()';
  RAISE NOTICE 'Please check the test results above - match counts > 0 indicate success.';
END $$;

-- ============================================================================
-- 执行说明：
-- 1. 在Supabase SQL Editor中运行此脚本
-- 2. PGroonga是专门为中日韩语言设计的，比jieba更强大
-- 3. 新增了pgroonga_content列用于全文搜索
-- 4. 创建了集成向量+PGroonga的新搜索函数
-- 5. 验证测试查询返回正确的匹配数量
-- 6. 如需在代码中使用，请将RPC调用改为新的函数名
-- ============================================================================ 