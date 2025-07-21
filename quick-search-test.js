/**
 * 快速搜索测试 - 验证修复效果
 * 运行: node quick-search-test.js
 */

const testQueries = [
  '5年Java开发经验',
  '前端工程师 React',
  '数据分析师',
  'Senior Python Developer'
]

async function quickTest() {
  console.log('🚀 快速搜索测试开始...\n')
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i]
    console.log(`${i + 1}. 测试查询: "${query}"`)
    
    try {
      // 1. 测试Spark解析
      const parseResponse = await fetch('http://localhost:3000/api/parse-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      
      if (parseResponse.ok) {
        const parseResult = await parseResponse.json()
        if (parseResult.success && parseResult.data?.rewritten_query) {
          console.log(`   🧠 Spark重写: ${parseResult.data.rewritten_query}`)
        }
      }
      
      // 2. 测试候选人搜索
      const searchResponse = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          mode: 'candidates',
          filters: {}
        })
      })
      
      if (searchResponse.ok) {
        const reader = searchResponse.body?.getReader()
        let resultCount = 0
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = new TextDecoder().decode(value)
          const lines = chunk.split('\n').filter(line => line.trim())
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (data.type === 'chunk' && data.data) {
                resultCount += data.data.length
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
        
        console.log(`   ✅ 候选人搜索结果: ${resultCount}个`)
      } else {
        console.log(`   ❌ 搜索失败: ${searchResponse.status}`)
      }
      
    } catch (error) {
      console.log(`   💥 测试错误: ${error.message}`)
    }
    
    console.log('')
    
    // 防止API限流
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('🎉 快速测试完成!')
}

// 运行测试
quickTest().catch(console.error) 