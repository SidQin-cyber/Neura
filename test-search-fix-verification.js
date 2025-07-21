/**
 * 搜索修复验证测试
 * 用于验证中文分词修复和embedding优化的效果
 */

// 测试查询列表
const testQueries = [
  // 中文查询（测试FTS修复）
  '5年Java开发经验',
  '前端工程师 React Vue',
  '数据分析师 Python',
  '产品经理 3年经验',
  '全栈工程师 Node.js',
  
  // 英文查询
  'Senior Frontend Developer',
  'Python Data Scientist',
  'Java Backend Engineer',
  
  // 混合查询
  'Java开发工程师 Spring Boot',
  'React前端开发 TypeScript',
  'Python数据分析 Machine Learning'
]

// 测试配置
const TEST_CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  maxRetries: 3,
  retryDelay: 1000
}

// Cookie获取函数（如果需要认证）
function getCookies() {
  // 这里需要根据实际情况设置认证cookie
  return {}
}

// 执行单个搜索测试
async function testSingleSearch(query, mode = 'candidates') {
  console.log(`\n🔍 测试查询: "${query}" (${mode})`)
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 如果需要认证，在这里添加cookie
      },
      body: JSON.stringify({
        query,
        mode,
        filters: {}
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    // 处理流式响应
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }
    
    const results = []
    let chunks = 0
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = new TextDecoder().decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          
          if (data.type === 'chunk' && data.data) {
            results.push(...data.data)
            chunks++
            console.log(`  📦 接收到第${chunks}个数据块: ${data.data.length}个结果`)
          } else if (data.type === 'error') {
            throw new Error(data.error)
          } else if (data.type === 'meta') {
            console.log(`  📊 元信息: ${data.phase} - 总数${data.total}, 重排${data.reranked}`)
          }
        } catch (parseError) {
          // 忽略JSON解析错误，可能是不完整的chunk
        }
      }
    }
    
    console.log(`  ✅ 搜索完成: 共${results.length}个结果, ${chunks}个数据块`)
    
    // 分析结果质量
    if (results.length > 0) {
      const topResult = results[0]
      const avgSimilarity = results.length > 0 
        ? results.reduce((sum, r) => sum + (r.similarity || 0), 0) / results.length 
        : 0
      
      console.log(`  📈 结果质量分析:`)
      console.log(`    - 最高相似度: ${topResult.similarity?.toFixed(4) || 'N/A'}`)
      console.log(`    - 平均相似度: ${avgSimilarity.toFixed(4)}`)
      console.log(`    - 第一个结果: ${topResult.name || topResult.title || 'N/A'}`)
    }
    
    return {
      success: true,
      query,
      mode,
      resultCount: results.length,
      chunks,
      results: results.slice(0, 3) // 只保留前3个用于分析
    }
    
  } catch (error) {
    console.log(`  ❌ 搜索失败: ${error.message}`)
    return {
      success: false,
      query,
      mode,
      error: error.message
    }
  }
}

// 测试Spark查询重写功能
async function testSparkParsing(query) {
  console.log(`\n🧠 测试Spark解析: "${query}"`)
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/parse-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    if (result.success && result.data) {
      console.log(`  ✅ 解析成功:`)
      console.log(`    - 原始查询: ${query}`)
      console.log(`    - 重写查询: ${result.data.rewritten_query}`)
      console.log(`    - 提取技能: ${(result.data.skills_must || []).join(', ') || '无'}`)
      console.log(`    - 职位角色: ${(result.data.role || []).join(', ') || '无'}`)
      
      return {
        success: true,
        original: query,
        rewritten: result.data.rewritten_query,
        skills: result.data.skills_must,
        roles: result.data.role
      }
    } else {
      throw new Error(result.error || '解析失败')
    }
    
  } catch (error) {
    console.log(`  ❌ 解析失败: ${error.message}`)
    return {
      success: false,
      original: query,
      error: error.message
    }
  }
}

// 主测试函数
async function runComprehensiveTest() {
  console.log('🚀 开始搜索修复验证测试')
  console.log('=' * 60)
  
  const testResults = {
    sparkParsing: [],
    candidateSearches: [],
    jobSearches: [],
    summary: {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      averageResults: 0
    }
  }
  
  // 1. 测试Spark查询解析
  console.log('\n📝 第一阶段: 测试Spark智能查询解析')
  for (const query of testQueries.slice(0, 5)) {
    const result = await testSparkParsing(query)
    testResults.sparkParsing.push(result)
    await new Promise(resolve => setTimeout(resolve, 500)) // 防止API限流
  }
  
  // 2. 测试候选人搜索
  console.log('\n👥 第二阶段: 测试候选人搜索')
  for (const query of testQueries.slice(0, 6)) {
    const result = await testSingleSearch(query, 'candidates')
    testResults.candidateSearches.push(result)
    testResults.summary.totalTests++
    
    if (result.success) {
      testResults.summary.successfulTests++
      testResults.summary.averageResults += result.resultCount
    } else {
      testResults.summary.failedTests++
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // 3. 测试职位搜索
  console.log('\n💼 第三阶段: 测试职位搜索')
  for (const query of testQueries.slice(0, 4)) {
    const result = await testSingleSearch(query, 'jobs')
    testResults.jobSearches.push(result)
    testResults.summary.totalTests++
    
    if (result.success) {
      testResults.summary.successfulTests++
      testResults.summary.averageResults += result.resultCount
    } else {
      testResults.summary.failedTests++
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // 计算平均值
  if (testResults.summary.successfulTests > 0) {
    testResults.summary.averageResults = 
      testResults.summary.averageResults / testResults.summary.successfulTests
  }
  
  // 输出总结报告
  console.log('\n📊 测试总结报告')
  console.log('=' * 60)
  console.log(`总测试数: ${testResults.summary.totalTests}`)
  console.log(`成功测试: ${testResults.summary.successfulTests}`)
  console.log(`失败测试: ${testResults.summary.failedTests}`)
  console.log(`成功率: ${((testResults.summary.successfulTests / testResults.summary.totalTests) * 100).toFixed(1)}%`)
  console.log(`平均结果数: ${testResults.summary.averageResults.toFixed(1)}`)
  
  // Spark解析统计
  const successfulParses = testResults.sparkParsing.filter(r => r.success).length
  console.log(`Spark解析成功率: ${(successfulParses / testResults.sparkParsing.length * 100).toFixed(1)}%`)
  
  // 检查是否有零结果的搜索
  const zeroResultSearches = [...testResults.candidateSearches, ...testResults.jobSearches]
    .filter(r => r.success && r.resultCount === 0)
  
  if (zeroResultSearches.length > 0) {
    console.log(`⚠️ 零结果搜索数: ${zeroResultSearches.length}`)
    console.log('零结果查询:')
    zeroResultSearches.forEach(r => console.log(`  - "${r.query}" (${r.mode})`))
  }
  
  // 保存详细结果到文件
  const fs = require('fs')
  const reportPath = `search-fix-test-report-${Date.now()}.json`
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2))
  console.log(`\n💾 详细报告已保存到: ${reportPath}`)
  
  return testResults
}

// 如果直接运行此脚本
if (require.main === module) {
  runComprehensiveTest()
    .then(results => {
      console.log('\n🎉 测试完成!')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 测试出错:', error)
      process.exit(1)
    })
}

module.exports = {
  testSingleSearch,
  testSparkParsing,
  runComprehensiveTest
} 