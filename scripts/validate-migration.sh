#!/bin/bash

# 迁移文件验证脚本
# 用于检查迁移文件是否遵循最佳实践

set -e

echo "🔍 验证迁移文件..."

# 检查是否有未提交的迁移文件
if [ -n "$(git status --porcelain supabase/migrations/)" ]; then
    echo "⚠️  发现未提交的迁移文件："
    git status --porcelain supabase/migrations/
    echo "请先提交迁移文件到 Git"
    exit 1
fi

# 获取最新的迁移文件
LATEST_MIGRATION=$(ls -t supabase/migrations/*.sql 2>/dev/null | head -1)

if [ -z "$LATEST_MIGRATION" ]; then
    echo "✅ 没有找到迁移文件"
    exit 0
fi

echo "📄 检查最新迁移文件: $LATEST_MIGRATION"

# 检查迁移文件内容
echo "🔍 检查迁移文件内容..."

# 检查是否包含回滚说明
if ! grep -q "回滚\|rollback\|Rollback" "$LATEST_MIGRATION"; then
    echo "❌ 迁移文件缺少回滚说明"
    echo "请在迁移文件中添加回滚说明"
    exit 1
fi

# 检查是否包含危险操作但没有适当的保护
DANGEROUS_OPERATIONS=("DROP TABLE" "DROP COLUMN" "ALTER TABLE.*DROP")

for op in "${DANGEROUS_OPERATIONS[@]}"; do
    if grep -qi "$op" "$LATEST_MIGRATION" && ! grep -qi "IF EXISTS" "$LATEST_MIGRATION"; then
        echo "⚠️  发现危险操作: $op"
        echo "建议使用 IF EXISTS 子句以提高安全性"
    fi
done

# 检查是否有描述性注释
if ! grep -q "^--.*" "$LATEST_MIGRATION"; then
    echo "⚠️  建议在迁移文件中添加描述性注释"
fi

echo "🧪 测试迁移文件..."

# 测试迁移是否可以成功应用
if ! supabase db reset --quiet; then
    echo "❌ 迁移测试失败"
    echo "请检查迁移文件的 SQL 语法"
    exit 1
fi

echo "✅ 迁移文件验证通过"

# 显示迁移后的数据库状态
echo "📊 当前数据库状态："
supabase status | grep -E "(API URL|DB URL|Studio URL)"

echo ""
echo "🚀 准备部署："
echo "1. 确认迁移文件已提交到 Git"
echo "2. 运行: supabase db push"
echo "3. 验证线上功能正常"

echo ""
echo "📋 回滚准备："
echo "如果需要回滚，请参考迁移文件中的回滚说明"
echo "或使用: supabase db reset --to [previous_migration_timestamp]" 