# 搜索功能修复指南

## 问题诊断

您的搜索功能无法返回结果的主要原因是**双模型搜索配置**导致的。系统设计了双模型搜索（text-embedding-3-small + text-embedding-3-large），但实际只存储了1536维的小模型向量，导致搜索时找不到所需的3072维大模型向量。

## 解决方案

我们将系统回归到使用单一的`text-embedding-3-small`模型，这样既简化了架构，又降低了成本。

## 修复步骤

### 1. 数据库清理

首先执行数据库清理脚本来移除双模型相关的配置：

```bash
# 在Supabase SQL Editor中执行
psql -h your-db-host -U your-username -d your-database -f remove-dual-embedding.sql
```

或者在Supabase Dashboard的SQL Editor中直接执行`remove-dual-embedding.sql`文件的内容。

### 2. 验证数据库状态

运行诊断脚本检查数据库状态：

```bash
# 在Supabase SQL Editor中执行
psql -h your-db-host -U your-username -d your-database -f debug-search-issue.sql
```

关键检查项：
- 简历表中是否有数据
- embedding字段是否有值
- embedding维度是否为1536
- 搜索函数是否正常工作

### 3. 重新部署Edge Functions

更新后的`process-resume`函数已经优化，确保只使用单模型：

```bash
# 部署更新后的简历处理函数
supabase functions deploy process-resume
```

### 4. 测试搜索功能

使用提供的测试脚本验证搜索功能：

```bash
# 设置环境变量
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-supabase-anon-key"
export OPENAI_API_KEY="your-openai-api-key"

# 运行测试
node test-search-functionality.js
```

### 5. 重新处理现有数据（如果需要）

如果现有的简历数据没有embedding或embedding有问题，需要重新处理：

1. 删除有问题的简历记录
2. 重新上传简历文件
3. 确保新的处理函数正确生成embedding

## 代码修改说明

### 1. process-resume函数优化

- 移除了双模型embedding生成
- 只使用`text-embedding-3-small`模型
- 增加了详细的日志记录
- 改进了错误处理

### 2. 搜索API保持不变

搜索API (`app/api/search/route.ts`) 已经正确使用单模型搜索函数，无需修改。

### 3. 数据库函数更新

- 确保`search_candidates_rpc`和`search_jobs_rpc`函数正确
- 移除了所有双模型相关的函数
- 添加了`r.embedding IS NOT NULL`检查确保数据完整性

## 关键配置检查

### 1. 环境变量

确保以下环境变量正确设置：

```bash
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. 数据库权限

确保RLS策略正确配置，用户能够访问自己的数据：

```sql
-- 检查RLS策略
SELECT * FROM pg_policies WHERE tablename = 'resumes';
```

### 3. 向量扩展

确保pgvector扩展正确安装：

```sql
-- 检查扩展
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## 常见问题排查

### 1. 搜索返回空结果

- 检查数据库中是否有简历数据
- 确认embedding字段不为空
- 检查用户权限和RLS策略
- 验证相似度阈值设置（当前为0.0）

### 2. Embedding生成失败

- 检查OpenAI API密钥是否有效
- 确认API配额是否充足
- 检查网络连接

### 3. 数据库连接错误

- 验证Supabase URL和密钥
- 检查数据库连接字符串
- 确认服务角色密钥权限

## 性能优化建议

### 1. 索引优化

确保embedding字段有正确的索引：

```sql
-- 检查索引
SELECT * FROM pg_indexes WHERE tablename = 'resumes' AND indexname LIKE '%embedding%';
```

### 2. 相似度阈值调整

根据实际搜索效果调整相似度阈值：

```javascript
// 在搜索API中调整
similarity_threshold: 0.1, // 可以适当提高以过滤低质量结果
```

### 3. 缓存策略

考虑为常用搜索查询添加缓存机制。

## 监控和维护

### 1. 定期检查

- 监控搜索API的响应时间
- 检查embedding生成的成功率
- 观察搜索结果的质量

### 2. 日志分析

- 查看Edge Functions的日志
- 分析搜索失败的原因
- 监控API调用频率

### 3. 数据质量

- 定期检查embedding数据完整性
- 监控新上传简历的处理状态
- 清理无效或重复的数据

## 总结

通过移除双模型配置并优化单模型搜索，您的搜索功能应该能够正常工作。关键是确保：

1. 数据库中有正确的1536维embedding数据
2. 搜索函数使用正确的向量维度
3. 用户权限和RLS策略配置正确
4. OpenAI API正常工作

如果按照本指南操作后仍有问题，请检查具体的错误日志，并根据错误信息进行针对性排查。 