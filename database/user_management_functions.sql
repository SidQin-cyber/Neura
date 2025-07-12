-- 用户管理相关的SQL函数
-- 请在 Supabase Dashboard 的 SQL Editor 中执行此脚本

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

-- 创建获取用户信息的函数
CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS TABLE(
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建批量确认用户邮箱的函数（管理员功能）
CREATE OR REPLACE FUNCTION confirm_all_unconfirmed_emails()
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建删除用户的函数
CREATE OR REPLACE FUNCTION delete_user_account(user_id UUID)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER; 

-- 添加username字段到profiles表
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username 
ON profiles(username) 
WHERE username IS NOT NULL; 