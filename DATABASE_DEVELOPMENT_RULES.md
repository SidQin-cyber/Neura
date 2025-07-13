# 数据库开发规则 - Neura 项目

## 🎯 核心原则

**所有数据库修改必须遵循以下流程：**
```
本地修改 → 生成迁移 → 测试 → 提交 → 部署到线上
```

## 📋 强制性规则

### 1. 迁移文件规则
- ✅ **必须使用 Supabase CLI 生成迁移文件**
- ✅ **所有 SQL 修改必须输出为 migration 文件格式**
- ✅ **迁移文件名必须具有描述性**
- ❌ **禁止直接在线上执行 SQL 命令**

### 2. 回滚策略规则
- ✅ **每个迁移都必须提供 rollback 方案**
- ✅ **必须测试 rollback 的可行性**
- ✅ **复杂变更必须分步进行，确保可回滚**

### 3. 测试规则
- ✅ **在本地环境充分测试**
- ✅ **使用 `supabase db reset` 验证迁移**
- ✅ **测试数据完整性和功能正确性**

## 🔧 标准操作模板

### 创建新迁移的标准流程

```bash
# 1. 在本地 Supabase Studio 或 SQL 中进行修改
# 访问: http://127.0.0.1:54323

# 2. 生成迁移文件
supabase db diff -f descriptive_migration_name

# 3. 验证迁移文件
cat supabase/migrations/[timestamp]_descriptive_migration_name.sql

# 4. 测试迁移
supabase db reset

# 5. 提交到版本控制
git add supabase/migrations/
git commit -m "feat: 描述性的提交信息"

# 6. 部署到线上
supabase db push
```

### 迁移文件模板

```sql
-- 迁移文件模板
-- 文件名: [timestamp]_descriptive_name.sql
-- 描述: 简要说明这个迁移的目的

-- ===========================================
-- 正向迁移 (Forward Migration)
-- ===========================================

-- 在这里添加您的 SQL 变更
-- 例如：
-- CREATE TABLE new_table (...);
-- ALTER TABLE existing_table ADD COLUMN new_column TEXT;
-- CREATE OR REPLACE FUNCTION new_function() ...;

-- ===========================================
-- 回滚说明 (Rollback Instructions)
-- ===========================================

-- 要回滚此迁移，请创建新的迁移文件包含以下内容：
-- DROP TABLE IF EXISTS new_table;
-- ALTER TABLE existing_table DROP COLUMN IF EXISTS new_column;
-- DROP FUNCTION IF EXISTS new_function();

-- 或者使用 Supabase CLI:
-- supabase db reset --to [previous_migration_timestamp]
```

## 🚨 禁止的操作

### ❌ 绝对不允许

1. **直接在线上数据库执行 SQL**
2. **跳过迁移文件直接修改**
3. **没有回滚方案的破坏性变更**
4. **未经测试的迁移部署**

### ⚠️ 高风险操作（需要特别小心）

1. **DROP TABLE/COLUMN 操作**
2. **数据类型变更**
3. **索引重建**
4. **大批量数据迁移**

## 📝 常见场景的处理方式

### 场景1: 修改搜索函数

```bash
# 1. 在本地修改函数
# 2. 生成迁移
supabase db diff -f update_search_function_v2

# 3. 迁移文件内容示例:
```

```sql
-- 更新搜索函数
DROP FUNCTION IF EXISTS search_candidates_rpc(TEXT, TEXT, FLOAT, INT, TEXT, INT, INT, INT, INT, TEXT[], TEXT, UUID, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION search_candidates_rpc(
  -- 新的函数定义
) RETURNS TABLE (...) AS $$
-- 函数体
$$ LANGUAGE plpgsql;

-- 回滚方案: 恢复到之前的函数版本
-- 保存在 rollback_search_function_v2.sql 中
```

### 场景2: 添加新表

```bash
supabase db diff -f add_user_preferences_table
```

```sql
-- 添加用户偏好表
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 回滚方案:
-- DROP TABLE IF EXISTS user_preferences;
```

### 场景3: 修改现有表结构

```bash
supabase db diff -f add_resume_tags_column
```

```sql
-- 为简历表添加标签列
ALTER TABLE resumes ADD COLUMN tags TEXT[];
CREATE INDEX IF NOT EXISTS idx_resumes_tags ON resumes USING GIN(tags);

-- 回滚方案:
-- DROP INDEX IF EXISTS idx_resumes_tags;
-- ALTER TABLE resumes DROP COLUMN IF EXISTS tags;
```

## 🔄 回滚策略

### 自动回滚（推荐）

```bash
# 回滚到特定迁移
supabase db reset --to 20240101000000

# 回滚到上一个迁移
supabase db reset --to $(supabase migration list | tail -2 | head -1 | cut -d' ' -f1)
```

### 手动回滚

```bash
# 创建回滚迁移
supabase db diff -f rollback_previous_changes

# 在迁移文件中添加回滚 SQL
```

## 📊 部署检查清单

在执行 `supabase db push` 之前，确保：

- [ ] 迁移文件已生成并审查
- [ ] 本地测试通过 (`supabase db reset`)
- [ ] 回滚方案已准备
- [ ] 变更已提交到 Git
- [ ] 团队成员已知悉（如适用）

## 🛠️ 工具和命令

### 常用 Supabase CLI 命令

```bash
# 查看状态
supabase status

# 生成迁移
supabase db diff -f migration_name

# 查看迁移历史
supabase migration list

# 重置到特定迁移
supabase db reset --to [timestamp]

# 部署到线上
supabase db push

# 查看远程状态
supabase projects list
```

### 调试命令

```bash
# 详细日志
supabase db reset --debug

# 查看容器状态
docker ps

# 连接到本地数据库
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## 📋 应急处理

### 如果线上部署出现问题

1. **立即停止**：不要继续推送
2. **评估影响**：检查受影响的功能
3. **快速回滚**：
   ```bash
   # 创建回滚迁移
   supabase db diff -f emergency_rollback_[issue_description]
   # 添加回滚 SQL
   # 推送回滚
   supabase db push
   ```
4. **事后分析**：分析问题原因，改进流程

---

## 🎯 总结

**记住这个流程：**
```
本地修改 → 生成迁移 → 测试 → 提交 → 部署到线上
```

**每次数据库变更都必须：**
1. 使用迁移文件
2. 提供回滚方案
3. 充分测试
4. 版本控制

这个流程确保了数据库变更的安全性、可追踪性和可回滚性。 