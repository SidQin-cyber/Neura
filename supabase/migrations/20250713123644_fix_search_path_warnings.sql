-- 修复数据库函数搜索路径警告
-- 日期: 2024-12-06
-- 功能: 为特定函数添加 SET search_path = '' 参数以解决安全警告

-- 只修复用户管理相关函数，避免重复定义已有的搜索函数

-- 1. 修复用户档案创建函数
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_username TEXT,
  p_role TEXT DEFAULT 'recruiter'
)
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- 2. 修复用户信息获取函数
CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS TABLE(
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'full_name' as full_name,
    p.role,
    u.created_at
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.user_id
  WHERE u.id = user_id;
END;
$$;

-- 3. 修复确认用户邮箱函数
CREATE OR REPLACE FUNCTION confirm_user_email(user_email TEXT)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users 
  SET 
    email_confirmed_at = now(),
    updated_at = now()
  WHERE email = user_email;
END;
$$;

-- 4. 修复批量确认邮箱函数
CREATE OR REPLACE FUNCTION confirm_all_unconfirmed_emails()
RETURNS INTEGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE auth.users 
  SET 
    email_confirmed_at = now(),
    updated_at = now()
  WHERE email_confirmed_at IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 5. 修复删除用户函数
CREATE OR REPLACE FUNCTION delete_user_account(user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 删除profile
  DELETE FROM profiles WHERE user_id = user_id;
  
  -- 删除用户的其他数据
  DELETE FROM resumes WHERE owner_id = user_id;
  DELETE FROM jobs WHERE owner_id = user_id;
  DELETE FROM interactions WHERE user_id = user_id;
  DELETE FROM search_history WHERE user_id = user_id;
  
  -- 删除认证用户
  DELETE FROM auth.users WHERE id = user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- 完成提示
SELECT 'Search path warnings fixed for user management functions' AS message; 