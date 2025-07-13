-- 检查数据库表结构
-- 用于确定实际存在的表和字段

-- 1. 检查所有表
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. 检查与候选人相关的表（如果存在）
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('candidates', 'resumes', 'jobs', 'users')
ORDER BY table_name, ordinal_position;

-- 3. 检查所有包含 embedding 字段的表
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE column_name = 'embedding'
AND table_schema = 'public'
ORDER BY table_name;

-- 4. 检查现有的搜索函数
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name LIKE '%search%'
AND routine_schema = 'public'
ORDER BY routine_name; 