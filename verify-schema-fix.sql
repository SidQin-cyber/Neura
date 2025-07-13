-- 验证数据库 Schema 修复结果
-- 运行此脚本来检查修复是否成功

-- 1. 检查 embedding 字段类型
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE column_name = 'embedding'
AND table_name IN ('candidates', 'jobs', 'resumes')
ORDER BY table_name;

-- 2. 检查 skills 字段类型
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE column_name IN ('skills', 'skills_required')
AND table_name IN ('candidates', 'jobs', 'resumes')
ORDER BY table_name, column_name;

-- 3. 检查是否还有 has_embedding 字段
SELECT 
    table_name,
    column_name
FROM information_schema.columns
WHERE column_name = 'has_embedding'
AND table_name IN ('candidates', 'jobs', 'resumes');

-- 4. 检查唯一约束
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
AND tc.table_name = 'candidate_job_matches';

-- 5. 检查向量索引
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE indexname LIKE '%embedding%'
ORDER BY tablename;

-- 6. 测试搜索函数是否存在
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name IN ('search_candidates_rpc', 'search_jobs_rpc', 'verify_schema_fix')
ORDER BY routine_name;

-- 7. 运行验证函数（如果存在）
SELECT * FROM verify_schema_fix(); 