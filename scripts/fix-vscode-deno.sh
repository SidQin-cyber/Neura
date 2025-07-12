#!/bin/bash

echo "🔧 修复 VSCode Deno 环境配置..."

# 检查是否有Deno扩展配置
if [ -f ".vscode/settings.json" ]; then
    echo "✅ VSCode 设置文件已存在"
else
    echo "❌ VSCode 设置文件不存在，创建中..."
    mkdir -p .vscode
    cat > .vscode/settings.json << 'EOF'
{
  "deno.enable": true,
  "deno.enablePaths": [
    "./supabase/functions"
  ],
  "deno.lint": false,
  "deno.unstable": true,
  "deno.config": "./supabase/functions/deno.json",
  "deno.importMap": "./supabase/functions/import_map.json",
  "[typescript]": {
    "editor.defaultFormatter": "denoland.vscode-deno"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": false,
  "files.associations": {
    "supabase/functions/**/*.ts": "typescript"
  }
}
EOF
fi

# 检查 Deno 配置文件
if [ -f "supabase/functions/deno.json" ]; then
    echo "✅ Deno 配置文件已存在"
else
    echo "❌ Deno 配置文件不存在"
fi

# 检查所有Edge Functions是否有@ts-nocheck
echo "🔍 检查 Edge Functions TypeScript 配置..."

for func_dir in supabase/functions/*/; do
    if [ -f "${func_dir}index.ts" ]; then
        func_name=$(basename "$func_dir")
        if head -n 1 "${func_dir}index.ts" | grep -q "@ts-nocheck"; then
            echo "✅ $func_name: TypeScript 检查已禁用"
        else
            echo "⚠️  $func_name: 缺少 @ts-nocheck 标记"
        fi
    fi
done

echo ""
echo "🚀 修复步骤完成！"
echo ""
echo "请按以下步骤操作："
echo "1. 安装 Deno 扩展（如果还没有）："
echo "   - 在 VSCode 中按 Ctrl+Shift+X"
echo "   - 搜索 'Deno'"
echo "   - 安装 'Deno for VSCode' 扩展"
echo ""
echo "2. 重新加载 VSCode 窗口："
echo "   - 按 Ctrl+Shift+P (Mac: Cmd+Shift+P)"
echo "   - 输入 'Developer: Reload Window'"
echo "   - 按回车执行"
echo ""
echo "3. 验证配置："
echo "   - 打开任何 Edge Function 文件"
echo "   - 右下角应该显示 'Deno' 而不是 'TypeScript'"
echo "   - 红色错误标记应该消失"
echo ""
echo "如果仍有问题，请检查："
echo "- Deno 扩展是否正确安装"
echo "- VSCode 版本是否支持 Deno 扩展"
echo "- 重启 VSCode 应用程序" 