-- 全面检查数据库函数状态
-- 在 Supabase SQL 编辑器中运行此脚本

-- 1. 检查所有与搜索相关的函数
SELECT 
    p.proname as function_name,
    p.proargtypes,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    p.prosrc as function_body
FROM pg_proc p
WHERE p.proname LIKE '%search%' OR p.proname LIKE '%candidate%' OR p.proname LIKE '%job%'
ORDER BY p.proname;

-- 2. 检查所有RPC函数
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%rpc%'
ORDER BY p.proname;

-- 3. 检查数据库表是否存在
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename IN ('resumes', 'jobs', 'candidates')
ORDER BY tablename;

-- 4. 检查向量扩展是否安装
SELECT 
    extname,
    extversion,
    extrelocatable
FROM pg_extension
WHERE extname = 'vector';

-- 5. 检查是否有任何数据
SELECT 
    'resumes' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as has_embedding_count
FROM resumes
UNION ALL
SELECT 
    'jobs' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as has_embedding_count
FROM jobs;

-- 6. 检查权限和安全策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('resumes', 'jobs')
ORDER BY tablename, policyname; 