/**
 * 调试镜像对称搜索功能
 */

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testQuery: '计算机视觉工程师，会PyTorch和SLAM' // <--- 修改为此查询
}

async function debugMirrorSymmetricSearch() {
  console.log('🔍 开始调试镜像对称搜索...\n')
  
  try {
    // 1. 测试Spark解析
    console.log('1️⃣ 测试Spark解析功能')
    const parseResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/parse-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TEST_CONFIG.testQuery })
    })
    
    if (parseResponse.ok) {
      const parseResult = await parseResponse.json()
      console.log('✅ Spark解析成功:')
      console.log('   解析数据:', JSON.stringify(parseResult.data, null, 2))
      
      // 2. 测试虚拟档案生成 (模拟)
      if (parseResult.success && parseResult.data) {
        console.log('\n2️⃣ 模拟虚拟档案生成')
        const parsedData = parseResult.data
        
        // 模拟 createVirtualCandidateProfileText 的逻辑
        const mockVirtualProfile = generateMockVirtualProfile(parsedData)
        console.log('✅ 虚拟档案预览:')
        console.log('   ', mockVirtualProfile.substring(0, 200) + '...')
        
        // 模拟 createFTSQueryText 的逻辑
        const mockFTSText = generateMockFTSText(parsedData)
        console.log('✅ FTS关键词:')
        console.log('   ', mockFTSText)
      }
    } else {
      console.error('❌ Spark解析失败:', parseResponse.status)
    }
    
    // 3. 测试完整搜索流程
    console.log('\n3️⃣ 测试完整搜索流程')
    const searchResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: TEST_CONFIG.testQuery,
        mode: 'candidates',
        filters: {}
      })
    })
    
    if (searchResponse.ok) {
      const reader = searchResponse.body?.getReader()
      let resultCount = 0
      let chunks = 0
      
      console.log('✅ 搜索API响应成功，开始解析流式结果...')
      
      if (reader) {
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
                chunks++
                console.log(`   📦 收到第${chunks}个数据块: ${data.data.length}个结果`)
                
                // 打印前几个结果的详细信息
                if (chunks === 1 && data.data.length > 0) {
                  console.log('   🔍 第一个结果详情:')
                  const firstResult = data.data[0]
                  console.log(`     姓名: ${firstResult.name}`)
                  console.log(`     职位: ${firstResult.current_title}`)
                  console.log(`     技能: ${firstResult.skills?.join(', ') || 'N/A'}`)
                  console.log(`     相似度: ${firstResult.similarity?.toFixed(4) || 'N/A'}`)
                  console.log(`     FTS分数: ${firstResult.fts_rank?.toFixed(4) || 'N/A'}`)
                  console.log(`     综合分数: ${firstResult.combined_score?.toFixed(4) || 'N/A'}`)
                }
              } else if (data.type === 'error') {
                console.error('   ❌ 搜索错误:', data.error)
              } else if (data.type === 'meta') {
                console.log(`   📊 元信息: ${data.phase} - 总数${data.total}, 重排${data.reranked}`)
              }
            } catch (parseError) {
              // 忽略JSON解析错误
            }
          }
        }
      }
      
      console.log(`\n✅ 搜索完成: 共找到${resultCount}个候选人, ${chunks}个数据块`)
      
      if (resultCount === 0) {
        console.log('\n🚨 零结果分析:')
        console.log('   可能原因:')
        console.log('   1. 虚拟档案生成失败')
        console.log('   2. embedding向量相似度过低')
        console.log('   3. FTS搜索未匹配')
        console.log('   4. 数据库函数调用失败')
      }
      
    } else {
      console.error('❌ 搜索API失败:', searchResponse.status)
    }
    
  } catch (error) {
    console.error('💥 调试过程出错:', error.message)
  }
}

// 模拟虚拟档案生成函数
function generateMockVirtualProfile(parsedData) {
  const sections = []
  
  if (parsedData.role?.length > 0) {
    sections.push(`寻求一位理想的候选人。理想职位是${parsedData.role.join('或')}。`)
  }
  
  if (parsedData.skills_must?.length > 0) {
    sections.push(`个人简介：这是一位经验丰富的专业人士，精通${parsedData.skills_must.join('、')}等核心技术。`)
  }
  
  const allSkills = [
    ...(parsedData.skills_must || []),
    ...(parsedData.skills_related?.map(s => s.skill || s) || [])
  ]
  if (allSkills.length > 0) {
    sections.push(`专业技能：${allSkills.join('、')}。`)
  }
  
  return sections.length > 0 ? sections.join('\n') : '寻求一位有能力的专业人士。'
}

// 模拟FTS文本生成函数
function generateMockFTSText(parsedData) {
  const keywords = []
  
  if (parsedData.role?.length > 0) {
    keywords.push(...parsedData.role)
  }
  if (parsedData.skills_must?.length > 0) {
    keywords.push(...parsedData.skills_must)
  }
  
  return keywords.length > 0 ? keywords.join(' ') : 'Python'
}

// 运行调试
debugMirrorSymmetricSearch().then(() => {
  console.log('\n🎉 调试完成!')
}).catch(error => {
  console.error('\n💥 调试失败:', error)
}) 