-- 通用数据库修复脚本
-- 适用于不同的表结构

-- ========================================
-- 第一步：检查现有表结构
-- ========================================

-- 显示所有表
DO $$
DECLARE
    table_record RECORD;
BEGIN
    RAISE NOTICE '📋 现有数据库表：';
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    LOOP
        RAISE NOTICE '- %', table_record.table_name;
    END LOOP;
END $$;

-- ========================================
-- 第二步：修复 embedding 字段（适用于所有相关表）
-- ========================================

-- 修复 resumes 表的 embedding 字段
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes') THEN
        RAISE NOTICE '🔧 修复 resumes 表的 embedding 字段';
        ALTER TABLE public.resumes DROP COLUMN IF EXISTS embedding;
        ALTER TABLE public.resumes ADD COLUMN embedding vector(1536);
        RAISE NOTICE '✅ resumes 表修复完成';
    END IF;
END $$;

-- 修复 candidates 表的 embedding 字段（如果存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidates') THEN
        RAISE NOTICE '🔧 修复 candidates 表的 embedding 字段';
        ALTER TABLE public.candidates DROP COLUMN IF EXISTS embedding;
        ALTER TABLE public.candidates ADD COLUMN embedding vector(1536);
        RAISE NOTICE '✅ candidates 表修复完成';
    END IF;
END $$;

-- 修复 jobs 表的 embedding 字段（如果存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
        RAISE NOTICE '🔧 修复 jobs 表的 embedding 字段';
        ALTER TABLE public.jobs DROP COLUMN IF EXISTS embedding;
        ALTER TABLE public.jobs ADD COLUMN embedding vector(1536);
        RAISE NOTICE '✅ jobs 表修复完成';
    END IF;
END $$;

-- ========================================
-- 第三步：删除旧的搜索函数
-- ========================================

DROP FUNCTION IF EXISTS search_candidates_rpc CASCADE;
DROP FUNCTION IF EXISTS search_jobs_rpc CASCADE;
DROP FUNCTION IF EXISTS search_resumes_rpc CASCADE;

-- ========================================
-- 第四步：创建通用搜索函数
-- ========================================

