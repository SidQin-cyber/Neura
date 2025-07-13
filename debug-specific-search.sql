-- 详细调试搜索问题
-- 逐步检查每个筛选条件

-- 1. 检查基础数据
SELECT 
  '基础数据检查' as step,
  id,
  name,
  status,
  owner_id,
  embedding IS NOT NULL as has_embedding,
  created_at
FROM resumes 
WHERE owner_id = '98abb085-2969-46c5-b370-213a27a52f2e';

-- 2. 检查状态筛选
SELECT 
  '状态筛选检查' as step,
  COUNT(*) as total_count,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
  COUNT(CASE WHEN status = 'active' AND embedding IS NOT NULL THEN 1 END) as active_with_embedding
FROM resumes 
WHERE owner_id = '98abb085-2969-46c5-b370-213a27a52f2e';

-- 3. 测试搜索函数（逐步放宽条件）
WITH test_embedding AS (
  SELECT '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']' as embedding_str
)
SELECT 
  '搜索测试1: 无阈值限制' as test_name,
  COUNT(*) as result_count
FROM search_candidates_rpc(
  (SELECT embedding_str FROM test_embedding),
  0.0,  -- similarity_threshold = 0
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

-- 4. 测试不限制用户ID
WITH test_embedding AS (
  SELECT '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']' as embedding_str
)
SELECT 
  '搜索测试2: 不限制用户ID' as test_name,
  COUNT(*) as result_count
FROM search_candidates_rpc(
  (SELECT embedding_str FROM test_embedding),
  0.0,  -- similarity_threshold = 0
  10,   -- match_count
  NULL, -- location_filter
  NULL, -- experience_min
  NULL, -- experience_max
  NULL, -- salary_min
  NULL, -- salary_max
  ARRAY[]::TEXT[], -- skills_filter
  'active', -- status_filter
  NULL -- user_id = NULL (不限制)
);

-- 5. 检查embedding向量的实际相似度
WITH test_embedding AS (
  SELECT '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']' as embedding_str
)
SELECT 
  '相似度检查' as step,
  r.name,
  r.status,
  r.owner_id,
  (1 - (r.embedding <=> (SELECT embedding_str FROM test_embedding)::VECTOR(1536))) as similarity
FROM resumes r
WHERE r.owner_id = '98abb085-2969-46c5-b370-213a27a52f2e'
  AND r.embedding IS NOT NULL;

-- 6. 检查所有WHERE条件
WITH test_embedding AS (
  SELECT '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']' as embedding_str
)
SELECT 
  '条件检查' as step,
  r.name,
  r.status = 'active' as status_match,
  r.embedding IS NOT NULL as has_embedding,
  r.owner_id = '98abb085-2969-46c5-b370-213a27a52f2e' as owner_match,
  (1 - (r.embedding <=> (SELECT embedding_str FROM test_embedding)::VECTOR(1536))) >= 0.0 as similarity_match
FROM resumes r
WHERE r.owner_id = '98abb085-2969-46c5-b370-213a27a52f2e'; 