-- 调试现有搜索函数
-- 检查为什么搜索函数返回0结果

-- 1. 检查现有的 search_candidates_rpc 函数定义
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'search_candidates_rpc';

-- 2. 检查候选人数据表结构
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns
WHERE table_name IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name LIKE '%candidate%' OR table_name LIKE '%resume%'
)
ORDER BY table_name, ordinal_position;

-- 3. 检查有数据的表
SELECT 
    'candidates' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding
FROM candidates
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidates')

UNION ALL

SELECT 
    'resumes' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding
FROM resumes
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes');

-- 4. 检查特定用户的数据
SELECT 
    'User Data Check' as test_name,
    id,
    name,
    status,
    owner_id,
    embedding IS NOT NULL as has_embedding,
    CASE WHEN embedding IS NOT NULL THEN pg_typeof(embedding)::text ELSE 'NULL' END as embedding_type
FROM candidates
WHERE owner_id = '98abb085-2969-46c5-b370-213a27a52f2e'
LIMIT 5;

-- 5. 测试现有搜索函数的参数
-- 创建一个简单的测试函数
CREATE OR REPLACE FUNCTION debug_search_candidates()
RETURNS TABLE(
    test_name text,
    result text,
    details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    test_embedding vector(1536);
    direct_count int;
    function_count int;
    user_id_test uuid := '98abb085-2969-46c5-b370-213a27a52f2e';
BEGIN
    -- 获取一个测试用的 embedding
    SELECT embedding INTO test_embedding 
    FROM candidates 
    WHERE embedding IS NOT NULL 
    AND owner_id = user_id_test
    LIMIT 1;
    
    -- 测试1: 直接查询数据
    SELECT COUNT(*) INTO direct_count
    FROM candidates
    WHERE owner_id = user_id_test
    AND status = 'active'
    AND embedding IS NOT NULL;
    
    RETURN QUERY SELECT 
        'direct_query'::text,
        'INFO'::text,
        ('Direct query found: ' || direct_count || ' candidates')::text;
    
    -- 测试2: 如果有测试embedding，测试相似度查询
    IF test_embedding IS NOT NULL THEN
        SELECT COUNT(*) INTO function_count
        FROM candidates
        WHERE owner_id = user_id_test
        AND status = 'active'
        AND embedding IS NOT NULL
        AND (1 - (embedding <=> test_embedding)) >= 0.1;
        
        RETURN QUERY SELECT 
            'similarity_query'::text,
            'INFO'::text,
            ('Similarity query found: ' || function_count || ' candidates')::text;
        
        -- 测试3: 调用现有的搜索函数
        BEGIN
            SELECT COUNT(*) INTO function_count
            FROM search_candidates_rpc(
                test_embedding,
                0.1,
                NULL,
                NULL,
                NULL,
                NULL,
                NULL,
                ARRAY[]::text[],
                'active',
                user_id_test
            );
            
            RETURN QUERY SELECT 
                'function_call'::text,
                CASE WHEN function_count > 0 THEN 'SUCCESS' ELSE 'FAILED' END::text,
                ('Function returned: ' || function_count || ' candidates')::text;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 
                'function_call'::text,
                'ERROR'::text,
                ('Error: ' || SQLERRM)::text;
        END;
    ELSE
        RETURN QUERY SELECT 
            'no_test_embedding'::text,
            'WARNING'::text,
            'No embedding found for testing'::text;
    END IF;
END;
$$;

-- 授予权限
GRANT EXECUTE ON FUNCTION debug_search_candidates TO authenticated;

-- 6. 运行调试
SELECT * FROM debug_search_candidates(); 