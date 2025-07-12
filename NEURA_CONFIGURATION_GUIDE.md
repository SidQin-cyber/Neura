# Neura AI 招聘平台配置指南

## 快速配置

### 1. 创建环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
# ================================
# CORE CONFIGURATION (REQUIRED)
# ================================

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://suhchngsnkkuhjdioalo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1aGNobmdzbmtrdWhqZGlvYWxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyOTU2NDQsImV4cCI6MjA2Nzg3MTY0NH0.N8t6_TKpTtRJFkIjEV92pre6vZItavaDuF9rgrG4zOE

# OpenAI Configuration
OPENAI_API_KEY=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

# ================================
# OPTIONAL CONFIGURATIONS
# ================================

# Search Provider Configuration
TAVILY_API_KEY=

# Feature Toggles
NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY=true
NEXT_PUBLIC_ENABLE_SHARE=true

# Redis Configuration (Optional)
USE_LOCAL_REDIS=false
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Other AI Providers (Optional)
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
GROQ_API_KEY=
```

### 2. 配置 Supabase 数据库

#### 2.1 创建数据库表

在 Supabase 仪表板中，转到 SQL Editor 并执行以下 SQL 脚本：

```sql
-- 执行 database/schema.sql 文件内容
-- 这将创建所有必需的表和索引
```

#### 2.2 创建 RPC 函数

执行 `database/rpc_functions.sql` 文件中的内容：

```sql
-- 执行 database/rpc_functions.sql 文件内容
-- 这将创建所有搜索和匹配函数
```

#### 2.3 设置存储桶

在 Supabase 仪表板的 Storage 部分创建以下存储桶：

1. **resumes-raw** - 存储原始简历文件

   - 设置为公共读取权限
   - 允许上传 PDF、DOC、DOCX、TXT 文件

2. **resumes-processed** - 存储处理后的简历文件
   - 设置为公共读取权限

### 3. 配置 Supabase Edge Functions

#### 3.1 获取 Service Role Key

1. 在 Supabase 仪表板中，转到 Settings → API
2. 复制 `service_role` 密钥（注意：这是敏感信息）

#### 3.2 设置 Edge Functions 环境变量

在终端中运行以下命令：

```bash
# 导航到项目目录
cd /Users/sidqin/Desktop/Neura

# 创建环境变量文件
cat > .env.supabase << EOF
OPENAI_API_KEY=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
EOF

# 设置 Supabase Edge Functions 环境变量
supabase secrets set --env-file .env.supabase
```

#### 3.3 部署 Edge Functions

```bash
# 部署所有 Edge Functions
supabase functions deploy process-resume
supabase functions deploy get-embedding
supabase functions deploy copilot-qna
```

### 4. 验证配置

#### 4.1 启动开发服务器

```bash
bun dev
```

#### 4.2 测试连接

访问 `http://localhost:3000` 并验证：

1. ✅ 页面能够正常加载
2. ✅ 侧边栏显示招聘功能模块
3. ✅ 搜索界面正常显示
4. ✅ 用户认证功能正常工作

## 详细配置说明

### 数据库配置

- **profiles**: 用户配置文件
- **resumes**: 简历信息和向量嵌入
- **jobs**: 职位信息
- **interactions**: 用户交互记录
- **candidate_job_matches**: 候选人-职位匹配结果
- **search_history**: 搜索历史记录

### AI 功能配置

- **向量搜索**: 使用 pgvector 进行语义搜索
- **简历解析**: 使用 OpenAI GPT-4o 解析简历内容
- **文本嵌入**: 使用 OpenAI text-embedding-3-small 生成向量
- **智能问答**: 使用 OpenAI GPT-4o 提供招聘建议

### 存储配置

- **简历文件**: 存储在 Supabase Storage 中
- **向量数据**: 存储在 PostgreSQL 中
- **搜索缓存**: 可选使用 Redis 进行缓存

### 安全配置

- **Row Level Security**: 所有表都启用了 RLS
- **API 密钥**: 分别配置不同服务的 API 密钥
- **CORS**: Edge Functions 配置了适当的 CORS 头

## 故障排除

### 常见问题

1. **Edge Functions 部署失败**

   - 确保 Supabase CLI 已正确安装
   - 检查 API 密钥是否正确设置
   - 验证网络连接

2. **向量搜索不工作**

   - 确保 pgvector 扩展已启用
   - 检查嵌入数据是否正确生成
   - 验证 RPC 函数是否正确创建

3. **简历上传失败**
   - 检查 Storage 权限设置
   - 确保存储桶已创建
   - 验证文件类型和大小限制

### 日志检查

```bash
# 检查 Edge Functions 日志
supabase functions logs process-resume
supabase functions logs get-embedding
supabase functions logs copilot-qna

# 检查本地开发日志
bun dev --verbose
```

## 下一步

配置完成后，您可以：

1. 🎯 **开始使用智能搜索** - 在搜索页面测试候选人和职位搜索
2. 📄 **上传简历** - 使用文件上传功能测试简历解析
3. 🤖 **AI 问答** - 测试招聘助手的问答功能
4. 📊 **查看分析** - 检查搜索统计和匹配结果

有问题？请查看 [开发总结文档](./NEURA_DEVELOPMENT_SUMMARY.md) 或联系技术支持。
