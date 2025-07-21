-- ============================================================================
-- 🚀 PGroonga手动设置脚本
-- ============================================================================
-- 问题: PGroonga扩展已安装，但pgroonga_content内容为空，导致FTS搜索无效
-- 解决: 手动填充PGroonga内容并创建索引
-- 执行: 在Supabase SQL Editor中运行此脚本
-- ============================================================================

-- Step 1: 检查PGroonga扩展状态
SELECT 
  extname as 扩展名, 
  extversion as 版本,
  CASE WHEN extname = 'pgroonga' THEN '✅ 高级中文搜索已安装' ELSE '' END as 状态
FROM pg_extension 
WHERE extname = 'pgroonga';

-- Step 2: 确保pgroonga_content列存在
DO $$
BEGIN
  -- 候选人表
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'resumes' AND column_name = 'pgroonga_content') THEN
    ALTER TABLE resumes ADD COLUMN pgroonga_content TEXT;
    RAISE NOTICE '✅ 已添加resumes.pgroonga_content列';
  ELSE
    RAISE NOTICE 'ℹ️  resumes.pgroonga_content列已存在';
  END IF;
  
  -- 职位表
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'pgroonga_content') THEN
    ALTER TABLE jobs ADD COLUMN pgroonga_content TEXT;
    RAISE NOTICE '✅ 已添加jobs.pgroonga_content列';
  ELSE
    RAISE NOTICE 'ℹ️  jobs.pgroonga_content列已存在';
  END IF;
END $$;

-- Step 3: 填充候选人PGroonga搜索内容
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
  -- 工作经验内容
  CASE 
    WHEN experience IS NOT NULL 
    THEN (
      SELECT string_agg(
        COALESCE(exp->>'title', '') || ' ' ||
        COALESCE(exp->>'company', '') || ' ' ||
        COALESCE(exp->>'description', ''),
        ' '
      )
      FROM jsonb_array_elements(experience) exp
    )
    ELSE ''
  END || ' ' ||
  -- 项目经验内容
  CASE 
    WHEN projects IS NOT NULL 
    THEN (
      SELECT string_agg(
        COALESCE(proj->>'name', '') || ' ' ||
        COALESCE(proj->>'description', ''),
        ' '
      )
      FROM jsonb_array_elements(projects) proj
    )
    ELSE ''
  END
WHERE pgroonga_content IS NULL OR pgroonga_content = '';

-- Step 4: 填充职位PGroonga搜索内容
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

-- Step 5: 创建PGroonga全文搜索索引
-- 删除旧索引（如果存在）
DROP INDEX IF EXISTS idx_resumes_pgroonga;
DROP INDEX IF EXISTS idx_jobs_pgroonga;

-- 创建新的PGroonga索引
CREATE INDEX idx_resumes_pgroonga ON resumes USING pgroonga (pgroonga_content);
CREATE INDEX idx_jobs_pgroonga ON jobs USING pgroonga (pgroonga_content);

-- Step 6: 验证设置结果
SELECT 
  'resumes表PGroonga内容检查' as 检查项目,
  COUNT(*) as 总行数,
  COUNT(pgroonga_content) as 有内容行数,
  COUNT(CASE WHEN pgroonga_content IS NOT NULL AND pgroonga_content != '' THEN 1 END) as 非空内容行数,
  CASE 
    WHEN COUNT(CASE WHEN pgroonga_content IS NOT NULL AND pgroonga_content != '' THEN 1 END) > 0 
    THEN '✅ PGroonga内容已设置' 
    ELSE '❌ PGroonga内容为空' 
  END as 状态
FROM resumes
WHERE status = 'active'

UNION ALL

SELECT 
  'jobs表PGroonga内容检查' as 检查项目,
  COUNT(*) as 总行数,
  COUNT(pgroonga_content) as 有内容行数,
  COUNT(CASE WHEN pgroonga_content IS NOT NULL AND pgroonga_content != '' THEN 1 END) as 非空内容行数,
  CASE 
    WHEN COUNT(CASE WHEN pgroonga_content IS NOT NULL AND pgroonga_content != '' THEN 1 END) > 0 
    THEN '✅ PGroonga内容已设置' 
    ELSE '❌ PGroonga内容为空' 
  END as 状态
FROM jobs
WHERE status = 'active';

-- Step 7: 检查索引状态
SELECT 
  indexname as 索引名,
  tablename as 表名,
  CASE 
    WHEN indexname LIKE '%pgroonga%' THEN '✅ PGroonga索引'
    ELSE '普通索引'
  END as 索引类型
FROM pg_indexes 
WHERE indexname LIKE '%pgroonga%';

-- Step 8: 测试PGroonga中文搜索
-- 注意：这只是内容检查，实际搜索需要通过RPC函数
SELECT 
  'PGroonga中文搜索测试' as 测试类型,
  name as 候选人姓名,
  current_company as 当前公司,
  CASE 
    WHEN pgroonga_content &@~ '小米' THEN '✅ 匹配"小米"'
    ELSE '❌ 不匹配"小米"'
  END as 小米搜索,
  CASE 
    WHEN pgroonga_content &@~ '前端' THEN '✅ 匹配"前端"'
    ELSE '❌ 不匹配"前端"'
  END as 前端搜索
FROM resumes 
WHERE status = 'active'
LIMIT 5;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '🎉 PGroonga设置完成！';
  RAISE NOTICE '📋 下一步: 在浏览器控制台运行 test-pgroonga-status.js 验证搜索效果';
  RAISE NOTICE '🚀 预期结果: FTS分数 > 0，"小米"搜索排名显著提升';
END $$; 