-- 创建基于 resumes 表的搜索函数（如果该表存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes') THEN
        -- 创建 resumes 搜索函数
        EXECUTE '
        CREATE OR REPLACE FUNCTION search_candidates_rpc(
            query_embedding vector(1536),
            similarity_threshold float8 DEFAULT 0.1,
            location_filter text DEFAULT NULL,
            experience_min int DEFAULT NULL,
            experience_max int DEFAULT NULL,
            salary_min int DEFAULT NULL,
            salary_max int DEFAULT NULL,
            skills_filter text[] DEFAULT ARRAY[]::text[],
            status_filter text DEFAULT ''active'',
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
        AS $func$
        BEGIN
            RETURN QUERY
            SELECT 
                r.id,
                r.name,
                r.email,
                r.phone,
                r.current_title,
                r.location,
                r.experience_years,
                r.expected_salary,
                r.skills,
                r.status,
                -- 正确的向量相似度计算
                (1 - (r.embedding <=> query_embedding))::float8 as similarity,
                r.created_at,
                r.updated_at
            FROM resumes r
            WHERE 
                -- 用户权限检查
                (user_id IS NULL OR r.owner_id = user_id)
                -- 状态过滤
                AND (status_filter IS NULL OR r.status = status_filter)
                -- 地点过滤
                AND (location_filter IS NULL OR r.location ILIKE ''%'' || location_filter || ''%'')
                -- 经验过滤
                AND (experience_min IS NULL OR r.experience_years >= experience_min)
                AND (experience_max IS NULL OR r.experience_years <= experience_max)
                -- 薪资过滤
                AND (salary_min IS NULL OR r.expected_salary >= salary_min)
                AND (salary_max IS NULL OR r.expected_salary <= salary_max)
                -- 技能过滤
                AND (array_length(skills_filter, 1) IS NULL OR r.skills && skills_filter)
                -- 向量相似度过滤
                AND r.embedding IS NOT NULL
                AND (1 - (r.embedding <=> query_embedding)) >= similarity_threshold
            ORDER BY r.embedding <=> query_embedding
            LIMIT 50;
        END;
        $func$;
        ';
        
        -- 授予权限
        GRANT EXECUTE ON FUNCTION search_candidates_rpc TO authenticated;
        
        RAISE NOTICE '✅ 基于 resumes 表的搜索函数创建完成';
    END IF;
END $$;

-- 创建基于 candidates 表的搜索函数（如果该表存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidates') THEN
        -- 创建 candidates 搜索函数
        EXECUTE '
        CREATE OR REPLACE FUNCTION search_candidates_rpc(
            query_embedding vector(1536),
            similarity_threshold float8 DEFAULT 0.1,
            location_filter text DEFAULT NULL,
            experience_min int DEFAULT NULL,
            experience_max int DEFAULT NULL,
            salary_min int DEFAULT NULL,
            salary_max int DEFAULT NULL,
            skills_filter text[] DEFAULT ARRAY[]::text[],
            status_filter text DEFAULT ''active'',
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
        AS $func$
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
                AND (location_filter IS NULL OR c.location ILIKE ''%'' || location_filter || ''%'')
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
        $func$;
        ';
        
        -- 授予权限
        GRANT EXECUTE ON FUNCTION search_candidates_rpc TO authenticated;
        
        RAISE NOTICE '✅ 基于 candidates 表的搜索函数创建完成';
    END IF;
END $$;

-- ========================================
-- 第五步：创建测试函数
-- ========================================

CREATE OR REPLACE FUNCTION test_database_fix()
RETURNS TABLE(
    test_name text,
    result text,
    details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_count int;
    resumes_count int;
    candidates_count int;
    embedding_count int;
BEGIN
    -- 检查表数量
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
    
    RETURN QUERY SELECT 
        'database_tables'::text,
        'INFO'::text,
        ('Total tables: ' || table_count)::text;
    
    -- 检查 resumes 表
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes') THEN
        SELECT COUNT(*) INTO resumes_count FROM resumes;
        SELECT COUNT(*) INTO embedding_count FROM resumes WHERE embedding IS NOT NULL;
        
        RETURN QUERY SELECT 
            'resumes_table'::text,
            'SUCCESS'::text,
            ('Total: ' || resumes_count || ', With embeddings: ' || embedding_count)::text;
    END IF;
    
    -- 检查 candidates 表
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidates') THEN
        SELECT COUNT(*) INTO candidates_count FROM candidates;
        SELECT COUNT(*) INTO embedding_count FROM candidates WHERE embedding IS NOT NULL;
        
        RETURN QUERY SELECT 
            'candidates_table'::text,
            'SUCCESS'::text,
            ('Total: ' || candidates_count || ', With embeddings: ' || embedding_count)::text;
    END IF;
    
    -- 检查搜索函数
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'search_candidates_rpc'
    ) THEN
        RETURN QUERY SELECT 
            'search_function'::text,
            'SUCCESS'::text,
            'search_candidates_rpc function exists'::text;
    ELSE
        RETURN QUERY SELECT 
            'search_function'::text,
            'FAILED'::text,
            'search_candidates_rpc function not found'::text;
    END IF;
END;
$$;

-- 授予测试函数权限
GRANT EXECUTE ON FUNCTION test_database_fix TO authenticated;

-- ========================================
-- 完成消息
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '🎉 通用数据库修复完成！';
    RAISE NOTICE '';
    RAISE NOTICE '测试修复结果：';
    RAISE NOTICE 'SELECT * FROM test_database_fix();';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 注意：embedding 列已重新创建，需要重新生成向量数据';
END $$; 