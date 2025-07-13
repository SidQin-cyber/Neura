-- Test script to verify search functionality after owner_id fix
-- Run this in Supabase SQL Editor to confirm search is working

-- Test 1: Check if search functions exist and are updated
SELECT 
    p.proname as function_name,
    p.prosrc LIKE '%user_id IS NULL OR r.owner_id IS NULL%' as has_null_fix
FROM pg_proc p
WHERE p.proname IN ('search_candidates_rpc', 'search_jobs_rpc');

-- Test 2: Test candidate search with a simple query
SELECT 'Testing candidate search...' as test_description;
SELECT * FROM search_candidates_rpc(
    'developer', -- search_query
    NULL,        -- user_id (simulating the issue)
    10,          -- limit_count
    0            -- offset_count
);

-- Test 3: Test job search with a simple query
SELECT 'Testing job search...' as test_description;
SELECT * FROM search_jobs_rpc(
    'software', -- search_query
    NULL,       -- user_id (simulating the issue)
    10,         -- limit_count
    0           -- offset_count
);

-- Test 4: Verify data still exists in tables
SELECT 
    'resumes' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN owner_id IS NULL THEN 1 END) as null_owner_count,
    COUNT(CASE WHEN has_embedding = 'YES' THEN 1 END) as has_embedding_count
FROM resumes
WHERE status = 'active'
UNION ALL
SELECT 
    'jobs' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN owner_id IS NULL THEN 1 END) as null_owner_count,
    COUNT(CASE WHEN has_embedding = 'YES' THEN 1 END) as has_embedding_count
FROM jobs
WHERE status = 'active';

-- Test 5: Check if any results are returned (should be > 0 now)
SELECT 
    'Search Results Summary' as summary,
    (SELECT COUNT(*) FROM search_candidates_rpc('developer', NULL, 10, 0)) as candidate_results,
    (SELECT COUNT(*) FROM search_jobs_rpc('software', NULL, 10, 0)) as job_results; 