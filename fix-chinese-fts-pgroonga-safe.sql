-- ============================================================================
-- 中文分词修复脚本 (PGroonga版本 - 安全版) - 修复搜索无结果问题
-- ============================================================================
-- 问题：chinese_zh配置使用default parser，无法正确处理中文分词
-- 解决：启用PGroonga扩展，这是专为中文等亚洲语言设计的全文搜索引擎
-- 安全版：增加了更多错误处理和NULL检查
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

-- Step 3: 为候选人表添加PGroonga全文搜索列
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

-- Step 4: 为职位表添加PGroonga全文搜索列
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

-- Step 5: 安全填充候选人PGroonga搜索内容（增强版错误处理）
UPDATE resumes SET pgroonga_content = 
  COALESCE(name, '') || ' ' ||
  COALESCE(current_title, '') || ' ' ||
  COALESCE(current_company, '') || ' ' ||
  COALESCE(location, '') || ' ' ||
  COALESCE(summary, '') || ' ' ||
  -- 安全处理skills数组
  CASE 
    WHEN skills IS NOT NULL AND array_length(skills, 1) > 0
    THEN array_to_string(skills, ' ')
    ELSE ''
  END || ' ' ||
  -- 安全处理experience JSONB
  CASE 
    WHEN experience IS NOT NULL AND jsonb_typeof(experience) = 'array'
    THEN COALESCE((
      SELECT string_agg(
        COALESCE(exp->>'title', '') || ' ' ||
        COALESCE(exp->>'company', '') || ' ' ||
        CASE 
          WHEN exp->'description' IS NOT NULL AND jsonb_typeof(exp->'description') = 'array'
          THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(exp->'description')), ' ')
          WHEN exp->>'description' IS NOT NULL
          THEN exp->>'description'
          ELSE ''
        END,
        ' '
      )
      FROM jsonb_array_elements(experience) exp
    ), '')
    ELSE ''
  END || ' ' ||
  -- 安全处理projects JSONB
  CASE 
    WHEN projects IS NOT NULL AND jsonb_typeof(projects) = 'array'
    THEN COALESCE((
      SELECT string_agg(
        COALESCE(proj->>'name', '') || ' ' ||
        COALESCE(proj->>'description', '') || ' ' ||
        CASE 
          WHEN proj->'tech_stack' IS NOT NULL AND jsonb_typeof(proj->'tech_stack') = 'array'
          THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(proj->'tech_stack')), ' ')
          ELSE ''
        END,
        ' '
      )
      FROM jsonb_array_elements(projects) proj
    ), '')
    ELSE ''
  END
WHERE pgroonga_content IS NULL OR pgroonga_content = '';

-- Step 6: 安全填充职位PGroonga搜索内容
UPDATE jobs SET pgroonga_content =
  COALESCE(title, '') || ' ' ||
  COALESCE(company, '') || ' ' ||
  COALESCE(location, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(requirements, '') || ' ' ||
  COALESCE(job_summary, '') || ' ' ||
  -- 安全处理skills_required数组
  CASE 
    WHEN skills_required IS NOT NULL AND array_length(skills_required, 1) > 0
    THEN array_to_string(skills_required, ' ')
    ELSE ''
  END || ' ' ||
  COALESCE(benefits, '') || ' ' ||
  COALESCE(industry, '') || ' ' ||
  COALESCE(department, '') || ' ' ||
  -- 安全处理growth_opportunities数组
  CASE 
    WHEN growth_opportunities IS NOT NULL AND array_length(growth_opportunities, 1) > 0
    THEN array_to_string(growth_opportunities, ' ')
    ELSE ''
  END
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

-- Step 8: 测试PGroonga中文搜索功能
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

-- 测试基本搜索
SELECT 'PGroonga Test - Basic search:' as test_type,
  COUNT(*) as match_count
FROM resumes 
WHERE pgroonga_content &@~ 'Java'
AND status = 'active';

-- 验证数据内容
SELECT 'Data Verification:' as test_type,
  COUNT(*) as total_resumes,
  COUNT(CASE WHEN pgroonga_content IS NOT NULL AND length(pgroonga_content) > 10 THEN 1 END) as with_content
FROM resumes;

-- 最终完成消息
DO $$
BEGIN
  RAISE NOTICE 'PGroonga Chinese FTS setup completed successfully!';
  RAISE NOTICE 'Please check the test results above:';
  RAISE NOTICE '- Match counts > 0 indicate successful setup';
  RAISE NOTICE '- Data verification shows content population status';
  RAISE NOTICE 'Next: Update your application to use PGroonga search';
END $$;

-- ============================================================================
-- 执行说明：
-- 1. 在Supabase SQL Editor中运行此脚本
-- 2. 检查所有测试结果 - 应该看到匹配数量 > 0
-- 3. 数据验证显示有多少记录成功填充了内容
-- 4. 如果测试通过，PGroonga搜索已就绪
-- 5. 应用程序将自动检测并使用新的搜索功能
-- ============================================================================ 