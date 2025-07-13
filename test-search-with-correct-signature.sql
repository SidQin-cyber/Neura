-- 使用正确函数签名测试搜索功能
-- 在 Supabase SQL 编辑器中运行此脚本

-- 1. 检查函数是否存在并查看其签名
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
WHERE p.proname IN ('search_candidates_rpc', 'search_jobs_rpc')
ORDER BY p.proname;

-- 2. 检查数据是否存在
SELECT 
    'resumes' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN owner_id IS NULL THEN 1 END) as null_owner_count,
    COUNT(CASE WHEN has_embedding = 'YES' THEN 1 END) as has_embedding_count
FROM resumes
WHERE status = 'active'
UNION ALL
SELECT 
    'jobs' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN owner_id IS NULL THEN 1 END) as null_owner_count,
    COUNT(CASE WHEN has_embedding = 'YES' THEN 1 END) as has_embedding_count
FROM jobs
WHERE status = 'active';

-- 3. 创建测试向量（1536维，全为0.1的向量）
-- 注意：这里使用TEXT格式，符合函数签名要求
WITH test_vector AS (
  SELECT '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']' as embedding_text
)
SELECT 
  'Test Vector Created' as message,
  length(embedding_text) as vector_text_length,
  left(embedding_text, 50) || '...' as vector_sample
FROM test_vector;

-- 4. 测试候选人搜索函数（使用正确的参数类型）
SELECT 'Testing candidate search...' as test_description;

WITH test_vector AS (
  SELECT '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']' as embedding_text
)
SELECT 
  id,
  name,
  current_title,
  location,
  similarity
FROM search_candidates_rpc(
  (SELECT embedding_text FROM test_vector), -- query_embedding TEXT
  0.0,        -- similarity_threshold
  10,         -- match_count
  NULL,       -- location_filter
  NULL,       -- experience_min
  NULL,       -- experience_max
  NULL,       -- salary_min
  NULL,       -- salary_max
  NULL,       -- skills_filter
  'active',   -- status_filter
  NULL        -- user_id (测试NULL owner_id问题)
);

-- 5. 测试职位搜索函数
SELECT 'Testing job search...' as test_description;

WITH test_vector AS (
  SELECT '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']' as embedding_text
)
SELECT 
  id,
  title,
  company,
  location,
  similarity
FROM search_jobs_rpc(
  (SELECT embedding_text FROM test_vector), -- query_embedding TEXT
  0.0,        -- similarity_threshold
  10,         -- match_count
  NULL,       -- location_filter
  NULL,       -- experience_min
  NULL,       -- experience_max
  NULL,       -- salary_min_filter
  NULL,       -- salary_max_filter
  NULL,       -- skills_filter
  'active',   -- status_filter
  NULL        -- user_id (测试NULL owner_id问题)
);

-- 6. 统计搜索结果
WITH test_vector AS (
  SELECT '[' || array_to_string(array_fill(0.1::text, ARRAY[1536]), ',') || ']' as embedding_text
)
SELECT 
  'Search Results Summary' as summary,
  (SELECT COUNT(*) FROM search_candidates_rpc(
    (SELECT embedding_text FROM test_vector), 0.0, 10, NULL, NULL, NULL, NULL, NULL, NULL, 'active', NULL
  )) as candidate_results,
  (SELECT COUNT(*) FROM search_jobs_rpc(
    (SELECT embedding_text FROM test_vector), 0.0, 10, NULL, NULL, NULL, NULL, NULL, NULL, 'active', NULL
  )) as job_results;

-- 7. 检查实际embedding数据格式
SELECT 
  'Actual Embedding Check' as check_type,
  name,
  current_title,
  CASE 
    WHEN embedding IS NOT NULL THEN 'Has Embedding'
    ELSE 'No Embedding'
  END as embedding_status,
  length(embedding::text) as embedding_text_length,
  left(embedding::text, 100) || '...' as embedding_sample
FROM resumes
WHERE status = 'active' AND embedding IS NOT NULL
LIMIT 3; 