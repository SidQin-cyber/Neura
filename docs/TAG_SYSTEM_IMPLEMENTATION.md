# #标签系统实现文档

## 概述

实现了基于 `#标签` 的智能查询解析系统，用户可以直观地看到和编辑解析出的关键词，同时保持极简的界面设计。

## 核心特性

### 1. 智能标签生成
用户点击 "Neura Spark" 后，系统会：
- 解析原始输入为结构化数据
- 自动生成 `#标签` 附加到输入框末尾
- 原始输入 + 解析出的关键词标签

### 2. 可视化标签显示
- `#标签` 在输入框中显示为蓝色背景，易于识别
- 通过叠加层技术实现，不影响原始输入功能
- 保持完整的复制、粘贴、光标定位功能

### 3. 用户可编辑
- 用户可以直接删除不需要的 `#标签`
- 可以手动添加新的 `#标签`
- 实时反映在最终搜索参数中

## 技术实现

### 标签生成逻辑
```javascript
// 解析成功后构建标签
const tags = []

// 角色标签
if (result.data.role?.length > 0) {
  tags.push(...result.data.role.map(r => `#${r}`))
}

// 必备技能标签
if (result.data.skills_must?.length > 0) {
  tags.push(...result.data.skills_must.map(s => `#${s}`))
}

// 高置信度相关技能标签 (confidence >= 4)
if (result.data.skills_related?.length > 0) {
  const highConfidenceSkills = result.data.skills_related
    .filter(item => item.confidence >= 4)
    .map(item => `#${item.skill}`)
  tags.push(...highConfidenceSkills)
}

// 最终文本 = 原始输入 + 标签
const taggedText = originalText + ' ' + tags.join(' ')
```

### 标签解析逻辑
```javascript
// 搜索时从输入中提取标签
const words = userQuery.split(/\s+/)
const tags = words.filter(w => w.startsWith('#')).map(w => w.slice(1))
const queryWithoutTags = words.filter(w => !w.startsWith('#')).join(' ')

// 智能分类
tags.forEach(tag => {
  if (tag.includes('年')) {
    extractedData.experience = tag.replace(/年.*/, '')
  }
  else if (tag.includes('k')) {
    extractedData.salary = tag.replace('k+', '').replace('k', '')
  }
  else if (cities.includes(tag)) {
    extractedData.locations.push(tag)
  }
  else if (tag.includes('工程师') || tag.includes('开发')) {
    extractedData.roles.push(tag)
  }
  else {
    extractedData.skills.push(tag)
  }
})
```

### 视觉实现
```jsx
{/* 透明的实际输入框 */}
<Textarea
  style={{
    color: 'transparent',
    caretColor: 'black'
  }}
  // ... 其他属性
/>

{/* 叠加的彩色文本层 */}
<div className="absolute top-0 left-0 pointer-events-none">
  {input.split(/(\s+)/).map((part, index) => (
    <span key={index}>
      {part.startsWith('#') ? (
        <span className="text-blue-600 bg-blue-50 px-1 rounded">
          {part}
        </span>
      ) : (
        <span className="text-gray-900">{part}</span>
      )}
    </span>
  ))}
</div>
```

## 用户体验流程

### 解析流程
1. 用户输入自然语言查询：`"3年 node.js 全栈 深圳"`
2. 点击 "Neura Spark" 按钮
3. 系统智能解析并生成标签
4. 输入框显示：`"3年 node.js 全栈 深圳 #全栈开发工程师 #Node.js #JavaScript #深圳 #3年经验"`
5. `#标签` 以蓝色背景显示，易于识别

### 编辑流程
1. 用户可以删除不需要的标签（如删除 `#JavaScript`）
2. 可以手动添加新标签（如添加 `#React`）
3. 修改会实时反映在搜索参数中

### 搜索流程
1. 用户确认标签后提交搜索
2. 系统分离原始查询和标签
3. 构建精确的搜索过滤器
4. 执行语义搜索 + 精确过滤

## 标签分类规则

| 类型 | 识别规则 | 示例 |
|------|----------|------|
| 经验 | 包含"年" | `#3年经验` → experience: "3" |
| 薪资 | 包含"k" | `#25k+` → salary: "25" |
| 地点 | 常见城市列表 | `#北京` → location: ["北京"] |
| 角色 | 包含职位关键词 | `#前端工程师` → roles: ["前端工程师"] |
| 技能 | 其他所有标签 | `#React` → skills: ["React"] |

## 搜索参数构建

### Embedding 文本
```javascript
const embeddingTerms = [
  queryWithoutTags,           // "3年 node.js 全栈 深圳"
  ...extractedData.roles,     // ["全栈开发工程师"]
  ...extractedData.skills,    // ["Node.js", "JavaScript"]
  ...extractedData.locations  // ["深圳"]
].filter(Boolean)

enhancedQuery = embeddingTerms.join(' ')
// "3年 node.js 全栈 深圳 全栈开发工程师 Node.js JavaScript 深圳"
```

### 过滤器参数
```javascript
searchFilters = {
  location: extractedData.locations,    // ["深圳"]
  experience: extractedData.experience, // "3"
  salary: extractedData.salary,        // ""
  skills: extractedData.skills,        // ["Node.js", "JavaScript"]
  education: []
}
```

## 优势总结

1. **可见性**: 用户可以直观看到系统解析出的关键词
2. **可控性**: 用户可以删除、修改、添加标签
3. **简洁性**: 不增加额外的UI组件，保持界面简洁
4. **一致性**: 标签直接体现在搜索参数中，避免数据不同步
5. **灵活性**: 支持手动调整和自动补全的完美结合

## 测试验证

测试案例：
```
输入: "3年 node.js 全栈 深圳"
解析后: "3年 node.js 全栈 深圳 #全栈开发工程师 #Node.js #JavaScript #数据库 #深圳 #3年经验"

提取结果:
- 原始查询: "3年 node.js 全栈 深圳"
- 角色: ["全栈开发工程师"]  
- 技能: ["Node.js", "JavaScript", "数据库"]
- 地点: ["深圳"]
- 经验: "3"
```

系统能够准确识别和分类各种标签，为后续搜索提供精确的参数。 