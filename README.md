# Neura - AI-Powered Recruitment System

这是一个基于 AI 的智能招聘系统，支持高效的候选人和职位匹配。

## 核心功能

- 🔍 **智能搜索**: 基于向量化和全文搜索的混合搜索算法
- ⚡ **Spark 优化**: 智能解析自然语言查询，提升搜索精度
- 📊 **候选人管理**: 支持批量导入和管理候选人信息
- 💼 **职位管理**: 职位发布和匹配功能
- 🎯 **精准匹配**: 基于技能、经验、地理位置等多维度匹配

## Spark 优化功能测试

本项目提供了完整的测试套件来评估 Spark 按钮优化效果：

### 快速测试（推荐）
```bash
# 5个代表性测试用例，2-3分钟完成
node scripts/quick-spark-test.js
```

### 详细批量测试
```bash
# 15个详细测试用例，10-15分钟完成
node scripts/spark-optimization-batch-test.js
```

### 测试说明
- **测试目标**: 比较 Spark 优化前后的搜索召回率和准确率
- **测试场景**: 涵盖前端、AI、运维、设计等不同技术领域
- **评估指标**: 召回率、准确率、排名质量
- **详细文档**: 参见 [SPARK_OPTIMIZATION_TEST_GUIDE.md](SPARK_OPTIMIZATION_TEST_GUIDE.md)

## 技术栈

- **前端**: Next.js 14, React, TypeScript, Tailwind CSS
- **后端**: Supabase (PostgreSQL + Edge Functions)
- **AI**: OpenAI GPT-4, Embedding API
- **搜索**: Vector Search + Full-Text Search (PGroonga)

## 快速开始

1. **环境配置**
   ```bash
   cp .env.example .env.local
   # 配置必要的环境变量
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **数据库初始化**
   ```bash
   # 运行 Supabase 迁移
   npx supabase db push
   ```

## 环境变量

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

## 项目结构

```
Neura/
├── app/                    # Next.js App Router
│   ├── api/               # API 端点
│   └── components/        # 页面组件
├── components/            # 共享组件
├── lib/                   # 工具库
├── scripts/               # 测试和工具脚本
├── supabase/             # 数据库迁移和函数
└── processed_resumes/    # 测试数据
```

## 测试和调试

### 搜索功能测试
```bash
# 测试搜索算法性能
node scripts/comprehensive-search-test.js

# 测试召回率改进
node scripts/test-recall-improvement.js

# 快速搜索验证
node scripts/quick-recall-test.js
```

### 数据库调试
```bash
# 检查数据库连接和数据
node scripts/test-database-connection.js

# 验证搜索函数
node scripts/test-enhanced-search-simple.js
```

## 部署

本项目建议部署到 Vercel：

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
