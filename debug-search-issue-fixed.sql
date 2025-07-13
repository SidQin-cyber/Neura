-- 调试搜索问题的SQL脚本（修正版）
-- 检查数据库状态和数据完整性，不引用不存在的字段

-- 1. 检查简历表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'resumes' 
ORDER BY ordinal_position;

-- 2. 检查简历数据统计（只检查存在的字段）
SELECT 
    COUNT(*) as total_resumes,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as resumes_with_embedding,
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
    created_at
FROM resumes 
ORDER BY created_at DESC 
LIMIT 10;

-- 5. 检查embedding维度
SELECT 
    id,
    name,
    array_length(embedding, 1) as embedding_dimensions,
    created_at
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

-- 10. 检查embedding相关字段（只检查存在的）
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name = 'embedding'
ORDER BY table_name, column_name;

-- 11. 检查是否有任何数据
SELECT 
    'resumes' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as records_with_embedding
FROM resumes
UNION ALL
SELECT 
    'jobs' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as records_with_embedding
FROM jobs;

-- 12. 检查最近的活动
SELECT 
    'Recent resume uploads' as activity_type,
    COUNT(*) as count
FROM resumes 
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
    'Recent job postings' as activity_type,
    COUNT(*) as count
FROM jobs 
WHERE created_at > NOW() - INTERVAL '7 days';

-- 13. 检查embedding数据质量
SELECT 
    'Embedding quality check' as check_type,
    COUNT(*) as total_resumes,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
    COUNT(CASE WHEN embedding IS NOT NULL AND array_length(embedding, 1) = 1536 THEN 1 END) as correct_dimension,
    COUNT(CASE WHEN embedding IS NOT NULL AND array_length(embedding, 1) != 1536 THEN 1 END) as wrong_dimension
FROM resumes; 