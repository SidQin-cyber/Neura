-- ============================================================================
-- 中文分词修复脚本 - 修复搜索无结果问题
-- ============================================================================
-- 问题：chinese_zh配置使用default parser，无法正确处理中文分词
-- 解决：启用pg_jieba扩展，配置jieba中文分词器，重建FTS索引
-- ============================================================================

-- Step 1: 检查并启用pg_jieba扩展
DO $$
BEGIN
  -- 检查pg_jieba是否已安装
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_jieba') THEN
    CREATE EXTENSION IF NOT EXISTS pg_jieba;
    RAISE NOTICE 'pg_jieba extension enabled successfully';
  ELSE
    RAISE NOTICE 'pg_jieba extension already exists';
  END IF;
END $$;

-- Step 2: 检查当前chinese_zh配置状态
SELECT 
  cfgname,
  (SELECT prsname FROM pg_ts_parser WHERE oid = cfgparser) as parser_name
FROM pg_ts_config 
WHERE cfgname = 'chinese_zh';

-- Step 3: 创建新的中文分词配置（如果需要）
DO $$
BEGIN
  -- 检查是否存在jieba parser
  IF EXISTS (SELECT 1 FROM pg_ts_parser WHERE prsname = 'jieba') THEN
    -- 删除旧的chinese_zh配置（如果存在）
    DROP TEXT SEARCH CONFIGURATION IF EXISTS chinese_zh CASCADE;
    
    -- 创建新的基于jieba的中文配置
    CREATE TEXT SEARCH CONFIGURATION chinese_zh (
      PARSER = jieba
    );
    
    -- 配置jieba分词器的token映射
    ALTER TEXT SEARCH CONFIGURATION chinese_zh
      ADD MAPPING FOR word, asciiword, asciihword, hword_asciipart, hword_part, hword_numpart
      WITH simple;
    
    RAISE NOTICE 'chinese_zh configuration updated to use jieba parser';
  ELSE
    RAISE NOTICE 'jieba parser not available, keeping current configuration';
  END IF;
END $$;

-- Step 4: 验证新配置
SELECT to_tsvector('chinese_zh', '寻找5年Java开发经验的后端工程师');
SELECT to_tsquery('chinese_zh', 'Java & 开发 & 工程师');

-- Step 5: 重建FTS索引（候选人表）
DO $$
BEGIN
  RAISE NOTICE 'Rebuilding FTS indexes for resumes table...';
END $$;

-- 重建候选人FTS文档
UPDATE resumes SET fts_document = to_tsvector('chinese_zh', 
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
) WHERE fts_document IS NOT NULL;

-- Step 6: 重建FTS索引（职位表）
DO $$
BEGIN
  RAISE NOTICE 'Rebuilding FTS indexes for jobs table...';
END $$;

-- 重建职位FTS文档
UPDATE jobs SET fts_document = to_tsvector('chinese_zh',
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
) WHERE fts_document IS NOT NULL;

-- Step 7: 重建GIN索引（如果存在）
-- 注意：REINDEX CONCURRENTLY 需要在事务外执行，这里提供手动执行的命令
DO $$
BEGIN
  RAISE NOTICE 'Please run these commands manually if indexes exist:';
  RAISE NOTICE 'REINDEX INDEX CONCURRENTLY idx_resumes_fts;';
  RAISE NOTICE 'REINDEX INDEX CONCURRENTLY idx_jobs_fts;';
END $$;

-- Step 8: 验证修复结果
DO $$
BEGIN
  RAISE NOTICE 'Testing Chinese FTS functionality...';
END $$;

-- 测试中文分词
SELECT 'FTS Test - Chinese tokenization:' as test_type,
  to_tsvector('chinese_zh', '寻找5年Java开发经验的全栈工程师') as tokenized_query;

-- 测试查询构建
SELECT 'FTS Test - Query building:' as test_type,
  websearch_to_tsquery('chinese_zh', '5年 Java 全栈 工程师') as built_query;

-- 测试实际搜索（候选人）
SELECT 'FTS Test - Resume search:' as test_type,
  COUNT(*) as match_count
FROM resumes 
WHERE fts_document @@ websearch_to_tsquery('chinese_zh', 'Java 开发')
AND status = 'active';

-- 测试实际搜索（职位）  
SELECT 'FTS Test - Job search:' as test_type,
  COUNT(*) as match_count
FROM jobs 
WHERE fts_document @@ websearch_to_tsquery('chinese_zh', '前端 工程师')
AND status = 'active';

-- 最终完成消息
DO $$
BEGIN
  RAISE NOTICE 'Chinese FTS configuration fix completed!';
  RAISE NOTICE 'If you see match counts > 0 above, the fix is working correctly.';
END $$;

-- ============================================================================
-- 执行说明：
-- 1. 在Supabase SQL Editor中运行此脚本
-- 2. 检查输出日志确认各步骤成功
-- 3. 验证测试查询返回正确的分词结果和匹配数量
-- 4. 如有错误，请检查pg_jieba扩展是否正确安装
-- 5. 如果需要重建索引，请手动执行Step 7中提到的REINDEX命令
-- ============================================================================ 