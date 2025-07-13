-- 修复函数重载冲突问题 - 简化版本
-- 删除所有冲突的函数，让现有的函数正常工作

-- 删除所有可能的 search_candidates_rpc 函数版本
DROP FUNCTION IF EXISTS search_candidates_rpc CASCADE;

-- 删除所有可能的 search_jobs_rpc 函数版本
DROP FUNCTION IF EXISTS search_jobs_rpc CASCADE;

-- 确保 vector 扩展已安装
CREATE EXTENSION IF NOT EXISTS vector;

-- 验证函数删除成功
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'search_candidates_rpc' 
    AND routine_type = 'FUNCTION'
  ) THEN
    RAISE NOTICE '✅ search_candidates_rpc 函数已删除';
  ELSE
    RAISE NOTICE '❌ search_candidates_rpc 函数仍然存在';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'search_jobs_rpc' 
    AND routine_type = 'FUNCTION'
  ) THEN
    RAISE NOTICE '✅ search_jobs_rpc 函数已删除';
  ELSE
    RAISE NOTICE '❌ search_jobs_rpc 函数仍然存在';
  END IF;
END $$;
