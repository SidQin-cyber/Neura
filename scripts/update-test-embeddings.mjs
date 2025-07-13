import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error('❌ 缺少必要的环境变量:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseKey)
  console.error('- OPENAI_API_KEY:', !!openaiApiKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiApiKey })

// 生成语义向量的函数
async function generateEmbedding(text) {
  try {
    console.log(`📝 生成向量: "${text}"`)
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(),
      encoding_format: 'float',
    })
    
    const embedding = response.data[0].embedding
    console.log(`✅ 向量生成成功，维度: ${embedding.length}`)
    return embedding
  } catch (error) {
    console.error(`❌ 向量生成失败:`, error)
    throw error
  }
}

// 更新候选人向量
async function updateCandidateEmbeddings() {
  try {
    console.log('🔍 获取现有候选人数据...')
    
    // 获取所有候选人数据 - 使用正确的表名
    const { data: candidates, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('owner_id', '6025a859-1b92-43dc-942f-f9a75c0333e0')
    
    if (error) {
      console.error('❌ 获取候选人数据失败:', error)
      return
    }
    
    console.log(`📊 找到 ${candidates.length} 个候选人`)
    
    for (const candidate of candidates) {
      console.log(`\n🔄 处理候选人: ${candidate.name}`)
      
      // 构建语义描述文本
      const semanticText = [
        candidate.name,
        candidate.current_title,
        candidate.current_company,
        candidate.location,
        candidate.skills ? candidate.skills.join(', ') : '',
        candidate.years_of_experience ? `${candidate.years_of_experience}年经验` : '',
        candidate.education ? JSON.stringify(candidate.education) : '',
        candidate.experience ? JSON.stringify(candidate.experience) : ''
      ].filter(Boolean).join(' ')
      
      console.log(`📝 语义文本: "${semanticText}"`)
      
      // 生成真实的语义向量
      const embedding = await generateEmbedding(semanticText)
      
      // 更新数据库中的向量
      const { error: updateError } = await supabase
        .from('resumes')
        .update({ 
          embedding: embedding,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidate.id)
      
      if (updateError) {
        console.error(`❌ 更新候选人 ${candidate.name} 的向量失败:`, updateError)
      } else {
        console.log(`✅ 候选人 ${candidate.name} 的向量更新成功`)
      }
      
      // 添加延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log('\n🎉 所有候选人向量更新完成!')
    
  } catch (error) {
    console.error('❌ 更新过程中发生错误:', error)
  }
}

// 验证更新结果
async function verifyUpdates() {
  try {
    console.log('\n🔍 验证向量更新结果...')
    
    // 测试搜索"深圳的全栈"
    const testQuery = '深圳的全栈'
    console.log(`🔍 测试搜索: "${testQuery}"`)
    
    const queryEmbedding = await generateEmbedding(testQuery)
    
    // 将向量转换为文本格式（匹配函数签名）
    const embeddingText = `[${queryEmbedding.join(',')}]`
    
    const { data: results, error } = await supabase
      .rpc('search_candidates_rpc', {
        query_embedding: embeddingText,
        query_text: testQuery,
        similarity_threshold: 0.1,
        match_count: 10,
        location_filter: null,
        experience_min: null,
        experience_max: null,
        salary_min: null,
        salary_max: null,
        skills_filter: [],
        status_filter: 'active',
        // 移除用户ID参数：user_id_param: '6025a859-1b92-43dc-942f-f9a75c0333e0',
        fts_weight: 0.4,
        vector_weight: 0.6
      })
    
    if (error) {
      console.error('❌ 搜索测试失败:', error)
      return
    }
    
    console.log(`\n📊 搜索结果 (${results.length} 条):`)
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name} - ${result.current_title}`)
      console.log(`   相似度: ${result.similarity?.toFixed(4) || 'N/A'}`)
      console.log(`   FTS分数: ${result.fts_rank?.toFixed(4) || 'N/A'}`)
      console.log(`   综合分数: ${result.combined_score?.toFixed(4) || 'N/A'}`)
      console.log(`   地点: ${result.location}`)
      console.log(`   技能: ${result.skills ? result.skills.join(', ') : '无'}`)
      console.log('')
    })
    
    if (results.length > 0) {
      console.log('✅ 向量更新成功！搜索功能正常工作。')
    } else {
      console.log('⚠️ 没有找到匹配结果，可能需要调整相似度阈值。')
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error)
  }
}

// 主函数
async function main() {
  console.log('🚀 开始更新测试数据的语义向量...\n')
  
  await updateCandidateEmbeddings()
  await verifyUpdates()
  
  console.log('\n✅ 脚本执行完成!')
}

main().catch(console.error) 