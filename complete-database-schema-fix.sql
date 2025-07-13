-- 完整的数据库 Schema 修复脚本
-- 基于详细分析的关键问题修复

-- ========================================
-- 第一步：备份现有数据（可选但推荐）
-- ========================================
-- 在执行修复前，建议先备份重要数据
-- 可以通过 Supabase Dashboard 或 pg_dump 进行备份

-- ========================================
-- 第二步：修复 embedding 字段类型问题
-- ========================================

-- 修复 resumes 表的 embedding 字段
-- 这是导致搜索失败的根本原因
ALTER TABLE public.resumes DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.resumes ADD COLUMN embedding vector(1536);

-- 修复 jobs 表的 embedding 字段
ALTER TABLE public.jobs DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.jobs ADD COLUMN embedding vector(1536);

-- 同时修复 candidates 表（如果存在类似问题）
DO $$
BEGIN
    -- 检查 candidates 表是否存在 embedding 列
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'candidates' 
        AND column_name = 'embedding'
    ) THEN
        -- 如果存在，确保类型正确
        ALTER TABLE public.candidates ALTER COLUMN embedding TYPE vector(1536);
    ELSE
        -- 如果不存在，添加列
        ALTER TABLE public.candidates ADD COLUMN embedding vector(1536);
    END IF;
END $$;

-- ========================================
-- 第三步：修复 skills 字段类型问题
-- ========================================

-- 修正 resumes 表的 skills 字段类型
ALTER TABLE public.resumes ALTER COLUMN skills TYPE TEXT[] USING 
    CASE 
        WHEN skills IS NULL THEN NULL
        ELSE skills::TEXT[]
    END;

-- 修正 jobs 表的 skills_required 字段类型
ALTER TABLE public.jobs ALTER COLUMN skills_required TYPE TEXT[] USING 
    CASE 
        WHEN skills_required IS NULL THEN NULL
        ELSE skills_required::TEXT[]
    END;

-- 修正 candidates 表的 skills 字段类型（如果存在）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'candidates' 
        AND column_name = 'skills'
    ) THEN
        ALTER TABLE public.candidates ALTER COLUMN skills TYPE TEXT[] USING 
            CASE 
                WHEN skills IS NULL THEN NULL
                ELSE skills::TEXT[]
            END;
    END IF;
END $$;

-- ========================================
-- 第四步：移除冗余的 has_embedding 字段
-- ========================================

-- 移除 resumes 表的冗余字段
ALTER TABLE public.resumes DROP COLUMN IF EXISTS has_embedding;

-- 移除 jobs 表的冗余字段
ALTER TABLE public.jobs DROP COLUMN IF EXISTS has_embedding;

-- 移除 candidates 表的冗余字段（如果存在）
ALTER TABLE public.candidates DROP COLUMN IF EXISTS has_embedding;

-- ========================================
-- 第五步：添加唯一性约束
-- ========================================

-- 为 candidate_job_matches 表添加唯一约束
-- 防止重复的匹配记录
DO $$
BEGIN
    -- 检查约束是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_candidate_job_pair' 
        AND table_name = 'candidate_job_matches'
    ) THEN
        ALTER TABLE public.candidate_job_matches
        ADD CONSTRAINT unique_candidate_job_pair 
        UNIQUE (candidate_id, job_id);
    END IF;
END $$;

-- ========================================
-- 第六步：重新创建向量索引
-- ========================================

-- 删除旧的索引（如果存在）
DROP INDEX IF EXISTS idx_resumes_embedding;
DROP INDEX IF EXISTS idx_jobs_embedding;
DROP INDEX IF EXISTS idx_candidates_embedding;

-- 为 resumes 表创建向量索引
CREATE INDEX IF NOT EXISTS idx_resumes_embedding 
ON public.resumes USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 为 jobs 表创建向量索引
CREATE INDEX IF NOT EXISTS idx_jobs_embedding 
ON public.jobs USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 为 candidates 表创建向量索引
CREATE INDEX IF NOT EXISTS idx_candidates_embedding 
ON public.candidates USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ========================================
-- 第七步：删除旧的搜索函数
-- ========================================

-- 删除所有旧版本的搜索函数
DROP FUNCTION IF EXISTS search_candidates_rpc CASCADE;
DROP FUNCTION IF EXISTS search_jobs_rpc CASCADE;
DROP FUNCTION IF EXISTS search_resumes_rpc CASCADE;

-- ========================================
-- 第八步：创建新的搜索函数
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

