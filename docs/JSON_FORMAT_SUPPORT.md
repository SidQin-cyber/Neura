# JSON格式支持说明

## 概述

Neura 平台的上传功能现在支持两种JSON格式：
- **单个对象格式** - 上传单个候选人或职位
- **数组格式** - 批量上传多个候选人或职位

## 支持的格式

### 1. 单个对象格式

适用于上传单个候选人或职位的情况。

**候选人示例：**
```json
{
  "candidate_id": "C20250712001",
  "name": "Liu Xiaoming",
  "title": "高级后端工程师",
  "location": "Shanghai",
  "current_company": "Tencent",
  "years_of_experience": 8,
  "skills": ["Golang", "Microservices", "Kubernetes"],
  "email": "liu.xiaoming@example.com",
  "phone": "13800138000"
}
```

**职位示例：**
```json
{
  "job_id": "J20250712001",
  "title": "高级后端工程师",
  "company": "字节跳动",
  "location": "北京",
  "employment_type": "full_time",
  "salary_min": 35000,
  "salary_max": 55000,
  "skills_required": ["Java", "Go", "Microservices"],
  "experience_required": 5
}
```

### 2. 数组格式

适用于批量上传多个候选人或职位的情况。

**候选人示例：**
```json
[
  {
    "name": "张三",
    "title": "高级前端工程师",
    "location": "北京",
    "skills": ["React", "TypeScript", "Vue.js"],
    "email": "zhangsan@example.com"
  },
  {
    "name": "李四",
    "title": "资深后端工程师",
    "location": "上海",
    "skills": ["Java", "Spring Boot", "MySQL"],
    "email": "lisi@example.com"
  }
]
```

**职位示例：**
```json
[
  {
    "title": "高级前端开发工程师",
    "company": "腾讯科技",
    "location": "深圳",
    "employment_type": "full_time",
    "skills_required": ["React", "Vue", "TypeScript"]
  },
  {
    "title": "资深后端工程师",
    "company": "阿里巴巴",
    "location": "杭州",
    "employment_type": "full_time",
    "skills_required": ["Java", "Spring", "MySQL"]
  }
]
```

## 自动转换机制

系统会自动处理不同的输入格式：

1. **单个对象** → 自动转换为包含一个元素的数组
2. **数组** → 直接使用
3. **无效JSON** → 返回详细的错误信息

## 必要字段

### 候选人数据
- `name` (必需) - 候选人姓名
- `title` (必需) - 职位标题

### 职位数据
- `title` (必需) - 职位标题
- `company` (必需) - 公司名称

## 示例文件

系统提供了完整的示例文件：

- **单个对象格式**：
  - `/examples/single-candidate-example.json`
  - `/examples/single-job-example.json`

- **数组格式**：
  - `/examples/candidates-example.json`
  - `/examples/jobs-example.json`

## 使用方法

1. **在上传界面**：
   - 选择"上传人选JSON"或"上传职位JSON"
   - 拖拽文件或直接粘贴JSON内容
   - 点击"单个对象示例"或"数组格式示例"查看格式

2. **通过API**：
   ```javascript
   // 单个对象会自动转换为数组
   const response = await fetch('/api/upload/candidates', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
       data: { name: "张三", title: "工程师" } // 单个对象
     })
   })
   ```

## 错误处理

常见错误及解决方案：

1. **"JSON格式无效：语法错误"** - 检查JSON语法
2. **"缺少必要字段"** - 确保包含必要字段
3. **"用户未登录"** - 先登录再上传

## 性能说明

- 单个对象上传：适合实时添加
- 数组批量上传：适合初始化或大量数据导入
- 推荐单次上传不超过100条记录以获得最佳性能

## 兼容性

此更新完全向后兼容，现有的数组格式继续正常工作。 