-- 添加用户管理函数
-- 用于处理用户注册和档案创建

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

-- 确保profiles表有username字段
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username 
ON profiles(username) 
WHERE username IS NOT NULL;

-- 授权给认证用户
GRANT EXECUTE ON FUNCTION confirm_user_email TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
