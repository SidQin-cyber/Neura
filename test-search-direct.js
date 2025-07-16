import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

console.log('🔧 环境变量检查:')
console.log('- SUPABASE_URL:', !!supabaseUrl)
console.log('- SUPABASE_KEY:', !!supabaseKey) 
console.log('- OPENAI_API_KEY:', !!openaiApiKey)

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiApiKey })

// 生成向量的函数
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text.trim(),
      dimensions: 1536,
    })
    
    const embedding = response.data[0].embedding
    return embedding
  } catch (error) {
    console.error('向量生成失败:', error)
    throw error
  }
}

async function testSearch() {
  try {
    console.log('\n🔍 开始测试搜索功能...')
    
    // 1. 检查数据库中的候选人
    console.log('\n📊 检查数据库中的候选人...')
    const { data: candidates, error: candidatesError } = await supabase
      .from('resumes')
      .select('id, name, current_title, location, owner_id, embedding')
      .eq('owner_id', '6025a859-1b92-43dc-942f-f9a75c0333e0')
    
    if (candidatesError) {
      console.error('❌ 查询候选人失败:', candidatesError)
      return
    }
    
    console.log(`✅ 找到 ${candidates.length} 个候选人:`)
    candidates.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.name} - ${candidate.current_title} (${candidate.location})`)
      console.log(`   ID: ${candidate.id}`)
      console.log(`   有向量: ${candidate.embedding ? '是' : '否'}`)
      if (candidate.embedding) {
        console.log(`   向量维度: ${candidate.embedding.length}`)
      }
    })
    
    // 2. 生成查询向量
    console.log('\n🔧 生成查询向量...')
    const query = '深圳的全栈'
    const queryEmbedding = await generateEmbedding(query)
    
    if (!queryEmbedding) {
      console.error('❌ 生成查询向量失败')
      return
    }
    
    console.log(`✅ 查询向量生成成功: "${query}"`)
    console.log(`   向量维度: ${queryEmbedding.length}`)
    
    // 3. 调用搜索RPC函数
    console.log('\n🔍 调用搜索RPC函数...')
    const embeddingText = `[${queryEmbedding.join(',')}]`
    
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_candidates_rpc', {
        query_embedding: embeddingText,
        query_text: query,
        similarity_threshold: 0.1,
        match_count: 10,
        location_filter: null,
        experience_min: null,
        experience_max: null,
        salary_min: null,
        salary_max: null,
        skills_filter: [],
        status_filter: 'active',
        user_id_param: '6025a859-1b92-43dc-942f-f9a75c0333e0',
        fts_weight: 0.4,
        vector_weight: 0.6
      })
    
    if (searchError) {
      console.error('❌ 搜索RPC调用失败:', searchError)
      return
    }
    
    console.log(`✅ 搜索成功，找到 ${searchResults.length} 个结果:`)
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name} - ${result.current_title}`)
      console.log(`   相似度: ${result.similarity?.toFixed(4) || 'N/A'}`)
      console.log(`   FTS分数: ${result.fts_rank?.toFixed(4) || 'N/A'}`)
      console.log(`   综合分数: ${result.combined_score?.toFixed(4) || 'N/A'}`)
      console.log(`   地点: ${result.location}`)
      console.log(`   技能: ${result.skills ? result.skills.join(', ') : '无'}`)
      console.log('')
    })
    
    // 4. 测试不同的查询
    console.log('\n🔍 测试其他查询...')
    const testQueries = ['张三', 'JavaScript', '前端', 'Python', '北京']
    
    for (const testQuery of testQueries) {
      console.log(`\n测试查询: "${testQuery}"`)
      const testEmbedding = await generateEmbedding(testQuery)
      const testEmbeddingText = `[${testEmbedding.join(',')}]`
      
      const { data: testResults, error: testError } = await supabase
        .rpc('search_candidates_rpc', {
          query_embedding: testEmbeddingText,
          query_text: testQuery,
          similarity_threshold: 0.1,
          match_count: 3,
          location_filter: null,
          experience_min: null,
          experience_max: null,
          salary_min: null,
          salary_max: null,
          skills_filter: [],
          status_filter: 'active',
          user_id_param: '6025a859-1b92-43dc-942f-f9a75c0333e0',
          fts_weight: 0.4,
          vector_weight: 0.6
        })
      
      if (testError) {
        console.error(`❌ 查询 "${testQuery}" 失败:`, testError)
        continue
      }
      
      console.log(`找到 ${testResults.length} 个结果:`)
      testResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.name} - 相似度: ${result.similarity?.toFixed(4) || 'N/A'}`)
      })
    }
    
    console.log('\n✅ 搜索测试完成!')
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

testSearch() 