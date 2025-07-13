#!/bin/bash

# 部署状态检查脚本
# 检查 Supabase CLI 与线上项目的连接状态

set -e

echo "🔍 检查 Supabase CLI 部署状态..."
echo "=================================="

# 1. 检查 CLI 登录状态
echo "1. 检查 CLI 登录状态..."
if ! supabase projects list > /dev/null 2>&1; then
    echo "❌ CLI 未登录，请先运行: supabase login"
    exit 1
fi
echo "✅ CLI 已登录"

# 2. 检查项目连接状态
echo ""
echo "2. 检查项目连接状态..."
PROJECT_INFO=$(supabase projects list | grep "●" | head -1)
if [ -z "$PROJECT_INFO" ]; then
    echo "❌ 没有连接到任何项目"
    echo "请运行: supabase link --project-ref kwnljatqoisviobioelr"
    exit 1
fi

PROJECT_ID=$(echo "$PROJECT_INFO" | awk '{print $3}')
PROJECT_NAME=$(echo "$PROJECT_INFO" | awk '{print $4}')
echo "✅ 已连接到项目: $PROJECT_NAME ($PROJECT_ID)"

# 3. 检查本地服务状态
echo ""
echo "3. 检查本地服务状态..."
if ! supabase status > /dev/null 2>&1; then
    echo "⚠️  本地服务未运行"
    echo "建议运行: supabase start"
else
    echo "✅ 本地服务正在运行"
fi

# 4. 检查迁移状态
echo ""
echo "4. 检查迁移状态..."
echo "本地迁移文件:"
supabase migration list --local | grep -E "^\s*[0-9]" | while read line; do
    echo "  • $line"
done

# 5. 测试基本连接
echo ""
echo "5. 测试基本连接..."
if node test-connection.js 2>&1 | grep -q "基本连接成功"; then
    echo "✅ 基本连接正常"
else
    echo "❌ 基本连接失败"
    echo "详细信息:"
    node test-connection.js
fi

echo ""
echo "=================================="
echo "📋 部署准备检查清单:"
echo ""

# 检查清单
CHECKLIST_PASSED=true

# 检查是否有未提交的迁移
if [ -n "$(git status --porcelain supabase/migrations/)" ]; then
    echo "❌ 有未提交的迁移文件"
    CHECKLIST_PASSED=false
else
    echo "✅ 迁移文件已提交"
fi

# 检查是否有本地变更
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  有未提交的本地变更"
else
    echo "✅ 工作目录干净"
fi

# 检查环境变量文件
if [ -f ".env.production" ]; then
    echo "✅ 线上环境变量文件存在"
else
    echo "⚠️  缺少线上环境变量文件"
fi

echo ""
if [ "$CHECKLIST_PASSED" = true ]; then
    echo "🎉 准备就绪！可以执行部署操作："
    echo ""
    echo "📤 推送数据库迁移到线上："
    echo "   supabase db push"
    echo ""
    echo "🚀 部署 Edge Functions："
    echo "   supabase functions deploy"
    echo ""
    echo "🌐 部署前端到 Vercel："
    echo "   git push origin main"
else
    echo "⚠️  请先解决上述问题再进行部署"
fi 