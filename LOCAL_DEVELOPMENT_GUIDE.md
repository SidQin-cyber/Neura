# Neura 本地开发工作流程指南

## 🎯 概述

本指南将帮助您使用 Supabase CLI 进行本地优先的开发，确保数据库变更的版本控制和安全部署。

## 📋 前提条件

- ✅ Supabase CLI 已安装
- ✅ Docker Desktop 已安装并运行
- ✅ 本地 Supabase 环境已启动

## 🚀 快速开始

### 1. 启动本地环境

```bash
# 启动本地 Supabase 服务（如果尚未启动）
supabase start

# 检查状态
supabase status
```

### 2. 使用本地环境进行开发

```bash
# 启动前端开发服务器（使用 .env.local 配置）
npm run dev

# 访问本地服务
# - 前端应用: http://localhost:3000
# - Supabase Studio: http://127.0.0.1:54323
# - 数据库: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## 🔄 标准开发工作流

### 场景1: 修改现有搜索算法

当您需要优化混合搜索算法时：

```bash
# 1. 在本地数据库中进行修改
# 可以使用 Supabase Studio 或直接连接数据库

# 2. 生成迁移文件
supabase db diff -f optimize_search_algorithm

# 3. 查看生成的迁移文件
ls supabase/migrations/

# 4. 测试迁移（重置并重新应用所有迁移）
supabase db reset

# 5. 在前端测试功能
npm run dev

# 6. 提交到 Git
git add supabase/migrations/
git commit -m "优化混合搜索算法的分数归一化"
```

### 场景2: 添加新的数据库表

```bash
# 1. 在本地创建新表和相关函数
# 使用 Supabase Studio 或 SQL 命令

# 2. 生成迁移
supabase db diff -f add_new_feature_table

# 3. 验证迁移
supabase db reset

# 4. 测试新功能
node test-local-setup.js

# 5. 提交变更
git add .
git commit -m "添加新功能相关的数据库表"
```

### 场景3: 部署到线上

```bash
# 1. 确保本地测试通过
npm run build
npm run test  # 如果有测试

# 2. 推送数据库变更到线上
supabase db push

# 3. 部署前端到 Vercel
git push origin main  # 触发 Vercel 自动部署
```

## 🛠️ 常用命令

### 数据库管理

```bash
# 查看当前状态
supabase status

# 重置本地数据库
supabase db reset

# 生成迁移文件
supabase db diff -f migration_name

# 查看迁移历史
supabase migration list

# 推送到线上
supabase db push

# 从线上拉取（谨慎使用）
supabase db pull
```

### 调试和测试

```bash
# 测试本地环境
node test-local-setup.js

# 查看日志
supabase logs

# 连接到本地数据库
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## 🔧 环境配置

### 本地开发环境变量 (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

### 线上环境变量

需要在 Vercel 或您的部署平台中配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 🎯 最佳实践

### 1. 数据库变更

- ✅ **总是在本地先测试**
- ✅ **使用描述性的迁移文件名**
- ✅ **小步快跑，频繁提交**
- ❌ **不要直接在线上修改数据库**

### 2. 混合搜索算法优化

当您需要优化搜索算法时：

1. 在本地修改 `search_candidates_rpc` 函数
2. 测试不同的权重组合 (`fts_weight`, `vector_weight`)
3. 使用 `supabase db diff` 生成迁移
4. 在本地验证搜索结果的质量
5. 提交并部署

### 3. 故障排除

如果遇到问题：

```bash
# 查看详细错误信息
supabase db reset --debug

# 检查 Docker 容器状态
docker ps

# 重启 Supabase 服务
supabase stop
supabase start
```

## 📚 参考资源

- [Supabase CLI 文档](https://supabase.com/docs/guides/cli)
- [数据库迁移最佳实践](https://supabase.com/docs/guides/cli/local-development)
- [混合搜索算法说明](./HYBRID_SEARCH_README.md)

---

**记住：本地开发 → 生成迁移 → 测试 → 提交 → 部署**

这个工作流程确保了您的数据库变更是可追踪、可回滚、可重现的。 