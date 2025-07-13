-- 简化版数据库 Schema 修复脚本
-- 专注于核心问题的修复

-- ========================================
-- 第一步：修复 embedding 字段类型问题
-- ========================================

-- 修复 candidates 表的 embedding 字段
ALTER TABLE public.candidates DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.candidates ADD COLUMN embedding vector(1536);

-- 修复 jobs 表的 embedding 字段（如果存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
        ALTER TABLE public.jobs DROP COLUMN IF EXISTS embedding;
        ALTER TABLE public.jobs ADD COLUMN embedding vector(1536);
    END IF;
END $$;

-- 修复 resumes 表的 embedding 字段（如果存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes') THEN
        ALTER TABLE public.resumes DROP COLUMN IF EXISTS embedding;
        ALTER TABLE public.resumes ADD COLUMN embedding vector(1536);
    END IF;
END $$;

-- ========================================
-- 第二步：删除旧的搜索函数
-- ========================================

DROP FUNCTION IF EXISTS search_candidates_rpc CASCADE;
DROP FUNCTION IF EXISTS search_jobs_rpc CASCADE;

-- ========================================
-- 第三步：创建新的搜索函数
-- ========================================

-- 创建 candidates 搜索函数
CREATE OR REPLACE FUNCTION search_candidates_rpc(
    query_embedding vector(1536),
    similarity_threshold float8 DEFAULT 0.1,
    location_filter text DEFAULT NULL,
    experience_min int DEFAULT NULL,
    experience_max int DEFAULT NULL,
    salary_min int DEFAULT NULL,
    salary_max int DEFAULT NULL,
    skills_filter text[] DEFAULT ARRAY[]::text[],
    status_filter text DEFAULT 'active',
    user_id uuid DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    name text,
    email text,
    phone text,
    current_title text,
    location text,
    experience_years int,
    expected_salary int,
    skills text[],
    status text,
    similarity float8,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.current_title,
        c.location,
        c.experience_years,
        c.expected_salary,
        c.skills,
        c.status,
        -- 正确的向量相似度计算
        (1 - (c.embedding <=> query_embedding))::float8 as similarity,
        c.created_at,
        c.updated_at
    FROM candidates c
    WHERE 
        -- 用户权限检查
        (user_id IS NULL OR c.owner_id = user_id)
        -- 状态过滤
        AND (status_filter IS NULL OR c.status = status_filter)
        -- 地点过滤
        AND (location_filter IS NULL OR c.location ILIKE '%' || location_filter || '%')
        -- 经验过滤
        AND (experience_min IS NULL OR c.experience_years >= experience_min)
        AND (experience_max IS NULL OR c.experience_years <= experience_max)
        -- 薪资过滤
        AND (salary_min IS NULL OR c.expected_salary >= salary_min)
        AND (salary_max IS NULL OR c.expected_salary <= salary_max)
        -- 技能过滤
        AND (array_length(skills_filter, 1) IS NULL OR c.skills && skills_filter)
        -- 向量相似度过滤
        AND c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT 50;
END;
$$;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION search_candidates_rpc TO authenticated;

-- ========================================
-- 第四步：创建测试函数
-- ========================================

CREATE OR REPLACE FUNCTION test_search_simple()
RETURNS TABLE(
    test_name text,
    result text,
    details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    candidate_count int;
    embedding_count int;
BEGIN
    -- 检查候选人总数
    SELECT COUNT(*) INTO candidate_count FROM candidates;
    
    RETURN QUERY SELECT 
        'total_candidates'::text,
        'INFO'::text,
        ('Total candidates: ' || candidate_count)::text;
    
    -- 检查有 embedding 的候选人数
    SELECT COUNT(*) INTO embedding_count FROM candidates WHERE embedding IS NOT NULL;
    
    RETURN QUERY SELECT 
        'candidates_with_embeddings'::text,
        CASE WHEN embedding_count > 0 THEN 'SUCCESS' ELSE 'NO_EMBEDDINGS' END::text,
        ('Candidates with embeddings: ' || embedding_count)::text;
    
    -- 检查 embedding 字段类型
    RETURN QUERY SELECT 
        'embedding_type_check'::text,
        'INFO'::text,
        (
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'candidates' AND column_name = 'embedding'
        )::text;
END;
$$;

-- 授予测试函数权限
GRANT EXECUTE ON FUNCTION test_search_simple TO authenticated;

-- ========================================
-- 完成消息
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ 简化版数据库修复完成！';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '- 修正了 embedding 字段类型为 vector(1536)';
    RAISE NOTICE '- 重新创建了 search_candidates_rpc 函数';
    RAISE NOTICE '- 创建了测试函数';
    RAISE NOTICE '';
    RAISE NOTICE '测试修复结果：';
    RAISE NOTICE 'SELECT * FROM test_search_simple();';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 注意：需要重新生成向量数据';
END $$; 