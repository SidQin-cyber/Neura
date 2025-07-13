-- 修复中文全文搜索配置问题（修正版本）
-- 在 Supabase Dashboard 的 SQL Editor 中执行此脚本

-- ============================================================
-- 1. 检查可用的文本搜索配置（修正版本）
-- ============================================================

-- 显示所有可用的文本搜索配置（修正列名）
SELECT cfgname, cfgnamespace, cfgparser
FROM pg_ts_config 
ORDER BY cfgname;

-- ============================================================
-- 2. 创建文本搜索标准化函数
-- ============================================================

-- 创建文本搜索查询标准化函数
CREATE OR REPLACE FUNCTION normalize_search_query(query_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- 如果查询为空，返回空字符串
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN '';
  END IF;
  
  -- 清理和标准化查询文本
  RETURN trim(regexp_replace(query_text, '[^\w\s\u4e00-\u9fff]', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 3. 首先部署必要的数据库函数
-- ============================================================

-- 创建用户档案的函数（注册时使用）
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_username TEXT,
  p_role TEXT DEFAULT 'recruiter'
)
RETURNS UUID AS $$
DECLARE
  profile_id UUID;
  user_exists BOOLEAN;
BEGIN
  -- 检查用户是否存在于auth.users表中
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE id = p_user_id
  ) INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE EXCEPTION 'User does not exist in auth.users table: %', p_user_id;
  END IF;
  
  -- 检查用户名是否已存在
  IF EXISTS(SELECT 1 FROM profiles WHERE username = p_username) THEN
    RAISE EXCEPTION 'Username already exists: %', p_username;
  END IF;
  
  -- 创建用户档案
  INSERT INTO profiles (
    user_id,
    full_name,
    username,
    role,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_full_name,
    p_username,
    p_role,
    now(),
    now()
  ) RETURNING id INTO profile_id;
  
  RETURN profile_id;
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Username already exists: %', p_username;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建自动确认用户邮箱的函数
CREATE OR REPLACE FUNCTION confirm_user_email(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users 
  SET 
    email_confirmed_at = now(),
    updated_at = now()
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. 修复候选人插入函数（简化版本，避免全文搜索问题）
-- ============================================================

-- 插入候选人数据的函数，暂时跳过全文搜索
CREATE OR REPLACE FUNCTION insert_candidate_with_embedding(
  p_owner_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_current_title TEXT,
  p_current_company TEXT,
  p_location TEXT,
  p_years_of_experience INT,
  p_expected_salary_min INT,
  p_expected_salary_max INT,
  p_skills TEXT[],
  p_education JSONB,
  p_experience JSONB,
  p_certifications JSONB,
  p_languages JSONB,
  p_raw_data JSONB,
  p_status TEXT,
  p_embedding TEXT
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
  embedding_vector VECTOR(1536);
  search_text TEXT;
BEGIN
  -- 将字符串转换为VECTOR类型
  BEGIN
    embedding_vector := p_embedding::VECTOR(1536);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid embedding format: %', SQLERRM;
  END;
  
  -- 创建搜索文本（简单字符串拼接）
  search_text := COALESCE(p_name, '') || ' ' || 
                 COALESCE(p_current_title, '') || ' ' || 
                 COALESCE(p_current_company, '') || ' ' || 
                 COALESCE(p_location, '') || ' ' || 
                 COALESCE(array_to_string(p_skills, ' '), '');
  
  -- 插入候选人数据
  INSERT INTO resumes (
    owner_id, 
    name, 
    email, 
    phone, 
    current_title, 
    current_company, 
    location, 
    years_of_experience, 
    expected_salary_min, 
    expected_salary_max, 
    skills, 
    education, 
    experience, 
    certifications, 
    languages, 
    raw_data, 
    status, 
    embedding,
    fts_document,
    created_at,
    updated_at
  ) VALUES (
    p_owner_id, 
    p_name, 
    p_email, 
    p_phone, 
    p_current_title, 
    p_current_company, 
    p_location, 
    p_years_of_experience, 
    p_expected_salary_min, 
    p_expected_salary_max, 
    p_skills, 
    p_education, 
    p_experience, 
    p_certifications, 
    p_languages, 
    p_raw_data, 
    p_status, 
    embedding_vector,
    to_tsvector('simple', search_text),
    now(),
    now()
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. 修复职位插入函数（简化版本）
-- ============================================================

-- 插入职位数据的函数
CREATE OR REPLACE FUNCTION insert_job_with_embedding(
  p_owner_id UUID,
  p_title TEXT,
  p_company TEXT,
  p_location TEXT,
  p_employment_type TEXT,
  p_salary_min INT,
  p_salary_max INT,
  p_currency TEXT,
  p_description TEXT,
  p_requirements TEXT,
  p_benefits TEXT,
  p_skills_required TEXT[],
  p_experience_required INT,
  p_education_required TEXT,
  p_industry TEXT,
  p_department TEXT,
  p_status TEXT,
  p_embedding TEXT
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
  embedding_vector VECTOR(1536);
  search_text TEXT;
BEGIN
  -- 将字符串转换为VECTOR类型
  BEGIN
    embedding_vector := p_embedding::VECTOR(1536);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid embedding format: %', SQLERRM;
  END;
  
  -- 创建搜索文本
  search_text := COALESCE(p_title, '') || ' ' || 
                 COALESCE(p_company, '') || ' ' || 
                 COALESCE(p_location, '') || ' ' || 
                 COALESCE(p_description, '') || ' ' || 
                 COALESCE(p_requirements, '') || ' ' || 
                 COALESCE(array_to_string(p_skills_required, ' '), '');
  
  -- 插入职位数据
  INSERT INTO jobs (
    owner_id, 
    title, 
    company, 
    location, 
    employment_type, 
    salary_min, 
    salary_max, 
    currency, 
    description, 
    requirements, 
    benefits, 
    skills_required, 
    experience_required, 
    education_required, 
    industry, 
    department, 
    status, 
    embedding,
    fts_document,
    created_at,
    updated_at
  ) VALUES (
    p_owner_id, 
    p_title, 
    p_company, 
    p_location, 
    p_employment_type, 
    p_salary_min, 
    p_salary_max, 
    p_currency, 
    p_description, 
    p_requirements, 
    p_benefits, 
    p_skills_required, 
    p_experience_required, 
    p_education_required, 
    p_industry, 
    p_department, 
    p_status, 
    embedding_vector,
    to_tsvector('simple', search_text),
    now(),
    now()
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. 确保必要的表字段存在
-- ============================================================

-- 确保profiles表有username字段
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

-- 创建唯一索引（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_username') THEN
    CREATE UNIQUE INDEX idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
  END IF;
END $$;

-- 确保resumes表有所有必要的字段
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS fts_document tsvector;

-- 创建搜索索引（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resumes_fts') THEN
    CREATE INDEX idx_resumes_fts ON resumes USING gin(fts_document);
  END IF;
END $$;

-- 确保jobs表有所有必要的字段  
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS fts_document tsvector;

-- 创建搜索索引（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_jobs_fts') THEN
    CREATE INDEX idx_jobs_fts ON jobs USING gin(fts_document);
  END IF;
END $$;

-- ============================================================
-- 7. 测试函数创建成功
-- ============================================================

-- 测试所有函数是否创建成功
DO $$
BEGIN
  -- 测试create_user_profile函数
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_user_profile') THEN
    RAISE NOTICE '✅ create_user_profile 函数创建成功!';
  ELSE
    RAISE EXCEPTION '❌ create_user_profile 函数创建失败!';
  END IF;
  
  -- 测试insert_candidate_with_embedding函数
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'insert_candidate_with_embedding') THEN
    RAISE NOTICE '✅ insert_candidate_with_embedding 函数创建成功!';
  ELSE
    RAISE EXCEPTION '❌ insert_candidate_with_embedding 函数创建失败!';
  END IF;
  
  -- 测试confirm_user_email函数
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'confirm_user_email') THEN
    RAISE NOTICE '✅ confirm_user_email 函数创建成功!';
  ELSE
    RAISE EXCEPTION '❌ confirm_user_email 函数创建失败!';
  END IF;
  
  -- 测试normalize_search_query函数
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'normalize_search_query') THEN
    RAISE NOTICE '✅ normalize_search_query 函数创建成功!';
  ELSE
    RAISE EXCEPTION '❌ normalize_search_query 函数创建失败!';
  END IF;
END $$;

SELECT '🎉 数据库函数修复完成！候选人上传功能现在应该可以正常工作了。' as fix_status; 