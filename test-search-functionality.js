// 测试搜索功能的脚本
// 验证单模型搜索是否正常工作

const { createClient } = require('@supabase/supabase-js')
const OpenAI = require('openai')

// 配置（需要设置环境变量）
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error('❌ 请设置环境变量: SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiApiKey })

// 生成embedding
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    })
    return response.data[0].embedding
  } catch (error) {
    console.error('❌ 生成embedding失败:', error)
    return null
  }
}

// 测试搜索功能
async function testSearch() {
  console.log('🔍 开始测试搜索功能...')
  
  try {
    // 1. 检查用户认证
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('⚠️  用户未认证，使用匿名搜索')
    } else {
      console.log('✅ 用户已认证:', user.email)
    }

    // 2. 检查数据库中的简历数量
    const { data: resumeCount, error: countError } = await supabase
      .from('resumes')
      .select('id', { count: 'exact' })
      .eq('status', 'active')
    
    if (countError) {
      console.error('❌ 查询简历数量失败:', countError)
      return
    }
    
    console.log(`📊 数据库中有 ${resumeCount.length} 份活跃简历`)
    
    if (resumeCount.length === 0) {
      console.log('⚠️  数据库中没有简历数据，请先上传一些简历')
      return
    }

    // 3. 检查embedding数据
    const { data: embeddingCount, error: embeddingError } = await supabase
      .from('resumes')
      .select('id')
      .eq('status', 'active')
      .not('embedding', 'is', null)
    
    if (embeddingError) {
      console.error('❌ 查询embedding数据失败:', embeddingError)
      return
    }
    
    console.log(`📊 有 ${embeddingCount.length} 份简历包含embedding数据`)
    
    if (embeddingCount.length === 0) {
      console.log('⚠️  没有简历包含embedding数据，搜索功能无法工作')
      return
    }

    // 4. 测试搜索查询
    const testQueries = [
      '前端开发工程师',
      'React开发者',
      'JavaScript程序员',
      '高级工程师',
      '北京软件开发'
    ]

    for (const query of testQueries) {
      console.log(`\n🔍 测试搜索: "${query}"`)
      
      // 生成查询embedding
      const queryEmbedding = await generateEmbedding(query)
      if (!queryEmbedding) {
        console.log('❌ 生成查询embedding失败')
        continue
      }
      
      console.log(`✅ 查询embedding生成成功，维度: ${queryEmbedding.length}`)
      
      // 格式化embedding为字符串
      const embeddingStr = `[${queryEmbedding.join(',')}]`
      
      // 调用搜索RPC函数
      const { data: searchResults, error: searchError } = await supabase
        .rpc('search_candidates_rpc', {
          query_embedding: embeddingStr,
          similarity_threshold: 0.0,
          match_count: 10,
          location_filter: null,
          experience_min: null,
          experience_max: null,
          salary_min: null,
          salary_max: null,
          skills_filter: null,
          status_filter: 'active',
          user_id: user?.id || null
        })
      
      if (searchError) {
        console.error('❌ 搜索失败:', searchError)
        continue
      }
      
      console.log(`📊 搜索结果: ${searchResults?.length || 0} 条`)
      
      if (searchResults && searchResults.length > 0) {
        console.log('🎯 前3个结果:')
        searchResults.slice(0, 3).forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.name} - ${result.current_title} (相似度: ${result.similarity.toFixed(3)})`)
        })
      }
    }

    // 5. 测试直接数据库查询
    console.log('\n🔍 测试直接数据库查询...')
    const { data: directResults, error: directError } = await supabase
      .from('resumes')
      .select('id, name, current_title, embedding')
      .eq('status', 'active')
      .not('embedding', 'is', null)
      .limit(5)
    
    if (directError) {
      console.error('❌ 直接查询失败:', directError)
    } else {
      console.log(`📊 直接查询结果: ${directResults.length} 条`)
      directResults.forEach((result, index) => {
        const embeddingLength = result.embedding ? result.embedding.length : 0
        console.log(`  ${index + 1}. ${result.name} - ${result.current_title} (embedding维度: ${embeddingLength})`)
      })
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

// 主函数
async function main() {
  console.log('🚀 搜索功能测试开始')
  console.log('=====================================')
  
  await testSearch()
  
  console.log('\n=====================================')
  console.log('✅ 搜索功能测试完成')
}

// 运行测试
main().catch(console.error) 