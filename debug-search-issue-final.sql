-- 调试搜索问题的SQL脚本（最终版）
-- 完全兼容PostgreSQL和pgvector扩展

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
ORDER BY resume_count DESC
LIMIT 10;

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

-- 5. 检查embedding数据（不检查维度，因为array_length不支持VECTOR类型）
SELECT 
    id,
    name,
    current_title,
    CASE WHEN embedding IS NOT NULL THEN 'HAS_EMBEDDING' ELSE 'NO_EMBEDDING' END as embedding_status,
    created_at
FROM resumes 
WHERE embedding IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. 检查向量扩展是否正确安装
SELECT 
    extname,
    extversion
FROM pg_extension 
WHERE extname = 'vector';

-- 7. 检查RPC函数是否存在
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('search_candidates_rpc', 'search_jobs_rpc', 'insert_candidate_with_embedding')
ORDER BY routine_name;

-- 8. 检查索引状态
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('resumes', 'jobs') 
AND indexname LIKE '%embedding%';

-- 9. 检查embedding相关字段
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name = 'embedding'
ORDER BY table_name, column_name;

-- 10. 检查数据总览
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

-- 11. 检查最近的活动
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

-- 12. 测试简单的向量查询（不使用RPC函数）
SELECT 
    'Vector query test' as test_type,
    COUNT(*) as total_with_embedding
FROM resumes 
WHERE embedding IS NOT NULL 
  AND status = 'active';

-- 13. 检查是否有双模型相关的残留
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%dual%' 
   OR routine_name LIKE '%large%'
ORDER BY routine_name;

-- 14. 检查表的详细信息
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('resumes', 'jobs')
  AND column_name LIKE '%embedding%'
ORDER BY table_name, column_name;

-- 15. 显示一些示例数据（不包含embedding内容）
SELECT 
    id,
    name,
    current_title,
    current_company,
    location,
    status,
    CASE WHEN embedding IS NOT NULL THEN 'YES' ELSE 'NO' END as has_embedding,
    created_at
FROM resumes 
ORDER BY created_at DESC 
LIMIT 5; 