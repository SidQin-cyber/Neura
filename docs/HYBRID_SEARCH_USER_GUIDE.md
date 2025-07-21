# 🔍 混合搜索功能使用指南

## 📖 概述

混合搜索功能将**向量搜索（语义理解）**与**FTS全文搜索（关键词匹配）**相结合，通过智能分数归一化和加权组合，显著提升搜索准确性和用户体验。

## 🎯 核心特性

### 1. 双信号搜索
- **向量信号**: 基于语义相似度，理解查询意图
- **FTS信号**: 基于关键词精确匹配，提供准确性保障

### 2. Min-Max分数归一化
- 自动将不同量纲的分数统一到[0,1]区间
- 确保向量分数和FTS分数在同一起跑线上

### 3. 灵活权重配置
- α参数控制向量/FTS权重比例
- 支持不同查询场景的动态优化

## 🚀 API 使用方法

### 基本请求格式

```javascript
POST /api/search
Content-Type: application/json

{
  "query": "小米通讯技术有限公司机器人事业部",
  "mode": "candidates",  // 或 "jobs"
  "alpha": 0.7,          // 可选：向量权重 (0-1)
  "filters": {           // 可选：筛选条件
    "location": ["北京"],
    "experience_min": 3,
    "experience_max": 10,
    "salary_min": 20000,
    "salary_max": 50000,
    "skills": ["Python", "机器学习"]
  }
}
```

### 响应格式

```javascript
// 流式响应，每行一个JSON对象
{
  "type": "results",
  "data": [
    {
      "id": "uuid",
      "name": "候选人姓名",
      "current_company": "公司名称",
      "current_title": "职位名称",
      "location": "城市",
      
      // 分数详情
      "similarity": 0.8234,              // 原始向量相似度
      "fts_rank": 0.5678,               // 原始FTS分数
      "normalized_vector_score": 0.9123, // 归一化向量分数
      "normalized_fts_score": 0.7456,   // 归一化FTS分数
      "final_score": 0.8567,            // 最终混合分数
      "match_score": 86,                // 百分比形式(0-100)
      
      // 其他字段...
    }
  ],
  "count": 25,
  "search_config": {
    "mode": "hybrid",
    "vector_weight": 0.7,
    "fts_weight": 0.3,
    "normalization": "min-max"
  }
}

{
  "type": "complete",
  "message": "混合搜索完成"
}
```

## ⚖️ 权重配置策略

### α参数选择指南

| α值 | 权重分配 | 适用场景 | 示例查询 |
|-----|---------|----------|----------|
| **0.7** | 70%向量 + 30%FTS | **默认推荐** | "深圳全栈工程师" |
| **0.8-0.9** | 语义优先 | 模糊、口语化查询 | "感觉很有经验的产品大神" |
| **0.3-0.5** | 关键词优先 | 精确专有名词 | "BERT-large-uncased" |
| **0.5** | 平衡模式 | 技能组合查询 | "React + TypeScript + Node.js" |

### 动态权重调整

```javascript
// 示例：根据查询类型动态调整权重
function calculateOptimalAlpha(query) {
  // 如果查询包含引号，提高关键词权重
  if (query.includes('"') || query.includes("'")) {
    return 0.3  // 30%向量，70%FTS
  }
  
  // 如果查询很长且描述性强，提高语义权重
  if (query.length > 50 && /具备|擅长|经验|能力/.test(query)) {
    return 0.9  // 90%向量，10%FTS
  }
  
  // 默认平衡权重
  return 0.7
}
```

## 📊 分数解读

### 分数字段说明

1. **similarity**: 原始向量相似度 [0,1]
   - 衡量语义相似程度
   - 值越高表示语义匹配越好

2. **fts_rank**: 原始FTS分数 [0,+∞]
   - 关键词匹配相关性
   - 基于词频、位置等因素

3. **normalized_vector_score**: 归一化向量分数 [0,1]
   - Min-Max归一化后的向量分数
   - 消除了向量分数的量纲问题

4. **normalized_fts_score**: 归一化FTS分数 [0,1]
   - Min-Max归一化后的FTS分数
   - 与向量分数在同一标准下

5. **final_score**: 最终混合分数 [0,1]
   - 公式：α × normalized_vector_score + (1-α) × normalized_fts_score
   - 用于最终排序的权威分数

6. **match_score**: 百分比分数 [0,100]
   - final_score × 100
   - 前端展示用的友好格式

### 质量评估指标

```javascript
// 搜索质量分析示例
function analyzeSearchQuality(results) {
  const finalScores = results.map(r => r.final_score)
  
  return {
    topScore: Math.max(...finalScores),           // 最高分
    avgScore: finalScores.reduce((a,b) => a+b) / finalScores.length, // 平均分
    scoreRange: Math.max(...finalScores) - Math.min(...finalScores), // 分数范围
    diversity: calculateVariance(finalScores)     // 分数多样性
  }
}
```

