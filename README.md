# Neura AI 招聘平台

基于 AI 的智能招聘平台，提供候选人搜索、职位匹配和数据管理功能。

![Neura Screenshot](/public/screenshot-2025-05-04.png)

## 🚀 快速开始

### 1. 创建Admin账户

登录 [Supabase Dashboard](https://supabase.com/dashboard) 并在SQL Editor中执行：

```sql
-- 创建admin用户
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, role, aud, confirmation_token,
  email_change_token_new, recovery_token, raw_app_meta_data,
  raw_user_meta_data, is_super_admin, last_sign_in_at,
  phone, phone_confirmed_at, phone_change_token,
  email_change_token_current, email_change_confirm_status,
  banned_until, reauthentication_token, reauthentication_sent_at,
  is_sso_user, deleted_at, is_anonymous
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'admin@neura.com', crypt('123456', gen_salt('bf')), now(),
  now(), now(), 'authenticated', 'authenticated', '',
  '', '', '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User"}', false, now(),
  null, null, '', '', 0, null, '', null, false, null, false
) ON CONFLICT (email) DO NOTHING;
```

### 2. 启动应用

```bash
git clone <repository-url>
cd Neura
npm install
npm run dev
```

### 3. 登录

访问 `http://localhost:3000` 并使用以下账户：
- **邮箱**: `admin@neura.com`
- **密码**: `123456`

## 🛠 核心功能

### 认证系统
- ✅ **强制登录** - 必须登录才能访问
- ✅ **极简界面** - 简洁的登录体验
- ✅ **会话管理** - 自动会话刷新
- ✅ **用户隔离** - 基于RLS的数据隔离

### 数据管理
- ✅ **候选人上传** - 支持JSON格式（单个对象/数组）
- ✅ **职位上传** - 支持JSON格式（单个对象/数组）
- ✅ **数据分离** - 候选人和职位独立存储
- ✅ **格式验证** - 智能JSON验证和转换

### 搜索功能
- ✅ **语义搜索** - 基于向量相似度的智能搜索
- ✅ **候选人搜索** - 独立的候选人搜索通路
- ✅ **职位搜索** - 独立的职位搜索通路
- ✅ **高级筛选** - 多维度搜索筛选

### 用户界面
- ✅ **响应式设计** - 适配不同屏幕尺寸
- ✅ **侧边栏导航** - 48px窄边栏设计
- ✅ **对话式界面** - 聊天式搜索交互
- ✅ **实时反馈** - Toast通知和状态指示

## 🏗 技术架构

### 前端
- **Next.js 15** - App Router + React Server Components
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式系统
- **shadcn/ui** - UI组件库

### 后端
- **Supabase** - 数据库 + 认证 + 存储
- **PostgreSQL** - 关系型数据库
- **pgvector** - 向量搜索
- **Row Level Security** - 数据安全

### AI 能力
- **OpenAI API** - GPT-4o + text-embedding-3-small
- **向量搜索** - 语义相似度匹配
- **智能解析** - 简历和职位智能处理

## 📁 数据格式

### 候选人JSON示例

```json
{
  "name": "张三",
  "title": "高级前端工程师",
  "email": "zhangsan@example.com",
  "phone": "13800138000",
  "location": "北京",
  "skills": ["React", "TypeScript", "Node.js"],
  "years_of_experience": 5,
  "expected_salary_min": 25000,
  "expected_salary_max": 35000
}
```

### 职位JSON示例

```json
{
  "title": "高级前端工程师",
  "company": "科技公司",
  "location": "上海",
  "employment_type": "full_time",
  "salary_min": 20000,
  "salary_max": 40000,
  "skills_required": ["React", "Vue", "TypeScript"],
  "experience_required": 3
}
```

## 📚 文档

- [登录功能设置指南](docs/LOGIN_SETUP_GUIDE.md)
- [上传功能验证指南](docs/UPLOAD_VERIFICATION_GUIDE.md)
- [JSON格式支持说明](docs/JSON_FORMAT_SUPPORT.md)
- [配置指南](NEURA_CONFIGURATION_GUIDE.md)

## 🔒 安全特性

- **强制认证** - 所有路由都需要登录
- **数据隔离** - 用户只能访问自己的数据
- **会话安全** - 自动会话管理和刷新
- **API保护** - 所有API端点都需要认证

## 🎯 项目状态

- ✅ **基础架构** - 完整的前后端架构
- ✅ **认证系统** - 强制登录和会话管理
- ✅ **数据管理** - 上传、存储、验证
- ✅ **搜索功能** - 语义搜索和筛选
- ✅ **用户界面** - 响应式设计和交互
- ✅ **部署就绪** - 可投入生产使用

## 📞 技术支持

如有问题，请查看相关文档或联系技术支持。

---

**注意**: 这是内测版本，用户需要手动创建。不提供自助注册功能。
