-- Test script to verify embedding fix
-- Run this after executing fix-embedding-type-issue.sql

-- 1. Test the embedding operations function
SELECT 
    test_name,
    result,
    details
FROM test_embedding_operations();

-- 2. Test direct search with a real embedding
WITH test_embedding AS (
    SELECT embedding 
    FROM candidates 
    WHERE embedding IS NOT NULL 
    AND owner_id = '98abb085-2969-46c5-b370-213a27a52f2e'
    LIMIT 1
)
SELECT 
    'Direct Search Test' as test_name,
    c.name,
    c.current_title,
    c.location,
    (1 - (c.embedding <=> te.embedding))::float8 as similarity,
    c.status
FROM candidates c, test_embedding te
WHERE c.embedding IS NOT NULL
AND c.owner_id = '98abb085-2969-46c5-b370-213a27a52f2e'
AND (1 - (c.embedding <=> te.embedding)) >= 0.1
ORDER BY c.embedding <=> te.embedding
LIMIT 5;

-- 3. Test the search function with real data
WITH test_embedding AS (
    SELECT embedding 
    FROM candidates 
    WHERE embedding IS NOT NULL 
    AND owner_id = '98abb085-2969-46c5-b370-213a27a52f2e'
    LIMIT 1
)
SELECT 
    'Function Search Test' as test_name,
    name,
    current_title,
    location,
    similarity,
    status
FROM search_candidates_rpc(
    (SELECT embedding FROM test_embedding),
    0.1,  -- similarity_threshold
    NULL, -- location_filter
    NULL, -- experience_min
    NULL, -- experience_max
    NULL, -- salary_min
    NULL, -- salary_max
    ARRAY[]::text[], -- skills_filter
    'active', -- status_filter
    '98abb085-2969-46c5-b370-213a27a52f2e'::uuid -- user_id
)
LIMIT 5; 