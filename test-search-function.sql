-- 测试搜索函数是否正常工作
-- 在Supabase SQL Editor中执行此查询

-- 1. 检查函数是否存在
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name = 'search_candidates_rpc';

-- 2. 检查用户数据
SELECT 
  id,
  name,
  status,
  embedding IS NOT NULL as has_embedding,
  owner_id
FROM resumes 
WHERE owner_id = '98abb085-2969-46c5-b370-213a27a52f2e';

-- 3. 测试搜索函数（使用简单的测试向量）
WITH test_embedding AS (
  SELECT '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']' as embedding_str
)
SELECT 
  name,
  current_title,
  location,
  similarity,
  status
FROM search_candidates_rpc(
  (SELECT embedding_str FROM test_embedding),
  0.0,  -- similarity_threshold
  10,   -- match_count
  NULL, -- location_filter
  NULL, -- experience_min
  NULL, -- experience_max
  NULL, -- salary_min
  NULL, -- salary_max
  ARRAY[]::TEXT[], -- skills_filter
  'active', -- status_filter
  '98abb085-2969-46c5-b370-213a27a52f2e'::UUID -- user_id
); 