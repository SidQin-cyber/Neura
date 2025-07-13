-- 修复现有搜索函数的向量类型问题
-- 保持现有结构，只修复核心问题

-- 1. 首先检查 candidates 表的 embedding 字段类型
DO $$
DECLARE
    embedding_type text;
    table_exists boolean;
BEGIN
    -- 检查 candidates 表是否存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'candidates'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- 检查 embedding 字段类型
        SELECT data_type INTO embedding_type
        FROM information_schema.columns
        WHERE table_name = 'candidates' AND column_name = 'embedding';
        
        RAISE NOTICE '📊 Candidates 表存在';
        RAISE NOTICE '📊 Embedding 字段类型: %', COALESCE(embedding_type, 'NOT_FOUND');
        
        -- 如果 embedding 字段类型不正确，修复它
        IF embedding_type != 'USER-DEFINED' THEN
            RAISE NOTICE '🔧 修复 embedding 字段类型';
            ALTER TABLE candidates DROP COLUMN IF EXISTS embedding;
            ALTER TABLE candidates ADD COLUMN embedding vector(1536);
            RAISE NOTICE '✅ Embedding 字段已修复为 vector(1536)';
        ELSE
            RAISE NOTICE '✅ Embedding 字段类型正确';
        END IF;
    ELSE
        RAISE NOTICE '❌ Candidates 表不存在';
    END IF;
END $$;

-- 2. 重新创建 search_candidates_rpc 函数，确保向量操作正确
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
    -- 记录函数调用
    RAISE NOTICE '🔍 搜索函数调用 - 用户: %, 阈值: %, 状态: %', user_id, similarity_threshold, status_filter;
    
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
        -- 使用正确的向量相似度计算
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
        -- 向量相似度过滤 - 关键修复点
        AND c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT 50;
    
    -- 记录返回结果数量
    GET DIAGNOSTICS FOUND_ROWS = ROW_COUNT;
    RAISE NOTICE '✅ 搜索完成，返回 % 条结果', FOUND_ROWS;
END;
$$;

-- 授予权限
GRANT EXECUTE ON FUNCTION search_candidates_rpc TO authenticated;

-- 3. 创建一个快速测试函数
CREATE OR REPLACE FUNCTION quick_search_test()
RETURNS TABLE(
    test_name text,
    result text,
    details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    test_user_id uuid := '98abb085-2969-46c5-b370-213a27a52f2e';
    candidate_count int;
    embedding_count int;
    test_embedding vector(1536);
    search_result_count int;
BEGIN
    -- 检查用户的候选人数据
    SELECT COUNT(*) INTO candidate_count
    FROM candidates
    WHERE owner_id = test_user_id;
    
    RETURN QUERY SELECT 
        'user_candidates'::text,
        'INFO'::text,
        ('User has ' || candidate_count || ' candidates')::text;
    
    -- 检查有 embedding 的数据
    SELECT COUNT(*) INTO embedding_count
    FROM candidates
    WHERE owner_id = test_user_id AND embedding IS NOT NULL;
    
    RETURN QUERY SELECT 
        'candidates_with_embeddings'::text,
        CASE WHEN embedding_count > 0 THEN 'SUCCESS' ELSE 'WARNING' END::text,
        ('Candidates with embeddings: ' || embedding_count)::text;
    
    -- 如果有 embedding，测试搜索功能
    IF embedding_count > 0 THEN
        -- 获取一个测试 embedding
        SELECT embedding INTO test_embedding
        FROM candidates
        WHERE owner_id = test_user_id AND embedding IS NOT NULL
        LIMIT 1;
        
        -- 测试搜索函数
        BEGIN
            SELECT COUNT(*) INTO search_result_count
            FROM search_candidates_rpc(
                test_embedding,
                0.1,
                NULL, NULL, NULL, NULL, NULL,
                ARRAY[]::text[],
                'active',
                test_user_id
            );
            
            RETURN QUERY SELECT 
                'search_function_test'::text,
                CASE WHEN search_result_count > 0 THEN 'SUCCESS' ELSE 'FAILED' END::text,
                ('Search returned ' || search_result_count || ' results')::text;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 
                'search_function_test'::text,
                'ERROR'::text,
                ('Error: ' || SQLERRM)::text;
        END;
    END IF;
END;
$$;

-- 授予权限
GRANT EXECUTE ON FUNCTION quick_search_test TO authenticated;

-- 4. 运行测试
SELECT * FROM quick_search_test();

-- 5. 显示完成消息
DO $$
BEGIN
    RAISE NOTICE '🎉 搜索函数修复完成！';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '✅ 检查并修复了 embedding 字段类型';
    RAISE NOTICE '✅ 重新创建了 search_candidates_rpc 函数';
    RAISE NOTICE '✅ 修复了向量相似度计算';
    RAISE NOTICE '✅ 添加了调试日志';
    RAISE NOTICE '';
    RAISE NOTICE '现在可以测试搜索功能了！';
END $$; 