const { createClient } = require('@supabase/supabase-js')

// 从环境变量中读取 Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kwnljatqoisviobioelr.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bmxqYXRxb2lzdmlvYmlvZWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTU4ODAsImV4cCI6MjA2NzkzMTg4MH0.5RXiwVdTb3dDWBY_nHDwOiFqGs8W18br3MiCubWUkCM'

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseKey)

// 生成测试向量
function generateTestEmbedding() {
  const embedding = []
  for (let i = 0; i < 1536; i++) {
    embedding.push(Math.random() * 0.1 - 0.05)
  }
  return embedding
}

async function testSearchFix() {
  try {
    console.log('🔍 测试搜索功能修复...')
    
    // 生成测试向量
    const testEmbedding = generateTestEmbedding()
    const embeddingString = JSON.stringify(testEmbedding)
    
    console.log('📡 测试向量生成完成，长度:', testEmbedding.length)
    
    // 测试搜索函数（不传入用户ID）
    const { data: searchResults, error: searchError } = await supabase.rpc('search_candidates_rpc', {
      query_embedding: embeddingString,
      query_text: '前端开发',
      similarity_threshold: 0.0,
      match_count: 10,
      location_filter: null,
      experience_min: null,
      experience_max: null,
      salary_min: null,
      salary_max: null,
      skills_filter: null,
      status_filter: 'active',
      user_id: null,  // 不传入用户ID
      fts_weight: 0.4,
      vector_weight: 0.6
    })
    
    console.log('\n📊 搜索结果:')
    console.log('- 错误:', searchError)
    console.log('- 结果数量:', searchResults?.length || 0)
    
    if (searchResults && searchResults.length > 0) {
      console.log('\n✅ 搜索功能修复成功！找到候选人:')
      searchResults.forEach((candidate, index) => {
        console.log(`${index + 1}. ${candidate.name} (${candidate.current_title}) - ${candidate.location}`)
        console.log(`   相似度: ${candidate.similarity?.toFixed(4) || 'N/A'}`)
        console.log(`   综合得分: ${candidate.combined_score?.toFixed(4) || 'N/A'}`)
      })
    } else {
      console.log('\n❌ 搜索功能仍有问题，未找到任何候选人')
    }
    
    // 测试直接查询resumes表
    console.log('\n🔍 直接查询resumes表:')
    const { data: directResults, error: directError } = await supabase
      .from('resumes')
      .select('id, name, current_title, location, status')
      .eq('status', 'active')
      .limit(5)
    
    console.log('- 直接查询错误:', directError)
    console.log('- 直接查询结果数量:', directResults?.length || 0)
    
    if (directResults && directResults.length > 0) {
      console.log('- 直接查询找到的候选人:')
      directResults.forEach((candidate, index) => {
        console.log(`  ${index + 1}. ${candidate.name} (${candidate.current_title}) - ${candidate.location}`)
      })
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

// 执行测试
testSearchFix()
  .then(() => {
    console.log('\n✅ 测试完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  }) 