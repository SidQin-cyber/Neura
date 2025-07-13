-- 调试搜索问题的SQL脚本
-- 检查数据库状态和数据完整性

-- 1. 检查简历表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'resumes' 
ORDER BY ordinal_position;

-- 2. 检查简历数据统计
SELECT 
    COUNT(*) as total_resumes,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as resumes_with_embedding,
    COUNT(CASE WHEN embedding_large IS NOT NULL THEN 1 END) as resumes_with_large_embedding,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_resumes
FROM resumes;

-- 3. 检查用户的简历数据
SELECT 
    owner_id,
    COUNT(*) as resume_count,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
FROM resumes 
GROUP BY owner_id 
ORDER BY resume_count DESC;

-- 4. 检查最近的简历数据
SELECT 
    id,
    name,
    current_title,
    location,
    status,
    CASE WHEN embedding IS NOT NULL THEN 'YES' ELSE 'NO' END as has_embedding,
    CASE WHEN embedding_large IS NOT NULL THEN 'YES' ELSE 'NO' END as has_large_embedding,
    created_at
FROM resumes 
ORDER BY created_at DESC 
LIMIT 10;

-- 5. 检查embedding维度
SELECT 
    id,
    name,
    array_length(embedding, 1) as embedding_dimensions,
    CASE WHEN embedding_large IS NOT NULL THEN array_length(embedding_large, 1) ELSE NULL END as large_embedding_dimensions
FROM resumes 
WHERE embedding IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. 测试搜索函数 - 使用零向量进行测试
DO $$
DECLARE
    test_embedding TEXT;
    result_count INTEGER;
BEGIN
    -- 创建一个1536维的零向量用于测试
    test_embedding := '[' || repeat('0,', 1535) || '0]';
    
    -- 测试搜索函数
    SELECT COUNT(*) INTO result_count
    FROM search_candidates_rpc(
        test_embedding,
        0.0,  -- 最低阈值
        100,  -- 最大结果数
        NULL, -- 位置过滤
        NULL, -- 经验最小值
        NULL, -- 经验最大值
        NULL, -- 薪资最小值
        NULL, -- 薪资最大值
        NULL, -- 技能过滤
        'active', -- 状态过滤
        NULL  -- 用户ID过滤
    );
    
    RAISE NOTICE '搜索函数测试结果数量: %', result_count;
END $$;

-- 7. 检查RPC函数是否存在
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('search_candidates_rpc', 'search_jobs_rpc', 'insert_candidate_with_embedding')
ORDER BY routine_name;

-- 8. 检查向量扩展是否正确安装
SELECT 
    extname,
    extversion
FROM pg_extension 
WHERE extname = 'vector';

-- 9. 检查索引状态
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('resumes', 'jobs') 
AND indexname LIKE '%embedding%';

-- 10. 检查是否有双模型相关的表或字段
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name LIKE '%embedding%' 
ORDER BY table_name, column_name; 