# Neura - AI 招聘平台

## 🎯 项目概述

Neura 是一个基于 AI 的智能招聘平台，通过混合搜索技术和大语言模型，实现高效的人才匹配。

## 🚀 技术栈

- **前端**: Next.js 14 (App Router), React, TypeScript
- **UI**: Shadcn UI, Radix UI, Tailwind CSS
- **后端**: Supabase (PostgreSQL + Edge Functions)
- **AI**: Vercel AI SDK, OpenAI
- **部署**: Vercel + Supabase

## 📋 开发规则

### 🔥 重要：数据库开发规则

**所有数据库修改必须遵循以下流程：**
```
本地修改 → 生成迁移 → 测试 → 提交 → 部署到线上
```

**详细规则请参考：**
- [数据库开发规则](./DATABASE_DEVELOPMENT_RULES.md)
- [本地开发指南](./LOCAL_DEVELOPMENT_GUIDE.md)

### 核心原则
- ✅ 使用 Supabase CLI 生成迁移文件
- ✅ 每个变更都必须有回滚方案
- ✅ 在本地充分测试后再部署
- ❌ 禁止直接在线上执行 SQL

## 🛠️ 开发环境设置

### 前提条件
- Node.js 18+
- Docker Desktop
- Supabase CLI

### 快速开始

```bash
# 1. 克隆项目
git clone [your-repo-url]
cd neura

# 2. 安装依赖
npm install

# 3. 启动本地 Supabase
supabase start

# 4. 启动开发服务器
npm run dev
```

## 📚 文档

- [本地开发指南](./LOCAL_DEVELOPMENT_GUIDE.md)
- [数据库开发规则](./DATABASE_DEVELOPMENT_RULES.md)
- [混合搜索算法说明](./HYBRID_SEARCH_README.md)
- [配置指南](./NEURA_CONFIGURATION_GUIDE.md)

## 🔧 核心功能

### 混合搜索算法
- 向量搜索（语义理解）
- 全文搜索（关键词匹配）
- 加权融合排序

### AI 驱动的功能
- 智能简历解析
- 自动技能提取
- 候选人-职位匹配
- 对话式搜索界面

## 🚀 部署

### 数据库部署
```bash
# 1. 在本地测试
supabase db reset

# 2. 部署到线上
supabase db push
```

### 前端部署
```bash
# 推送到 main 分支会自动触发 Vercel 部署
git push origin main
```

## 📊 项目结构

```
neura/
├── app/                 # Next.js App Router
├── components/          # React 组件
├── lib/                 # 工具函数和配置
├── supabase/           # Supabase 配置和迁移
│   ├── migrations/     # 数据库迁移文件
│   └── functions/      # Edge Functions
├── database/           # 数据库脚本（仅参考）
└── docs/              # 项目文档
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 遵循数据库开发规则
4. 提交变更 (`git commit -m 'Add some amazing feature'`)
5. 推送到分支 (`git push origin feature/amazing-feature`)
6. 创建 Pull Request

## 📝 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

**⚠️ 重要提醒：请务必阅读并遵循 [数据库开发规则](./DATABASE_DEVELOPMENT_RULES.md)**