## 🔧 前端集成示例

### React Hook 示例

```javascript
import { useState, useCallback } from 'react'

export function useHybridSearch() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchConfig, setSearchConfig] = useState(null)

  const search = useCallback(async (query, options = {}) => {
    setLoading(true)
    setResults([])

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          mode: options.mode || 'candidates',
          alpha: options.alpha || 0.7,  // 默认70%向量权重
          filters: options.filters || {}
        })
      })

      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            
            if (data.type === 'results') {
              setResults(data.data || [])
              setSearchConfig(data.search_config)
            } else if (data.type === 'error') {
              throw new Error(data.error)
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      }
    } catch (error) {
      console.error('搜索失败:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return { search, results, loading, searchConfig }
}
```

### 使用示例

```javascript
function SearchComponent() {
  const { search, results, loading, searchConfig } = useHybridSearch()
  const [alpha, setAlpha] = useState(0.7)

  const handleSearch = async (query) => {
    await search(query, {
      mode: 'candidates',
      alpha: alpha,
      filters: {
        location: ['北京', '上海'],
        experience_min: 3,
        skills: ['React', 'Node.js']
      }
    })
  }

  return (
    <div>
      {/* 权重控制器 */}
      <div>
        <label>向量权重: {Math.round(alpha * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={alpha}
          onChange={(e) => setAlpha(parseFloat(e.target.value))}
        />
        <span>FTS权重: {Math.round((1-alpha) * 100)}%</span>
      </div>

      {/* 搜索结果展示 */}
      {searchConfig && (
        <div className="search-info">
          搜索模式: {searchConfig.mode} | 
          权重配置: {Math.round(searchConfig.vector_weight*100)}%向量 + 
          {Math.round(searchConfig.fts_weight*100)}%FTS
        </div>
      )}

      {results.map(result => (
        <div key={result.id} className="result-card">
          <h3>{result.name}</h3>
          <p>{result.current_company} - {result.current_title}</p>
          
          {/* 分数详情 */}
          <div className="score-details">
            <div>匹配度: {result.match_score}%</div>
            <div>
              向量: {(result.normalized_vector_score * 100).toFixed(1)}% |
              FTS: {(result.normalized_fts_score * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

## 🧪 测试和调试

### 测试脚本使用

```bash
# 运行混合搜索测试
node test-hybrid-search.js

# 测试特定α值
TEST_ALPHA=0.8 node test-hybrid-search.js
```

### 调试技巧

1. **观察控制台日志**
   - 搜索API会输出详细的分数归一化过程
   - 包含原始分数范围、归一化结果、最终排序

2. **分析分数分布**
   - 检查向量分数和FTS分数的方差
   - 识别主导因子（向量 vs FTS）

3. **权重实验**
   - 对同一查询测试不同α值
   - 观察排序变化和分数差异

## 📈 性能优化建议

### 1. 缓存策略
```javascript
// 缓存归一化结果，避免重复计算
const normalizationCache = new Map()

function getCachedNormalization(key, computeFn) {
  if (!normalizationCache.has(key)) {
    normalizationCache.set(key, computeFn())
  }
  return normalizationCache.get(key)
}
```

### 2. 批量处理
- 一次召回更多候选人进行归一化
- 避免小批量归一化导致的精度损失

### 3. 动态阈值
```javascript
// 根据结果质量动态调整相似度阈值
function getAdaptiveThreshold(previousResults) {
  if (previousResults.length < 5) {
    return 0.001  // 降低阈值，增加召回
  }
  const avgScore = previousResults.reduce((sum, r) => sum + r.final_score, 0) / previousResults.length
  return Math.max(0.01, avgScore * 0.5)  // 动态调整
}
```

## ❓ 常见问题

### Q: 为什么要在后端做归一化而不是数据库？
A: 后端归一化更灵活，便于调试和A/B测试，同时支持动态权重调整。

### Q: 如何选择最佳的α值？
A: 建议从0.7开始，根据查询类型和用户反馈进行调整。可以实现A/B测试来找到最优权重。

### Q: Min-Max归一化会导致信息丢失吗？
A: 不会。归一化只是尺度变换，保持了原始分数的相对关系。

### Q: 如何处理全部分数相同的情况？
A: 系统会自动将所有分数归一化为1.0，保持公平性。

### Q: 能否支持更多的搜索信号？
A: 可以。架构支持扩展，未来可以加入位置信号、时间信号等。

## 🔮 未来规划

1. **智能权重学习**: 基于用户点击行为自动调整α值
2. **多模态搜索**: 支持图片、文档等多种输入类型
3. **个性化排序**: 基于用户历史偏好优化权重
4. **实时重排**: 集成二阶段rerank模型进一步优化

---

🎉 **恭喜！你现在已经掌握了混合搜索的核心功能。开始体验语义+关键词的双重搜索魅力吧！** 