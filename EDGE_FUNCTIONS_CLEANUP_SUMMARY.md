# Edge Functions 清理总结

## 🧹 已清理的组件

### 删除的 Edge Functions
- `supabase/functions/process-resume/` - 单模型简历处理（已废弃）
- `supabase/functions/process-resume-dual/` - 双模型简历处理（已废弃）
- `supabase/functions/get-dual-embedding/` - 双模型 embedding 生成（已废弃）
- `supabase/functions/get-embedding/` - 单模型 embedding 生成（已废弃）

### 删除的前端组件
- `lib/tools/dual-search.ts` - 双搜索工具（未使用）
- `components/dual-search-panel.tsx` - 双搜索面板（未使用）

### 删除的文档
- `docs/DUAL_SEARCH_GUIDE.md` - 双搜索指南（已过时）

## ✅ 当前架构

### 保留的 Edge Functions
- `supabase/functions/copilot-qna/` - AI 助手问答功能
- `supabase/functions/_shared/` - 共享模块

### 统一的 Embedding 处理
- `lib/embedding/openai-embedding.ts` - 统一使用 `text-embedding-3-large` (1536维)
- 人选储存：`POST /api/upload/candidates` → `generateEmbedding()`
- 职位储存：`POST /api/upload/jobs` → `generateEmbedding()`
- 人选搜索：`POST /api/search` (mode=candidates) → `generateEmbedding()`
- 职位搜索：`POST /api/search` (mode=jobs) → `generateEmbedding()`

## 📊 清理效果

### 简化架构
- 移除了 4 个未使用的 Edge Functions
- 删除了 2 个未使用的前端组件
- 清理了相关文档引用

### 统一模型
- 全链路使用 `text-embedding-3-large` (1536维)
- 消除了小模型/大模型混用的复杂性
- 保持了现有业务功能不变

### 维护便利性
- 减少了代码维护负担
- 简化了部署流程
- 清除了干扰性代码

## 🚀 业务影响

✅ **无影响** - 所有清理都是针对未使用的代码  
✅ **性能保持** - 搜索功能继续正常工作  
✅ **功能完整** - 人选和职位的储存、搜索功能完全保留

---

*清理完成时间：{{ current_date }}* 