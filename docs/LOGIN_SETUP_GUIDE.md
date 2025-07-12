# 登录功能设置指南

## 🔐 登录功能概述

Neura 平台现在实现了强制登录功能：

✅ **强制登录** - 必须登录才能访问主界面
✅ **极简界面** - 简洁的登录界面设计
✅ **仅账号密码** - 不支持注册和忘记密码
✅ **Admin账户** - 预设管理员账户

## 🚀 快速设置

### 1. 创建Admin账户

在 Supabase Dashboard 中执行以下步骤：

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目：`suhchngsnkkuhjdioalo`
3. 转到 **SQL Editor**
4. 执行以下SQL脚本：

```sql
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
```

### 2. 启动应用

```bash
cd /Users/sidqin/Desktop/Neura
npm run dev
```

### 3. 测试登录

1. 访问 `http://localhost:3000`
2. 系统会自动重定向到登录页面 (`/login`)
3. 使用以下账户信息：
   - **邮箱**: `admin@neura.com`
   - **密码**: `123456`

## 🔒 安全特性

### 强制登录
- 所有路由都需要认证
- 未登录用户自动重定向到登录页面
- 已登录用户访问登录页面会重定向到主页

### 访问控制
- 基于 Supabase Auth 的用户认证
- Row Level Security (RLS) 数据隔离
- 用户只能访问自己的数据

### 会话管理
- 自动会话刷新
- 安全的Cookie管理
- 登出功能

## 🎨 界面设计

### 登录界面特点
- **极简设计** - 仅有必要的输入字段
- **品牌标识** - 显示 "Neura - AI 招聘平台"
- **响应式布局** - 适配不同屏幕尺寸
- **友好提示** - 清晰的错误和成功消息

### 主界面
- **侧边栏** - 功能导航
- **搜索面板** - 智能搜索功能
- **用户菜单** - 用户信息和登出

## 📝 添加新用户

如需添加新的内测用户，请在 Supabase Dashboard 中执行：

```sql
-- 替换以下信息为实际用户信息
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
  'user@example.com',  -- 替换为实际邮箱
  crypt('password123', gen_salt('bf')),  -- 替换为实际密码
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test User"}',  -- 替换为实际姓名
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
```

## 🔧 故障排除

### 常见问题

1. **登录失败**
   - 检查邮箱和密码是否正确
   - 确认admin账户已创建
   - 检查网络连接

2. **重定向循环**
   - 清除浏览器缓存和Cookie
   - 检查中间件配置
   - 确认Supabase配置正确

3. **页面空白**
   - 检查控制台错误信息
   - 确认开发服务器正在运行
   - 检查环境变量配置

### 调试步骤

1. 检查浏览器控制台错误
2. 查看Network标签页的请求状态
3. 检查Supabase Dashboard的Auth用户列表
4. 确认环境变量配置正确

## 📊 当前状态

- ✅ 中间件强制登录
- ✅ 极简登录界面
- ✅ Admin账户创建脚本
- ✅ 会话管理
- ✅ 用户菜单和登出功能
- ✅ 响应式设计

## 🎯 下一步

1. 创建admin账户
2. 测试登录功能
3. 验证上传功能（需要登录）
4. 添加更多内测用户
5. 自定义登录界面背景（按需）

---

**注意**: 这是内测版本，所有用户都需要手动创建。不提供自助注册功能。 