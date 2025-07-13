-- 测试真实embedding向量
-- 使用API日志中的实际embedding向量

-- 1. 创建一个接近真实API调用的测试
-- 注意：这里我们需要使用一个真实的embedding向量，而不是测试向量

-- 首先检查现有数据的embedding向量格式
SELECT 
  name,
  substring(embedding::text, 1, 100) || '...' as embedding_preview,
  array_length(embedding::float[], 1) as embedding_dimension
FROM resumes 
WHERE owner_id = '98abb085-2969-46c5-b370-213a27a52f2e'
  AND embedding IS NOT NULL
LIMIT 1;

-- 2. 使用数据库中现有的embedding向量进行自我搜索测试
WITH existing_embedding AS (
  SELECT embedding::text as embedding_str
  FROM resumes 
  WHERE owner_id = '98abb085-2969-46c5-b370-213a27a52f2e'
    AND embedding IS NOT NULL
  LIMIT 1
)
SELECT 
  '使用现有embedding搜索' as test_name,
  name,
  current_title,
  location,
  similarity,
  status
FROM search_candidates_rpc(
  (SELECT embedding_str FROM existing_embedding),
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

-- 3. 检查embedding向量转换是否有问题
-- 模拟API中的向量格式化过程
WITH test_array AS (
  SELECT ARRAY[0.1, 0.2, 0.3] as test_nums
),
formatted_embedding AS (
  SELECT '[' || array_to_string(test_nums, ',') || ']' as embedding_str
  FROM test_array
)
SELECT 
  '向量格式化测试' as test_name,
  embedding_str,
  embedding_str::VECTOR(3) as parsed_vector
FROM formatted_embedding; 