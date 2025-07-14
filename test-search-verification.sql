-- 验证搜索功能修复
-- 测试搜索函数是否能正常返回候选人数据

-- 1. 检查候选人数据
SELECT 
    id,
    name,
    email,
    owner_id,
    created_at
FROM resumes 
ORDER BY created_at DESC
LIMIT 10;

-- 2. 测试搜索函数（不带用户ID过滤）
SELECT 
    id,
    name,
    email,
    similarity_score
FROM search_candidates_rpc(
    'software engineer',
    NULL,  -- user_id 设为 NULL
    10,    -- limit
    0.1    -- similarity_threshold
)
ORDER BY similarity_score DESC;

-- 3. 测试搜索函数（带特定技能）
SELECT 
    id,
    name,
    email,
    similarity_score
FROM search_candidates_rpc(
    'Python developer',
    NULL,  -- user_id 设为 NULL
    10,    -- limit
    0.1    -- similarity_threshold
)
ORDER BY similarity_score DESC;

-- 4. 检查函数定义
SELECT 
    proname,
    pronargs,
    proargtypes::regtype[]
FROM pg_proc 
WHERE proname = 'search_candidates_rpc'
ORDER BY pronargs; 