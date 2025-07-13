#!/bin/bash

# Neura 数据库部署测试脚本
# 使用更新后的数据库密码

set -e

DB_PASSWORD="Lpj8NsCLSQIvOIlE"

echo "🚀 Neura 数据库部署测试"
echo "========================="

# 1. 检查本地环境
echo "1. 检查本地环境..."
supabase status | grep -E "(API URL|DB URL|Studio URL)"

# 2. 检查迁移文件
echo -e "\n2. 检查迁移文件..."
ls -la supabase/migrations/

# 3. 查看当前迁移状态
echo -e "\n3. 查看当前迁移状态..."
supabase migration list -p "$DB_PASSWORD"

# 4. 干跑测试
echo -e "\n4. 干跑测试 (预览将要推送的迁移)..."
supabase db push --dry-run -p "$DB_PASSWORD"

# 5. 询问是否继续
echo -e "\n📋 准备推送以下迁移到线上："
echo "• 20240101000000_initial_schema.sql"
echo "• 20240102000000_search_functions.sql"
echo ""
read -p "是否继续推送到线上数据库? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 正在推送迁移到线上..."
    supabase db push -p "$DB_PASSWORD"
    
    echo -e "\n✅ 推送完成！"
    
    # 6. 验证推送结果
    echo -e "\n6. 验证推送结果..."
    supabase migration list -p "$DB_PASSWORD"
    
    echo -e "\n🎉 部署成功！"
    echo "现在可以："
    echo "• 测试前端应用功能"
    echo "• 验证搜索功能是否正常"
    echo "• 检查 Supabase Dashboard"
    
else
    echo "❌ 取消推送"
    echo "您可以稍后运行以下命令进行推送："
    echo "supabase db push -p \"$DB_PASSWORD\""
fi

echo -e "\n📚 相关文档:"
echo "• 连接状态报告: CONNECTION_STATUS_REPORT.md"
echo "• 数据库开发规则: DATABASE_DEVELOPMENT_RULES.md"
echo "• 本地开发指南: LOCAL_DEVELOPMENT_GUIDE.md" 