-- Complete Function Cleanup and Recreation
-- This script removes all existing search function versions and creates clean new ones

-- Step 1: Drop ALL existing versions of search functions
-- This handles the "function name not unique" error

-- Drop all search_candidates_rpc function versions
DROP FUNCTION IF EXISTS search_candidates_rpc CASCADE;

-- Drop all search_jobs_rpc function versions  
DROP FUNCTION IF EXISTS search_jobs_rpc CASCADE;

-- Drop any test functions
DROP FUNCTION IF EXISTS test_embedding_operations CASCADE;

-- Step 2: Create the corrected search_candidates_rpc function
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
        -- Use proper VECTOR similarity calculation
        (1 - (c.embedding <=> query_embedding))::float8 as similarity,
        c.created_at,
        c.updated_at
    FROM candidates c
    WHERE 
        -- User ownership check
        (user_id IS NULL OR c.owner_id = user_id)
        -- Status filter
        AND (status_filter IS NULL OR c.status = status_filter)
        -- Location filter
        AND (location_filter IS NULL OR c.location ILIKE '%' || location_filter || '%')
        -- Experience filters
        AND (experience_min IS NULL OR c.experience_years >= experience_min)
        AND (experience_max IS NULL OR c.experience_years <= experience_max)
        -- Salary filters
        AND (salary_min IS NULL OR c.expected_salary >= salary_min)
        AND (salary_max IS NULL OR c.expected_salary <= salary_max)
        -- Skills filter
        AND (array_length(skills_filter, 1) IS NULL OR c.skills && skills_filter)
        -- Embedding similarity filter
        AND c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT 50;
END;
$$;

-- Step 3: Create the corrected search_jobs_rpc function
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
        j.skills,
        j.description,
        j.status,
        -- Use proper VECTOR similarity calculation
        (1 - (j.embedding <=> query_embedding))::float8 as similarity,
        j.created_at,
        j.updated_at
    FROM jobs j
    WHERE 
        -- User ownership check
        (user_id IS NULL OR j.owner_id = user_id)
        -- Status filter
        AND (status_filter IS NULL OR j.status = status_filter)
        -- Location filter
        AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
        -- Experience filters (based on experience_level)
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
        -- Salary filters
        AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
        AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
        -- Skills filter
        AND (array_length(skills_filter, 1) IS NULL OR j.skills && skills_filter)
        -- Embedding similarity filter
        AND j.embedding IS NOT NULL
        AND (1 - (j.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY j.embedding <=> query_embedding
    LIMIT 50;
END;
$$;

-- Step 4: Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_candidates_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION search_jobs_rpc TO authenticated;

-- Step 5: Create a simple test function
CREATE OR REPLACE FUNCTION test_search_fix()
RETURNS TABLE(
    test_name text,
    result text,
    details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    test_embedding vector(1536);
    candidate_count int;
    search_result_count int;
BEGIN
    -- Get a test embedding
    SELECT embedding INTO test_embedding 
    FROM candidates 
    WHERE embedding IS NOT NULL 
    LIMIT 1;
    
    -- Test 1: Check candidate count
    SELECT COUNT(*) INTO candidate_count 
    FROM candidates 
    WHERE embedding IS NOT NULL;
    
    RETURN QUERY SELECT 
        'candidates_with_embeddings'::text,
        'SUCCESS'::text,
        ('Found ' || candidate_count || ' candidates with embeddings')::text;
    
    -- Test 2: Test search function
    IF test_embedding IS NOT NULL THEN
        SELECT COUNT(*) INTO search_result_count
        FROM search_candidates_rpc(
            test_embedding,
            0.1,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            ARRAY[]::text[],
            'active',
            NULL
        );
        
        RETURN QUERY SELECT 
            'search_function_test'::text,
            CASE WHEN search_result_count > 0 THEN 'SUCCESS' ELSE 'NO_RESULTS' END::text,
            ('Search function returned ' || search_result_count || ' results')::text;
    ELSE
        RETURN QUERY SELECT 
            'search_function_test'::text,
            'SKIPPED'::text,
            'No test embedding available'::text;
    END IF;
END;
$$;

-- Grant permission to test function
GRANT EXECUTE ON FUNCTION test_search_fix TO authenticated;

-- Step 6: Display completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Function cleanup and recreation completed!';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '- search_candidates_rpc (with VECTOR support)';
    RAISE NOTICE '- search_jobs_rpc (with VECTOR support)';
    RAISE NOTICE '- test_search_fix (for testing)';
    RAISE NOTICE '';
    RAISE NOTICE 'To test the fix, run:';
    RAISE NOTICE 'SELECT * FROM test_search_fix();';
END $$; 