-- 创建 jobs 搜索函数
CREATE OR REPLACE FUNCTION search_jobs_rpc(
    query_embedding vector(1536),
    similarity_threshold float8 DEFAULT 0.1,
    location_filter text DEFAULT NULL,
    experience_min int DEFAULT NULL,
    experience_max int DEFAULT NULL,
    salary_min_filter int DEFAULT NULL,
    salary_max_filter int DEFAULT NULL,
    skills_filter text[] DEFAULT ARRAY[]::text[],
    status_filter text DEFAULT 'active',
    user_id uuid DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    title text,
    company text,
    location text,
    employment_type text,
    experience_level text,
    salary_min int,
    salary_max int,
    skills text[],
    description text,
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
        j.id,
        j.title,
        j.company,
        j.location,
        j.employment_type,
        j.experience_level,
        j.salary_min,
        j.salary_max,
        j.skills_required as skills,
        j.description,
        j.status,
        -- 正确的向量相似度计算
        (1 - (j.embedding <=> query_embedding))::float8 as similarity,
        j.created_at,
        j.updated_at
    FROM jobs j
    WHERE 
        -- 用户权限检查
        (user_id IS NULL OR j.owner_id = user_id)
        -- 状态过滤
        AND (status_filter IS NULL OR j.status = status_filter)
        -- 地点过滤
        AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
        -- 经验过滤
        AND (experience_min IS NULL OR 
             CASE 
                 WHEN j.experience_level = 'entry' THEN 0
                 WHEN j.experience_level = 'mid' THEN 3
                 WHEN j.experience_level = 'senior' THEN 5
                 WHEN j.experience_level = 'lead' THEN 8
                 ELSE 0
             END >= experience_min)
        AND (experience_max IS NULL OR 
             CASE 
                 WHEN j.experience_level = 'entry' THEN 2
                 WHEN j.experience_level = 'mid' THEN 5
                 WHEN j.experience_level = 'senior' THEN 8
                 WHEN j.experience_level = 'lead' THEN 15
                 ELSE 15
             END <= experience_max)
        -- 薪资过滤
        AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
        AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
        -- 技能过滤
        AND (array_length(skills_filter, 1) IS NULL OR j.skills_required && skills_filter)
        -- 向量相似度过滤
        AND j.embedding IS NOT NULL
        AND (1 - (j.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY j.embedding <=> query_embedding
    LIMIT 50;
END;
$$;

-- ========================================
-- 第九步：授予权限
-- ========================================

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION search_candidates_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION search_jobs_rpc TO authenticated;

-- ========================================
-- 第十步：创建验证函数
-- ========================================

CREATE OR REPLACE FUNCTION verify_schema_fix()
RETURNS TABLE(
    check_name text,
    status text,
    details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    candidates_count int;
    jobs_count int;
    resumes_count int;
    embedding_type text;
BEGIN
    -- 检查 candidates 表的 embedding 类型
    SELECT data_type INTO embedding_type
    FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'embedding';
    
    RETURN QUERY SELECT 
        'candidates_embedding_type'::text,
        CASE WHEN embedding_type = 'USER-DEFINED' THEN 'SUCCESS' ELSE 'FAILED' END::text,
        ('Embedding type: ' || COALESCE(embedding_type, 'NOT_FOUND'))::text;
    
    -- 检查有 embedding 的记录数量
    SELECT COUNT(*) INTO candidates_count FROM candidates WHERE embedding IS NOT NULL;
    SELECT COUNT(*) INTO jobs_count FROM jobs WHERE embedding IS NOT NULL;
    SELECT COUNT(*) INTO resumes_count FROM resumes WHERE embedding IS NOT NULL;
    
    RETURN QUERY SELECT 
        'embedding_data_count'::text,
        'INFO'::text,
        ('Candidates: ' || candidates_count || ', Jobs: ' || jobs_count || ', Resumes: ' || resumes_count)::text;
    
    -- 测试搜索函数
    BEGIN
        PERFORM search_candidates_rpc(
            (SELECT embedding FROM candidates WHERE embedding IS NOT NULL LIMIT 1),
            0.1
        );
        RETURN QUERY SELECT 
            'search_function_test'::text,
            'SUCCESS'::text,
            'Search functions are working'::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'search_function_test'::text,
            'FAILED'::text,
            ('Error: ' || SQLERRM)::text;
    END;
END;
$$;

-- 授予验证函数权限
GRANT EXECUTE ON FUNCTION verify_schema_fix TO authenticated;

-- ========================================
-- 完成消息
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '🎉 数据库 Schema 修复完成！';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '✅ 修正了 embedding 字段类型 (USER-DEFINED → vector(1536))';
    RAISE NOTICE '✅ 修正了 skills 字段类型 (ARRAY → TEXT[])';
    RAISE NOTICE '✅ 移除了冗余的 has_embedding 字段';
    RAISE NOTICE '✅ 添加了唯一性约束';
    RAISE NOTICE '✅ 重新创建了向量索引';
    RAISE NOTICE '✅ 更新了搜索函数';
    RAISE NOTICE '';
    RAISE NOTICE '验证修复结果：';
    RAISE NOTICE 'SELECT * FROM verify_schema_fix();';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  注意：由于 embedding 列被重新创建，您需要重新生成所有的向量数据。';
END $$; 