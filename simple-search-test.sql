-- 简单的搜索功能测试
-- 基于我们看到的数据进行测试

-- 1. 首先确认数据存在
SELECT 
    COUNT(*) as total_resumes,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding
FROM resumes 
WHERE status = 'active';

-- 2. 测试基本的向量相似度搜索（不使用RPC）
-- 创建一个测试向量（全零向量）
WITH test_vector AS (
    SELECT ('[' || repeat('0,', 1535) || '0]')::vector(1536) as query_embedding
)
SELECT 
    r.id,
    r.name,
    r.current_title,
    r.location,
    (1 - (r.embedding <=> tv.query_embedding)) as similarity
FROM resumes r, test_vector tv
WHERE r.status = 'active' 
  AND r.embedding IS NOT NULL
ORDER BY r.embedding <=> tv.query_embedding
LIMIT 5;

-- 3. 检查search_candidates_rpc函数是否存在
SELECT 
    routine_name,
    routine_type,
    specific_name
FROM information_schema.routines 
WHERE routine_name = 'search_candidates_rpc';

-- 4. 如果函数存在，测试调用（使用零向量）
-- 注意：这个测试可能会失败，这是正常的，我们只是想看看错误信息
DO $$
DECLARE
    test_embedding TEXT;
    result_count INTEGER;
BEGIN
    test_embedding := '[' || repeat('0,', 1535) || '0]';
    
    BEGIN
        SELECT COUNT(*) INTO result_count
        FROM search_candidates_rpc(
            test_embedding,
            0.0,
            10,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            'active',
            NULL
        );
        
        RAISE NOTICE 'RPC函数测试成功，返回结果数: %', result_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'RPC函数测试失败: %', SQLERRM;
    END;
END $$;

-- 5. 检查当前用户权限
SELECT 
    current_user as current_user,
    session_user as session_user;

-- 6. 检查RLS策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'resumes';

-- 7. 测试直接查询（模拟搜索API会做的事情）
SELECT 
    id,
    name,
    current_title,
    current_company,
    location,
    owner_id
FROM resumes 
WHERE status = 'active'
  AND embedding IS NOT NULL
LIMIT 5; 