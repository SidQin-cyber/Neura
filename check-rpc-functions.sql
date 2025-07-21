-- 检查RPC函数是否存在
-- 在Supabase SQL Editor中执行此脚本

-- 1. 检查search_candidates_rpc函数是否存在
SELECT 
  proname as function_name,
  pronargs as argument_count,
  proargnames as argument_names,
  prosrc LIKE '%combined_score%' as has_hybrid_logic
FROM pg_proc 
WHERE proname = 'search_candidates_rpc'
ORDER BY oid DESC;

-- 2. 检查resumes表是否有必要的字段和数据
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'resumes' 
AND column_name IN ('embedding', 'fts_document', 'owner_id', 'status')
ORDER BY column_name;

-- 3. 检查是否有候选人数据
SELECT 
  status,
  COUNT(*) as count,
  COUNT(embedding) as with_embedding,
  COUNT(fts_document) as with_fts
FROM resumes 
GROUP BY status;

-- 4. 检查FTS配置
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'resumes' 
AND indexname LIKE '%fts%';

-- 5. 如果函数不存在，重新创建
-- 从以下文件中复制函数定义：
-- supabase/migrations/20240102000000_search_functions.sql

-- 如果需要，执行以下命令重新应用迁移：
-- supabase db reset
-- 或者手动复制粘贴函数定义 