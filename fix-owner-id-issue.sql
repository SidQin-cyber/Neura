-- 修复owner_id为NULL的问题
-- 这是导致搜索无结果的根本原因

-- 1. 首先检查问题的严重程度
SELECT 
    COUNT(*) as total_resumes,
    COUNT(CASE WHEN owner_id IS NULL THEN 1 END) as null_owner_count,
    COUNT(CASE WHEN owner_id IS NOT NULL THEN 1 END) as valid_owner_count
FROM resumes;

-- 2. 检查是否有用户表和用户数据
SELECT 
    COUNT(*) as total_users
FROM auth.users;

-- 3. 显示现有的用户ID（如果有的话）
SELECT 
    id,
    email,
    created_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. 临时解决方案：修改搜索函数，使其在owner_id为NULL时也能返回结果
-- 这样可以让搜索功能立即工作
CREATE OR REPLACE FUNCTION search_candidates_rpc(
  query_embedding TEXT,
  similarity_threshold FLOAT DEFAULT 0.0,
  match_count INT DEFAULT 10,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min INT DEFAULT NULL,
  salary_max INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  current_title TEXT,
  current_company TEXT,
  location TEXT,
  years_of_experience INT,
  expected_salary_min INT,
  expected_salary_max INT,
  skills TEXT[],
  education JSONB,
  experience JSONB,
  certifications JSONB,
  languages JSONB,
  status TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec VECTOR(1536);
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.email,
    r.phone,
    r.current_title,
    r.current_company,
    r.location,
    r.years_of_experience,
    r.expected_salary_min,
    r.expected_salary_max,
    r.skills,
    r.education,
    r.experience,
    r.certifications,
    r.languages,
    r.status,
    (1 - (r.embedding <=> query_vec)) as similarity
  FROM resumes r
  WHERE 
    r.status = status_filter
    -- 修改这里：如果user_id为NULL或者owner_id为NULL，则不过滤用户
    AND (user_id IS NULL OR r.owner_id IS NULL OR r.owner_id = user_id)
    AND (location_filter IS NULL OR r.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR r.years_of_experience >= experience_min)
    AND (experience_max IS NULL OR r.years_of_experience <= experience_max)
    AND (salary_min IS NULL OR r.expected_salary_max >= salary_min)
    AND (salary_max IS NULL OR r.expected_salary_min <= salary_max)
    AND (skills_filter IS NULL OR r.skills && skills_filter)
    AND r.embedding IS NOT NULL
    AND (1 - (r.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY r.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 5. 同样修复职位搜索函数
CREATE OR REPLACE FUNCTION search_jobs_rpc(
  query_embedding TEXT,
  similarity_threshold FLOAT DEFAULT 0.0,
  match_count INT DEFAULT 10,
  location_filter TEXT DEFAULT NULL,
  experience_min INT DEFAULT NULL,
  experience_max INT DEFAULT NULL,
  salary_min_filter INT DEFAULT NULL,
  salary_max_filter INT DEFAULT NULL,
  skills_filter TEXT[] DEFAULT NULL,
  status_filter TEXT DEFAULT 'active',
  user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  company TEXT,
  location TEXT,
  employment_type TEXT,
  salary_min INT,
  salary_max INT,
  currency TEXT,
  description TEXT,
  requirements TEXT,
  benefits TEXT,
  skills_required TEXT[],
  experience_required INT,
  education_required TEXT,
  industry TEXT,
  department TEXT,
  status TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec VECTOR(1536);
BEGIN
  -- 将字符串转换为VECTOR
  query_vec := query_embedding::VECTOR(1536);
  
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company,
    j.location,
    j.employment_type,
    j.salary_min,
    j.salary_max,
    j.currency,
    j.description,
    j.requirements,
    j.benefits,
    j.skills_required,
    j.experience_required,
    j.education_required,
    j.industry,
    j.department,
    j.status,
    (1 - (j.embedding <=> query_vec)) as similarity
  FROM jobs j
  WHERE 
    j.status = status_filter
    -- 修改这里：如果user_id为NULL或者owner_id为NULL，则不过滤用户
    AND (user_id IS NULL OR j.owner_id IS NULL OR j.owner_id = user_id)
    AND (location_filter IS NULL OR j.location ILIKE '%' || location_filter || '%')
    AND (experience_min IS NULL OR j.experience_required >= experience_min)
    AND (experience_max IS NULL OR j.experience_required <= experience_max)
    AND (salary_min_filter IS NULL OR j.salary_max >= salary_min_filter)
    AND (salary_max_filter IS NULL OR j.salary_min <= salary_max_filter)
    AND (skills_filter IS NULL OR j.skills_required && skills_filter)
    AND j.embedding IS NOT NULL
    AND (1 - (j.embedding <=> query_vec)) >= similarity_threshold
  ORDER BY j.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- 6. 测试修复后的搜索函数
DO $$
DECLARE
    test_embedding TEXT;
    result_count INTEGER;
BEGIN
    test_embedding := '[' || repeat('0,', 1535) || '0]';
    
    SELECT COUNT(*) INTO result_count
    FROM search_candidates_rpc(
        test_embedding,
        0.0,
        10,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        'active',
        NULL
    );
    
    RAISE NOTICE '修复后的搜索函数测试结果数量: %', result_count;
END $$;

-- 7. 验证修复效果
SELECT 'Search function fix completed!' as message;

-- 8. 如果需要，可以为现有数据分配一个默认的owner_id
-- 注意：这个操作需要谨慎，因为会修改现有数据
-- 取消注释下面的代码来执行：

/*
-- 获取第一个用户的ID（如果存在）
DO $$
DECLARE
    default_user_id UUID;
BEGIN
    SELECT id INTO default_user_id FROM auth.users LIMIT 1;
    
    IF default_user_id IS NOT NULL THEN
        -- 为所有owner_id为NULL的简历分配这个用户ID
        UPDATE resumes 
        SET owner_id = default_user_id 
        WHERE owner_id IS NULL;
        
        -- 为所有owner_id为NULL的职位分配这个用户ID
        UPDATE jobs 
        SET owner_id = default_user_id 
        WHERE owner_id IS NULL;
        
        RAISE NOTICE '已为所有NULL owner_id记录分配默认用户ID: %', default_user_id;
    ELSE
        RAISE NOTICE '没有找到用户，无法分配默认owner_id';
    END IF;
END $$;
*/ 