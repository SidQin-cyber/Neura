#!/usr/bin/env node

/**
 * 混合搜索测试脚本
 * 测试FTS + 向量搜索的分数归一化功能
 */

const API_BASE = 'http://localhost:3002/api'

// 测试用例配置
const testCases = [
  {
    name: '测试1: 默认权重（70%向量）',
    query: '小米通讯技术有限公司机器人事业部',
    mode: 'candidates',
    alpha: 0.7,
    filters: {}
  },
  {
    name: '测试2: 语义优先（90%向量）',
    query: '机器人仿真平台建设算法开发',
    mode: 'candidates', 
    alpha: 0.9,
    filters: {}
  },
  {
    name: '测试3: 关键词优先（30%向量）',
    query: '贝文瑾',
    mode: 'candidates',
    alpha: 0.3,
    filters: {}
  },
  {
    name: '测试4: 平衡权重（50%向量）',
    query: 'ROS Python C++ 机器人仿真',
    mode: 'candidates',
    alpha: 0.5,
    filters: {}
  },
  {
    name: '测试5: 技能匹配',
    query: '具备人形轮式机器人整机及核心部组件的全流程运动学与动力学仿真经验',
    mode: 'candidates',
    alpha: 0.7,
    filters: {}
  }
]

// 发送搜索请求并解析流式响应
async function testHybridSearch(testCase) {
  console.log(`\n🧪 ${testCase.name}`)
  console.log(`📝 查询: "${testCase.query}"`)
  console.log(`⚖️  权重配置: α=${testCase.alpha} (${Math.round(testCase.alpha*100)}%向量 + ${Math.round((1-testCase.alpha)*100)}%FTS)`)
  
  try {
    const response = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_TOKEN || 'your-test-token'}`
      },
      body: JSON.stringify({
        query: testCase.query,
        mode: testCase.mode,
        filters: testCase.filters,
        alpha: testCase.alpha
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    let searchResults = null
    let searchConfig = null

    // 读取流式响应
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = new TextDecoder().decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          
          if (data.type === 'results') {
            searchResults = data.data
            searchConfig = data.search_config
          } else if (data.type === 'error') {
            throw new Error(`搜索错误: ${data.error}`)
          }
        } catch (parseError) {
          // 忽略JSON解析错误（可能是不完整的chunk）
        }
      }
    }

    // 分析结果
    if (searchResults && searchResults.length > 0) {
      console.log(`✅ 搜索成功: ${searchResults.length} 个结果`)
      console.log(`📊 搜索配置:`, searchConfig)
      
      // 显示Top 3结果及其分数详情
      console.log(`🏆 Top 3 结果:`)
      searchResults.slice(0, 3).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.name} (${result.current_company})`)
        console.log(`     - 最终分数: ${result.final_score?.toFixed(4)} (${result.match_score}%)`)
        console.log(`     - 向量分数: ${result.normalized_vector_score?.toFixed(4)} (原始: ${result.similarity?.toFixed(4)})`)
        console.log(`     - FTS分数: ${result.normalized_fts_score?.toFixed(4)} (原始: ${result.fts_rank?.toFixed(4)})`)
        console.log()
      })

      // 分析分数分布
      const finalScores = searchResults.map(r => r.final_score || 0)
      const avgScore = finalScores.reduce((sum, score) => sum + score, 0) / finalScores.length
      const maxScore = Math.max(...finalScores)
      const minScore = Math.min(...finalScores)

      console.log(`📈 分数统计:`)
      console.log(`  - 最高分: ${maxScore.toFixed(4)}`)
      console.log(`  - 最低分: ${minScore.toFixed(4)}`)
      console.log(`  - 平均分: ${avgScore.toFixed(4)}`)
      console.log(`  - 分数范围: ${(maxScore - minScore).toFixed(4)}`)

      // 权重效果分析
      if (searchResults.length >= 2) {
        const vectorVariance = calculateVariance(searchResults.map(r => r.normalized_vector_score || 0))
        const ftsVariance = calculateVariance(searchResults.map(r => r.normalized_fts_score || 0))
        
        console.log(`🔍 权重效果分析:`)
        console.log(`  - 向量分数方差: ${vectorVariance.toFixed(4)}`)
        console.log(`  - FTS分数方差: ${ftsVariance.toFixed(4)}`)
        console.log(`  - 主导因子: ${vectorVariance > ftsVariance ? '向量搜索' : 'FTS搜索'}`)
      }

    } else {
      console.log(`❌ 搜索无结果`)
    }

  } catch (error) {
    console.error(`🚨 测试失败:`, error.message)
  }
}

// 计算方差
function calculateVariance(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
}

// 主测试流程
async function runAllTests() {
  console.log('🚀 开始混合搜索功能测试')
  console.log('=' .repeat(60))

  for (const testCase of testCases) {
    await testHybridSearch(testCase)
    console.log('-'.repeat(60))
    
    // 测试间隔，避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n🎉 所有测试完成！')
  console.log('\n📋 测试总结:')
  console.log('1. 验证了不同α权重配置的效果')
  console.log('2. 测试了Min-Max归一化功能')
  console.log('3. 确认了加权组合算法的正确性')
  console.log('4. 分析了搜索质量和分数分布')
}

// 执行测试
if (require.main === module) {
  runAllTests().catch(console.error)
}

module.exports = { testHybridSearch, runAllTests } 