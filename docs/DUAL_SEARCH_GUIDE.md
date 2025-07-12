# 双模型智能搜索配置指南

## 概述

双模型智能搜索是 Neura AI 招聘平台的核心功能，通过结合 OpenAI 的`text-embedding-3-small`和`text-embedding-3-large`模型，实现两阶段查询以获得更精准的搜索结果。

## 技术架构

### 查询流程

1. **第一阶段（粗筛）**：使用`text-embedding-3-small`（1536 维）进行快速相似度搜索，获取 Top 20 候选结果
2. **第二阶段（精排）**：使用`text-embedding-3-large`（3072 维）对候选结果重新排序
3. **综合评分**：70% 大模型相似度 + 30% 小模型相似度

### 性能优势

- **效率**：小模型快速筛选，减少大模型计算量
- **精度**：大模型精排，提高匹配准确性
- **成本**：平衡 API 调用成本和搜索质量

## 数据库配置

### 1. 执行升级脚本

```bash
# 在Supabase SQL Editor中执行
psql -h your-db-host -U your-username -d your-database -f database/dual_embedding_upgrade.sql
```

### 2. 数据库结构变更

升级脚本会添加以下字段：

- `resumes.embedding_large` - VECTOR(3072)
- `jobs.embedding_large` - VECTOR(3072)
- `dual_embedding_status` - 状态跟踪表

### 3. 新增 RPC 函数

- `search_candidates_dual_stage_rpc` - 双阶段候选人搜索
- `search_jobs_dual_stage_rpc` - 双阶段职位搜索
- `calculate_dual_match_score` - 双模型匹配分数计算
- `get_dual_search_stats_rpc` - 搜索统计
- `batch_process_large_embeddings` - 批量处理功能

## Edge Functions 配置

### 1. 部署新的 Edge Functions

```bash
# 部署双模型embedding函数
supabase functions deploy get-dual-embedding

# 部署双模型简历处理函数
supabase functions deploy process-resume-dual
```

### 2. 环境变量配置

在 Supabase Dashboard 中设置：

```
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 前端集成

### 1. 引入双模型搜索工具

```typescript
import { dualSearchTool } from '@/lib/tools/dual-search'

// 执行双阶段搜索
const results = await dualSearchTool.searchCandidatesDualStage(
  '高级React开发工程师',
  { location: '北京', experienceMin: 3 },
  { enableDualStage: true, finalCount: 10 }
)
```

### 2. 搜索配置选项

```typescript
interface DualSearchOptions {
  similarityThresholdSmall?: number // 小模型阈值 (默认: 0.6)
  similarityThresholdLarge?: number // 大模型阈值 (默认: 0.7)
  firstStageCount?: number // 第一阶段结果数 (默认: 20)
  finalCount?: number // 最终结果数 (默认: 10)
  enableDualStage?: boolean // 启用双阶段 (默认: true)
}
```

## 使用说明

### 1. 搜索优化建议

#### 候选人搜索

- 使用具体技能关键词：`"React开发"`、`"机器学习工程师"`
- 包含行业背景：`"互联网"`、`"金融科技"`
- 描述经验水平：`"5年经验"`、`"资深开发者"`
- 提及地点偏好：`"北京"`、`"远程工作"`

#### 职位搜索

- 包含职位类型：`"产品经理"`、`"数据科学家"`
- 描述公司规模：`"初创公司"`、`"大型企业"`
- 提及薪资范围：`"15-25K"`、`"年薪30万"`
- 包含福利待遇：`"股票期权"`、`"弹性工作"`

### 2. 参数调优指南

#### 精确匹配场景

```typescript
const options = {
  similarityThresholdSmall: 0.7,
  similarityThresholdLarge: 0.8,
  firstStageCount: 15,
  finalCount: 5
}
```

#### 宽泛搜索场景

```typescript
const options = {
  similarityThresholdSmall: 0.5,
  similarityThresholdLarge: 0.6,
  firstStageCount: 30,
  finalCount: 15
}
```

### 3. 搜索结果解读

#### 相似度分数

- `similarity_small`: 小模型相似度 (0-1)
- `similarity_large`: 大模型相似度 (0-1)
- `final_score`: 综合评分 (0-1)

#### 匹配度等级

- **优秀匹配** (90%+): 高度相关，建议优先考虑
- **良好匹配** (80-90%): 相关性较高，值得关注
- **中等匹配** (70-80%): 部分相关，可以考虑
- **低匹配** (<70%): 相关性较低，谨慎考虑

## 批量处理功能

### 1. 检查覆盖率

```typescript
const stats = await dualSearchTool.getDualSearchStats()
console.log('覆盖率:', stats.embedding_coverage_percentage)
```

### 2. 批量生成 large embeddings

```typescript
// 批量处理简历
const resumeResult = await dualSearchTool.batchProcessLargeEmbeddings(
  'resumes',
  10
)

// 批量处理职位
const jobResult = await dualSearchTool.batchProcessLargeEmbeddings('jobs', 10)
```

## 监控和维护

### 1. 性能监控

- 监控 API 调用次数和成本
- 跟踪搜索响应时间
- 观察搜索结果质量

### 2. 定期维护

- 定期检查 embedding 覆盖率
- 批量处理新增记录
- 优化搜索参数

### 3. 错误处理

- 检查`dual_embedding_status`表中的失败记录
- 重新处理失败的 embedding 生成
- 监控 Edge Functions 的错误日志

## 最佳实践

### 1. 成本控制

- 根据业务需求调整`firstStageCount`和`finalCount`
- 在非关键场景考虑禁用双阶段查询
- 监控 OpenAI API 使用量

### 2. 性能优化

- 合理设置相似度阈值，避免过多无效结果
- 使用缓存机制减少重复查询
- 批量处理 embedding 生成

### 3. 用户体验

- 提供搜索建议和示例
- 显示搜索结果的相似度分数
- 支持搜索参数的个性化配置

## 故障排除

### 常见问题

#### 1. 搜索结果为空

- 检查相似度阈值是否过高
- 确认数据库中有相关记录
- 验证 embedding 是否正确生成

#### 2. 搜索速度慢

- 减少`firstStageCount`数量
- 检查数据库索引是否正常
- 优化查询参数

#### 3. 成本过高

- 降低查询频率
- 减少最终结果数量
- 考虑在某些场景禁用双阶段

#### 4. 匹配质量差

- 调整相似度阈值
- 改进搜索关键词
- 检查原始数据质量

### 调试步骤

1. **检查数据库连接**

   ```sql
   SELECT COUNT(*) FROM resumes WHERE embedding_large IS NOT NULL;
   ```

2. **验证 Edge Functions**

   ```bash
   supabase functions logs get-dual-embedding --limit 10
   ```

3. **测试搜索功能**
   ```typescript
   const stats = await dualSearchTool.getDualSearchStats()
   console.log('统计信息:', stats)
   ```

## 更新日志

### 版本 1.0.0

- 实现双模型搜索架构
- 支持候选人和职位双阶段查询
- 添加批量处理功能
- 提供搜索统计和监控

## 联系支持

如果在使用过程中遇到问题，请：

1. 查看错误日志
2. 检查配置是否正确
3. 参考本文档的故障排除部分
4. 联系技术支持团队
