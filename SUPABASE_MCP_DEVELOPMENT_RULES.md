# Supabase MCP 自动调用开发规则

## 🎯 规则目标
在开发过程中，当涉及到 Supabase 相关的设定更改、数据库操作、调试问题时，**优先并自动调用 Supabase MCP 功能**，确保操作的准确性和实时性。

## 📋 自动触发 MCP 的场景

### 1. 🗄️ **数据库结构相关**
**触发条件**：
- 查询表结构、字段信息
- 检查表关系和约束
- 验证数据库 schema 完整性
- 分析表大小和性能

**使用的 MCP 工具**：
```bash
mcp_supabase_list_tables        # 列出所有表
mcp_supabase_execute_sql        # 执行结构查询
mcp_supabase_generate_typescript_types  # 生成类型定义
```

### 2. 🔧 **迁移和 Schema 变更**
**触发条件**：
- 创建新的数据库迁移
- 修改表结构
- 添加索引或约束
- 更新数据库函数

**使用的 MCP 工具**：
```bash
mcp_supabase_list_migrations    # 查看迁移历史
mcp_supabase_apply_migration    # 应用迁移
mcp_supabase_execute_sql        # 执行 DDL 操作
```

### 3. 🔍 **数据查询和验证**
**触发条件**：
- 查询业务数据
- 验证数据完整性
- 统计数据量
- 检查数据格式

**使用的 MCP 工具**：
```bash
mcp_supabase_execute_sql        # 执行查询
```

### 4. 🔐 **安全和权限管理**
**触发条件**：
- 检查 RLS 策略
- 验证用户权限
- 安全审计
- 性能问题诊断

**使用的 MCP 工具**：
```bash
mcp_supabase_get_advisors       # 获取安全建议
mcp_supabase_execute_sql        # 查询权限信息
```

### 5. 🚀 **Edge Functions 开发**
**触发条件**：
- 部署 Edge Functions
- 查看函数列表
- 调试函数问题

**使用的 MCP 工具**：
```bash
mcp_supabase_list_edge_functions    # 列出函数
mcp_supabase_deploy_edge_function   # 部署函数
mcp_supabase_get_logs               # 查看日志
```

### 6. 🛠️ **项目配置和环境**
**触发条件**：
- 获取项目信息
- 检查扩展状态
- 验证配置正确性

**使用的 MCP 工具**：
```bash
mcp_supabase_get_project_url    # 获取项目 URL
mcp_supabase_get_anon_key       # 获取匿名密钥
mcp_supabase_list_extensions    # 列出扩展
```

### 7. 🐛 **调试和故障排除**
**触发条件**：
- 应用报错需要查看日志
- 性能问题分析
- 数据不一致问题
- 函数执行异常

**使用的 MCP 工具**：
```bash
mcp_supabase_get_logs           # 获取各服务日志
mcp_supabase_execute_sql        # 执行调试查询
mcp_supabase_get_advisors       # 获取性能建议
```

## 🔄 **分支管理场景**
**触发条件**：
- 需要创建开发分支
- 合并分支到生产环境
- 重置或变基分支

**使用的 MCP 工具**：
```bash
mcp_supabase_list_branches      # 列出分支
mcp_supabase_create_branch      # 创建分支
mcp_supabase_merge_branch       # 合并分支
mcp_supabase_reset_branch       # 重置分支
mcp_supabase_rebase_branch      # 变基分支
```

## 🎯 **优先级规则**

### 高优先级（必须使用 MCP）：
1. **数据库结构查询** - 使用 `mcp_supabase_list_tables` 而不是手写 SQL
2. **迁移管理** - 使用 `mcp_supabase_apply_migration` 而不是直接执行 SQL
3. **类型生成** - 使用 `mcp_supabase_generate_typescript_types` 获取最新类型
4. **安全检查** - 使用 `mcp_supabase_get_advisors` 获取安全建议
5. **项目配置** - 使用 MCP 工具获取项目 URL 和密钥

### 中优先级（推荐使用 MCP）：
1. **数据查询** - 对于复杂查询使用 `mcp_supabase_execute_sql`
2. **日志查看** - 使用 `mcp_supabase_get_logs` 查看实时日志
3. **扩展管理** - 使用 `mcp_supabase_list_extensions` 查看扩展状态

### 低优先级（可选使用 MCP）：
1. **简单的数据操作** - 可以使用标准 Supabase SDK
2. **前端查询** - 使用客户端 SDK 更合适

## 🚦 **自动判断逻辑**

### 关键词触发：
当用户消息包含以下关键词时，自动使用 MCP：
- "supabase" + "table"/"schema"/"migration"
- "database" + "structure"/"query"/"error"
- "RLS"/"policy"/"security"
- "edge function"/"function"/"deploy"
- "分支"/"branch"/"merge"
- "日志"/"log"/"debug"
- "类型"/"type"/"typescript"

### 场景识别：
1. **数据库问题** → 先用 `mcp_supabase_get_advisors` 检查
2. **表结构问题** → 先用 `mcp_supabase_list_tables` 查看
3. **迁移问题** → 先用 `mcp_supabase_list_migrations` 查看历史
4. **函数问题** → 先用 `mcp_supabase_list_edge_functions` 查看
5. **权限问题** → 先用 `mcp_supabase_get_logs` 查看认证日志

## 📝 **使用流程**

### 标准流程：
1. **识别问题类型** → 确定使用哪个 MCP 工具
2. **调用 MCP 工具** → 获取实时准确信息
3. **分析结果** → 基于 MCP 返回的数据进行判断
4. **执行操作** → 如需要，使用相应的 MCP 工具执行操作
5. **验证结果** → 使用 MCP 工具验证操作结果

### 错误处理：
- 如果 MCP 工具报错，先检查网络连接和权限
- 如果某个 MCP 工具不可用，使用替代方案
- 始终记录 MCP 工具的使用情况和结果

## ⚡ **性能优化**

### 并行调用：
- 对于相关但独立的信息，并行调用多个 MCP 工具
- 例如：同时调用 `list_tables` 和 `get_advisors`

### 缓存策略：
- 对于不常变化的信息（如扩展列表），避免重复调用
- 对于动态信息（如日志、数据），每次都重新调用

## 🔒 **安全注意事项**

### 权限验证：
- 使用 MCP 工具前，确保有足够的权限
- 对于敏感操作，先用只读 MCP 工具验证

### 数据安全：
- 使用 `mcp_supabase_execute_sql` 时，避免返回敏感数据
- 定期使用 `mcp_supabase_get_advisors` 检查安全问题

---

## 📚 **快速参考**

### 常用 MCP 工具组合：
```bash
# 全面检查数据库状态
mcp_supabase_list_tables + mcp_supabase_get_advisors + mcp_supabase_list_extensions

# 迁移相关操作
mcp_supabase_list_migrations + mcp_supabase_apply_migration + mcp_supabase_execute_sql

# 函数开发流程
mcp_supabase_list_edge_functions + mcp_supabase_deploy_edge_function + mcp_supabase_get_logs

# 类型开发流程
mcp_supabase_list_tables + mcp_supabase_generate_typescript_types
```

这个规则确保在 Supabase 开发过程中，能够自动、及时、准确地使用 MCP 工具，提高开发效率和代码质量。 