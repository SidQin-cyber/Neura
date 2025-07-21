# 混合搜索α权重优化

## 📋 **变更概述**

**目标**: 降低用户学习成本，提供开箱即用的最佳搜索体验  
**方案**: 使用固定的最优α权重值，无需用户配置

## ⚙️ **技术实现**

### 固定权重配置
```
α = 0.65 (固定值)
• 65% 向量权重 (语义搜索)
• 35% FTS权重 (关键词搜索)
```

### 混合搜索公式
```
final_score = 0.65 × normalized_vector_score + 0.35 × normalized_fts_score
```

## 🎯 **为什么选择 α=0.65？**

1. **平衡性最佳**: 既能捕获语义相似性，又不忽略精确关键词匹配
2. **实测效果良好**: 在招聘场景下表现优异
3. **通用性强**: 适合大多数搜索查询类型

## 📊 **权重分析**

| 查询类型 | 示例 | 65%向量 + 35%FTS 效果 |
|---------|------|---------------------|
| 公司名匹配 | "小米" | ✅ FTS精确匹配小米员工 |
| 职位搜索 | "前端工程师" | ✅ 语义+关键词双重匹配 |
| 技能搜索 | "机器人开发" | ✅ 语义理解相关技能 |
| 复合查询 | "5年Java经验" | ✅ 平衡处理年限+技术栈 |

## 🚀 **用户体验提升**

### 修改前
- 用户需要理解α权重概念
- 需要手动调整向量/FTS权重
- 增加UI复杂度和学习成本

### 修改后  
- ✅ **零配置**: 用户无需了解技术细节
- ✅ **开箱即用**: 直接享受最佳搜索效果
- ✅ **简化API**: 前端无需传递alpha参数

## 🔧 **代码变更**

### API请求简化
```javascript
// 修改前
fetch('/api/search', {
  body: JSON.stringify({
    query: '小米',
    mode: 'candidates', 
    alpha: 0.65,  // ← 需要前端指定
    filters: {}
  })
})

// 修改后
fetch('/api/search', {
  body: JSON.stringify({
    query: '小米',
    mode: 'candidates',
    filters: {}
    // alpha参数已移除，系统自动使用0.65
  })
})
```

### 搜索API核心变更
```typescript
// 修改前：支持动态alpha
const { query, mode, filters, alpha } = await request.json()
const vectorWeight = alpha !== undefined ? Number(alpha) : 0.7

// 修改后：固定最优alpha
const { query, mode, filters } = await request.json()
const vectorWeight = 0.65 // 固定最优值
```

## 📈 **预期收益**

1. **降低开发成本**: 前端无需实现权重选择UI
2. **减少用户困惑**: 无需解释技术参数含义
3. **提升搜索质量**: 基于实测的最优权重配置
4. **简化维护**: 减少可变参数，降低Bug风险

## 🧪 **测试方式**

在浏览器控制台运行：
```javascript
// 测试固定α值效果
async function testSearch() {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '小米',
      mode: 'candidates',
      filters: {}
    })
  })
  // 处理响应...
}
testSearch()
```

## 🔮 **未来扩展**

如需更精细的权重控制，可考虑：
1. **启发式算法**: 基于查询长度/类型自动推断α
2. **机器学习**: 基于用户行为数据优化权重
3. **A/B测试**: 线上实验不同α值的效果

---

**变更日期**: 2024-01-XX  
**影响范围**: 搜索API, 前端调用代码  
**兼容性**: 向后兼容，移除了前端alpha参数传递 