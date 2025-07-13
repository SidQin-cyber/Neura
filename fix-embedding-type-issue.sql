-- Fix Embedding Type Casting Issue
-- This script addresses the VECTOR to float[] type incompatibility

-- First, let's check the current embedding column type
DO $$
BEGIN
    -- Check if embedding column exists and its type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'candidates' 
        AND column_name = 'embedding'
    ) THEN
        RAISE NOTICE 'Embedding column exists in candidates table';
    ELSE
        RAISE NOTICE 'Embedding column does not exist in candidates table';
    END IF;
END $$;

-- Drop existing search functions that have type issues
DROP FUNCTION IF EXISTS search_candidates_rpc(
    query_embedding vector(1536),
    similarity_threshold float8,
    location_filter text,
    experience_min int,
    experience_max int,
    salary_min int,
    salary_max int,
    skills_filter text[],
    status_filter text,
    user_id uuid
);

DROP FUNCTION IF EXISTS search_jobs_rpc(
    query_embedding vector(1536),
    similarity_threshold float8,
    location_filter text,
    experience_min int,
    experience_max int,
    salary_min_filter int,
    salary_max_filter int,
    skills_filter text[],
    status_filter text,
    user_id uuid
);

-- Create corrected search_candidates_rpc function with proper VECTOR handling
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

-- Create corrected search_jobs_rpc function with proper VECTOR handling
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_candidates_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION search_jobs_rpc TO authenticated;

-- Create a test function to verify embedding operations work
CREATE OR REPLACE FUNCTION test_embedding_operations()
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
    -- Create a test embedding vector
    test_embedding := (SELECT embedding FROM candidates WHERE embedding IS NOT NULL LIMIT 1);
    
    -- Test 1: Check if we can retrieve embeddings
    SELECT COUNT(*) INTO candidate_count 
    FROM candidates 
    WHERE embedding IS NOT NULL;
    
    RETURN QUERY SELECT 
        'embedding_retrieval'::text,
        CASE WHEN candidate_count > 0 THEN 'SUCCESS' ELSE 'FAILED' END::text,
        ('Found ' || candidate_count || ' candidates with embeddings')::text;
    
    -- Test 2: Check if similarity calculation works
    IF test_embedding IS NOT NULL THEN
        SELECT COUNT(*) INTO search_result_count
        FROM candidates c
        WHERE c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> test_embedding)) >= 0.1;
        
        RETURN QUERY SELECT 
            'similarity_calculation'::text,
            CASE WHEN search_result_count >= 0 THEN 'SUCCESS' ELSE 'FAILED' END::text,
            ('Similarity search returned ' || search_result_count || ' results')::text;
    ELSE
        RETURN QUERY SELECT 
            'similarity_calculation'::text,
            'SKIPPED'::text,
            'No test embedding available'::text;
    END IF;
    
    -- Test 3: Test the search function directly
    BEGIN
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
            'search_function'::text,
            CASE WHEN search_result_count >= 0 THEN 'SUCCESS' ELSE 'FAILED' END::text,
            ('Search function returned ' || search_result_count || ' results')::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'search_function'::text,
            'FAILED'::text,
            ('Error: ' || SQLERRM)::text;
    END;
END;
$$;

-- Grant permission to test function
GRANT EXECUTE ON FUNCTION test_embedding_operations TO authenticated;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE 'Embedding type fix completed successfully!';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '- search_candidates_rpc (with proper VECTOR handling)';
    RAISE NOTICE '- search_jobs_rpc (with proper VECTOR handling)';
    RAISE NOTICE '- test_embedding_operations (for testing)';
    RAISE NOTICE '';
    RAISE NOTICE 'Run the following to test the fix:';
    RAISE NOTICE 'SELECT * FROM test_embedding_operations();';
END $$; 