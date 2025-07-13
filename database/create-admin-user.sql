-- 创建admin用户
-- 注意：这个脚本需要在Supabase Dashboard的SQL Editor中以管理员身份运行

-- 创建admin用户
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  email_change_token_new,
  recovery_token,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  last_sign_in_at,
  phone,
  phone_confirmed_at,
  phone_change_token,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at,
  is_anonymous
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@neura.com',
  crypt('123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User"}',
  false,
  now(),
  null,
  null,
  '',
  '',
  0,
  null,
  '',
  null,
  false,
  null,
  false
) ON CONFLICT (email) DO NOTHING;

-- 创建对应的profile记录
INSERT INTO public.profiles (
  user_id,
  full_name,
  company,
  role,
  created_at,
  updated_at
) 
SELECT 
  u.id,
  'Admin User',
  'Neura',
  'admin',
  now(),
  now()
FROM auth.users u 
WHERE u.email = 'admin@neura.com'
ON CONFLICT (user_id) DO NOTHING;

-- 验证用户创建
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data
FROM auth.users 
WHERE email = 'admin@neura.com'; 