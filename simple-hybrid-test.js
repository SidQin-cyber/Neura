#!/usr/bin/env node

/**
 * 简单混合搜索测试 - 使用浏览器登录状态
 */

console.log('🚀 简单混合搜索测试')
console.log('请确保：')
console.log('1. Next.js服务器运行在 http://localhost:3002')
console.log('2. 你已在浏览器中登录并有有效的候选人数据')
console.log('3. 将在浏览器开发者工具中手动执行以下代码')
console.log('=' .repeat(60))

const testCode = `
// 🧪 在浏览器控制台中执行此代码来测试混合搜索

async function testHybridSearch() {
  console.log('🔍 开始混合搜索测试...')
  
  const testCases = [
    {
      name: '测试1: 默认权重',
      query: '小米通讯技术有限公司机器人事业部',
      alpha: 0.7
    },
    {
      name: '测试2: 姓名搜索',
      query: '贝文瑾',
      alpha: 0.3
    },
    {
      name: '测试3: 技能搜索',
      query: 'Python 机器人',
      alpha: 0.5
    }
  ]
  
  for (const testCase of testCases) {
    console.log(\`\\n🧪 \${testCase.name}\`)
    console.log(\`📝 查询: "\${testCase.query}"\`)
    console.log(\`⚖️  权重: α=\${testCase.alpha}\`)
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: testCase.query,
          mode: 'candidates',
          alpha: testCase.alpha,
          filters: {}
        })
      })
      
      if (!response.ok) {
        console.error(\`❌ HTTP \${response.status}: \${response.statusText}\`)
        continue
      }
      
      const reader = response.body?.getReader()
      if (!reader) {
        console.error('❌ 无法读取响应流')
        continue
      }
      
      let results = null
      let searchConfig = null
      
      // 读取流式响应
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.type === 'results') {
              results = data.data
              searchConfig = data.search_config
            } else if (data.type === 'error') {
              console.error(\`❌ 搜索错误: \${data.error}\`)
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      }
      
      // 分析结果
      if (results && results.length > 0) {
        console.log(\`✅ 找到 \${results.length} 个结果\`)
        console.log(\`📊 搜索配置:\`, searchConfig)
        
        // 显示前3个结果
        results.slice(0, 3).forEach((result, index) => {
          console.log(\`  \${index + 1}. \${result.name} (\${result.current_company})\`)
          console.log(\`     - 最终分数: \${result.final_score?.toFixed(4)} (\${result.match_score}%)\`)
          console.log(\`     - 向量: \${result.normalized_vector_score?.toFixed(4)} | FTS: \${result.normalized_fts_score?.toFixed(4)}\`)
        })
        
        // 分析分数分布
        const scores = results.map(r => r.final_score || 0)
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        console.log(\`📈 分数统计: 最高=\${Math.max(...scores).toFixed(4)}, 平均=\${avg.toFixed(4)}\`)
        
      } else {
        console.log(\`❌ 无搜索结果\`)
      }
      
    } catch (error) {
      console.error(\`🚨 测试失败:\`, error.message)
    }
    
    // 延迟1秒
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('\\n🎉 测试完成!')
}

// 执行测试
testHybridSearch()
`

console.log('📋 复制以下代码到浏览器控制台执行：')
console.log('=' .repeat(60))
console.log(testCode)
console.log('=' .repeat(60))

console.log('\n🔧 或者，检查后端日志来诊断问题：')
console.log('1. 打开 http://localhost:3002 并登录')
console.log('2. 在搜索框中输入查询')
console.log('3. 观察服务器控制台的详细日志')
console.log('4. 检查是否有数据库连接或RPC调用错误')

console.log('\n🩺 常见问题诊断：')
console.log('- 401错误: 需要先在浏览器中登录')
console.log('- 500错误: 检查数据库连接和RPC函数')
console.log('- 空结果: 检查用户数据和搜索权限') 