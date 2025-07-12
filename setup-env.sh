#!/bin/bash

# Neura AI 招聘平台自动配置脚本

echo "🚀 开始配置 Neura AI 招聘平台..."

# 检查是否在项目根目录
if [[ ! -f "package.json" ]]; then
    echo "❌ 错误：请在项目根目录中运行此脚本"
    exit 1
fi

# 创建 .env.local 文件
echo "📝 创建环境变量文件..."
cat > .env.local << 'ENVEOF'
# ================================
# CORE CONFIGURATION (REQUIRED)
# ================================

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://suhchngsnkkuhjdioalo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1aGNobmdzbmtrdWhqZGlvYWxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyOTU2NDQsImV4cCI6MjA2Nzg3MTY0NH0.N8t6_TKpTtRJFkIjEV92pre6vZItavaDuF9rgrG4zOE

# OpenAI Configuration
OPENAI_API_KEY=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

# ================================
# OPTIONAL CONFIGURATIONS
# ================================

# Search Provider Configuration
TAVILY_API_KEY=

# Feature Toggles
NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY=true
NEXT_PUBLIC_ENABLE_SHARE=true

# Redis Configuration (Optional)
USE_LOCAL_REDIS=false
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Other AI Providers (Optional)
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
GROQ_API_KEY=
AZURE_API_KEY=
AZURE_RESOURCE_NAME=
DEEPSEEK_API_KEY=
FIREWORKS_API_KEY=
XAI_API_KEY=

# Ollama Configuration (Optional)
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI Compatible API (Optional)
OPENAI_COMPATIBLE_API_KEY=
OPENAI_COMPATIBLE_API_BASE_URL=

# SearXNG Configuration (Optional)
SEARCH_API=searxng
SEARXNG_API_URL=http://localhost:8080
SEARXNG_SECRET=
SEARXNG_PORT=8080
SEARXNG_BIND_ADDRESS=0.0.0.0
SEARXNG_IMAGE_PROXY=true
SEARXNG_DEFAULT_DEPTH=basic
SEARXNG_MAX_RESULTS=50
SEARXNG_ENGINES=google,bing,duckduckgo,wikipedia
SEARXNG_TIME_RANGE=None
SEARXNG_SAFESEARCH=0
SEARXNG_LIMITER=false
SEARXNG_CRAWL_MULTIPLIER=4

# Other API Keys (Optional)
SERPER_API_KEY=
JINA_API_KEY=

# Base URL Configuration (Optional)
NEXT_PUBLIC_BASE_URL=
BASE_URL=
ENVEOF

echo "✅ 环境变量文件已创建"

# 创建 Supabase Edge Functions 环境变量文件
echo "📝 创建 Supabase Edge Functions 环境变量文件..."
cat > .env.supabase << 'SUBEOF'
OPENAI_API_KEY=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
SUBEOF

echo "✅ Supabase Edge Functions 环境变量文件已创建"

# 检查 Supabase CLI 是否安装
if ! command -v supabase &> /dev/null; then
    echo "⚠️  警告：Supabase CLI 未安装"
    echo "请运行以下命令安装 Supabase CLI："
    echo "npm install -g supabase"
    echo "或访问：https://supabase.com/docs/guides/cli"
else
    echo "✅ Supabase CLI 已安装"
    
    # 询问是否要设置 Edge Functions 环境变量
    echo ""
    read -p "是否要设置 Supabase Edge Functions 环境变量？(y/N): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔧 设置 Edge Functions 环境变量..."
        if supabase secrets set --env-file .env.supabase; then
            echo "✅ Edge Functions 环境变量设置成功"
        else
            echo "❌ Edge Functions 环境变量设置失败"
            echo "请确保您已登录到 Supabase 并连接到正确的项目"
        fi
    fi
    
    # 询问是否要部署 Edge Functions
    echo ""
    read -p "是否要部署 Edge Functions？(y/N): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 部署 Edge Functions..."
        
        echo "部署 process-resume 函数..."
        supabase functions deploy process-resume
        
        echo "部署 get-embedding 函数..."
        supabase functions deploy get-embedding
        
        echo "部署 copilot-qna 函数..."
        supabase functions deploy copilot-qna
        
        echo "✅ Edge Functions 部署完成"
    fi
fi

# 检查 Node.js 依赖
if [[ ! -d "node_modules" ]]; then
    echo "📦 安装 Node.js 依赖..."
    if command -v bun &> /dev/null; then
        bun install
    elif command -v npm &> /dev/null; then
        npm install
    else
        echo "❌ 错误：未找到 bun 或 npm"
        exit 1
    fi
    echo "✅ 依赖安装完成"
fi

echo ""
echo "🎉 配置完成！"
echo ""
echo "接下来的步骤："
echo "1. 📚 阅读配置指南：NEURA_CONFIGURATION_GUIDE.md"
echo "2. 🗄️  在 Supabase 仪表板中执行 database/schema.sql"
echo "3. 🔧 在 Supabase 仪表板中执行 database/rpc_functions.sql"
echo "4. 📁 在 Supabase Storage 中创建存储桶 'resumes-raw' 和 'resumes-processed'"
echo "5. 🚀 启动开发服务器：bun dev"
echo ""
echo "有问题？请查看 NEURA_DEVELOPMENT_SUMMARY.md 文档"
