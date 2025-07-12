# Edge Functions 故障排除指南

## 解决VSCode中的TypeScript报错

### 问题描述
在VSCode中打开Supabase Edge Functions时，可能会看到以下错误：
- 找不到模块"https://deno.land/std@0.168.0/http/server.ts"
- 找不到名称"Deno"
- 导入路径扩展名问题

### 解决方案

#### 1. 安装Deno扩展
1. 打开VSCode
2. 前往Extensions (Ctrl+Shift+X)
3. 搜索"Deno"
4. 安装"Deno for VSCode"扩展

#### 2. 配置VSCode设置
我们已经创建了`.vscode/settings.json`文件来配置Deno支持：

```json
{
  "deno.enable": true,
  "deno.enablePaths": [
    "./supabase/functions"
  ],
  "deno.lint": false,
  "deno.unstable": true,
  "deno.config": "./supabase/functions/deno.json",
  "deno.importMap": "./supabase/functions/import_map.json"
}
```

#### 3. 重新加载VSCode
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入"Developer: Reload Window"
3. 选择并执行重新加载

#### 4. 验证配置
- 打开任何Edge Function文件
- 右下角应该显示"Deno"而不是"TypeScript"
- 错误应该消失

## 文件结构说明

### 配置文件
- `supabase/functions/deno.json` - Deno配置
- `supabase/functions/import_map.json` - 导入映射
- `supabase/functions/types.d.ts` - 类型定义
- `.vscode/settings.json` - VSCode配置

### Edge Functions
- `get-embedding/` - 单模型embedding生成
- `get-dual-embedding/` - 双模型embedding生成
- `process-resume/` - 简历处理
- `process-resume-dual/` - 双模型简历处理
- `copilot-qna/` - AI助手问答
- `_shared/` - 共享模块

## 常见问题

### Q: 为什么需要Deno而不是Node.js？
A: Supabase Edge Functions基于Deno运行时，它提供了更好的安全性和现代化的JavaScript/TypeScript支持。

### Q: 如何在本地测试Edge Functions？
A: 使用Supabase CLI：
```bash
supabase functions serve
```

### Q: 如何部署Edge Functions？
A: 使用Supabase CLI：
```bash
supabase functions deploy function-name
```

### Q: 如何查看Edge Functions日志？
A: 使用Supabase CLI：
```bash
supabase functions logs function-name
```

## 类型检查

### 禁用特定文件的类型检查
如果某个文件仍然有类型错误，可以在文件顶部添加：
```typescript
// @ts-nocheck
```

### 忽略特定行的类型错误
```typescript
// @ts-ignore
const result = someFunction()
```

## 开发建议

1. **始终使用Deno风格的导入**
   ```typescript
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
   ```

2. **使用类型定义**
   ```typescript
   interface RequestData {
     text: string
     options?: any
   }
   ```

3. **错误处理**
   ```typescript
   try {
     // 代码
   } catch (error) {
     console.error('Error:', error)
     return new Response(JSON.stringify({ error: 'Internal server error' }), {
       status: 500,
       headers: { 'Content-Type': 'application/json' }
     })
   }
   ```

4. **环境变量访问**
   ```typescript
   const apiKey = Deno.env.get('OPENAI_API_KEY')!
   ```

## 部署检查清单

- [ ] 所有必需的环境变量已设置
- [ ] 函数代码没有语法错误
- [ ] 导入路径正确
- [ ] 错误处理完善
- [ ] 日志记录适当
- [ ] 类型定义正确

## 联系支持

如果仍然遇到问题：
1. 检查Supabase文档
2. 查看Edge Functions日志
3. 确认Deno扩展正确安装
4. 重新加载VSCode窗口 