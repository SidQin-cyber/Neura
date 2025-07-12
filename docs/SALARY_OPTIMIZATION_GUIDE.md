# 薪资匹配优化指南

## 概述

本指南介绍了Neura招聘平台的薪资匹配优化功能，包括智能薪资解析、数据验证和匹配度计算等核心功能。

## 核心功能

### 1. 智能薪资解析

#### 支持的格式
- **中文格式**: 30k, 3w, 30万, 3000, 30K, 3W
- **英文格式**: 30k, 30K, 30000, salary 30k
- **范围格式**: 25-35k, 2w-3w, 25000-35000
- **年薪月薪**: 年薪36万, 月薪30000

#### 智能转换规则
1. **单位转换**:
   - k/K/千 = 乘以1000
   - w/W/万 = 乘以10000
   - 无单位时根据数值大小智能判断

2. **年薪转换**:
   - 自动识别年薪关键词
   - 除以12转换为月薪
   - 统一以月薪存储

3. **范围处理**:
   - 单个数值: min和max设为相同值
   - 范围格式: 提取最小值和最大值
   - 缺失信息: 设为null

### 2. 数据验证与清洗

#### 验证规则
- **逻辑检查**: 确保最小值不大于最大值
- **异常值检测**: 检查过低(<1000)或过高(>1000000)的薪资
- **数据完整性**: 验证薪资数据的有效性

#### 自动修复
- **值交换**: 自动交换错误的最小值和最大值
- **异常值处理**: 标记并建议修复异常值
- **数据标准化**: 统一薪资格式和单位

### 3. 薪资匹配度计算

#### 匹配算法
```typescript
// 计算薪资匹配度 (0-1)
function calculateSalaryMatchScore(
  candidateRange: { min: number | null; max: number | null },
  jobRange: { min: number | null; max: number | null }
): number
```

#### 匹配等级
- **高度匹配** (≥0.8): 薪资范围重叠度很高
- **基本匹配** (0.6-0.8): 薪资范围有部分重叠
- **存在差距** (0.4-0.6): 薪资范围差距较大
- **差距较大** (<0.4): 薪资范围差距很大

### 4. 综合评分系统

#### 评分权重
- **语义相似度**: 70%
- **薪资匹配度**: 30%

#### 计算公式
```sql
combined_score = 0.7 * similarity + 0.3 * salary_match_score
```

## 使用方法

### 1. AI解析提示优化

在简历处理函数中，AI会使用增强的提示来解析薪资信息：

```typescript
// 处理各种薪资格式
"30k" → expected_salary_min: 30000, expected_salary_max: 30000
"25-35k" → expected_salary_min: 25000, expected_salary_max: 35000
"年薪36万" → expected_salary_min: 30000, expected_salary_max: 30000
```

### 2. 数据库函数调用

#### 增强搜索
```sql
-- 候选人搜索（包含薪资匹配度）
SELECT * FROM search_candidates_enhanced_rpc(
  query_embedding,
  salary_min := 25000,
  salary_max := 35000,
  include_salary_score := true
);

-- 职位搜索（包含薪资匹配度）
SELECT * FROM search_jobs_enhanced_rpc(
  query_embedding,
  salary_min_filter := 25000,
  salary_max_filter := 35000,
  include_salary_score := true
);
```

#### 数据验证
```sql
-- 运行薪资数据清洗
SELECT * FROM clean_salary_data();

-- 获取薪资统计
SELECT * FROM get_salary_statistics_rpc();

-- 获取薪资匹配建议
SELECT * FROM get_salary_recommendations_rpc(
  candidate_id_param := 'uuid',
  job_id_param := 'uuid'
);
```

### 3. 前端组件使用

#### 薪资验证面板
```typescript
import { SalaryValidationPanel } from '@/components/recruitment/salary-validation-panel'

// 使用组件
<SalaryValidationPanel className="w-full" />
```

#### 薪资解析工具
```typescript
import { parseSalaryText, formatSalaryRange } from '@/lib/utils/salary-parser'

// 解析薪资文本
const result = parseSalaryText('期望薪资25-35k')
console.log(result.ranges) // [{ min: 25000, max: 35000, ... }]

// 格式化显示
const formatted = formatSalaryRange(result.ranges[0])
console.log(formatted) // "25k-35k"
```

## 最佳实践

### 1. 数据输入建议
- 鼓励使用标准格式（如25k-35k）
- 明确区分年薪和月薪
- 避免过于模糊的描述

### 2. 定期维护
- 定期运行数据验证功能
- 清理异常薪资数据
- 更新薪资统计信息

### 3. 匹配策略
- 使用综合评分进行排序
- 考虑薪资匹配度和语义相似度
- 允许一定的薪资差异容忍度

## 技术架构

### 1. 工具层
- `lib/utils/salary-parser.ts`: 薪资解析工具
- 正则表达式匹配各种格式
- 智能单位转换和范围处理

### 2. 数据库层
- `database/enhanced_salary_functions.sql`: 增强的SQL函数
- 薪资匹配度计算
- 数据清洗和验证

### 3. 业务层
- `supabase/functions/process-resume-dual/index.ts`: 简历处理
- 增强的AI解析提示
- 双模型embedding生成

### 4. 界面层
- `components/recruitment/salary-validation-panel.tsx`: 验证面板
- 实时解析测试
- 数据统计和分析

## 性能优化

### 1. 数据库优化
- 使用索引加速薪资范围查询
- 缓存常用的薪资统计信息
- 批量处理数据清洗任务

### 2. 前端优化
- 防抖输入处理
- 分页加载大量数据
- 缓存解析结果

### 3. API优化
- 异步处理简历解析
- 并行生成双模型embedding
- 错误处理和重试机制

## 故障排查

### 1. 解析失败
- 检查输入格式是否支持
- 验证正则表达式匹配
- 查看AI解析日志

### 2. 匹配度异常
- 验证薪资数据完整性
- 检查计算公式和权重
- 确认数据库函数正确性

### 3. 性能问题
- 分析查询执行计划
- 检查索引使用情况
- 监控系统资源使用

## 未来改进

### 1. 机器学习增强
- 训练专门的薪资识别模型
- 基于历史数据优化匹配算法
- 自适应权重调整

### 2. 多币种支持
- 支持USD、EUR等其他货币
- 自动汇率转换
- 地区薪资标准化

### 3. 行业细分
- 不同行业的薪资标准
- 职位级别对应的薪资范围
- 地域薪资差异分析

## 总结

薪资匹配优化功能通过智能解析、数据验证和匹配度计算，大大提高了招聘系统的薪资匹配准确性。通过持续的数据清洗和算法优化，可以确保系统始终提供高质量的匹配结果。 