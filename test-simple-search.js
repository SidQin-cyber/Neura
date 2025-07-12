const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // 使用anon key

console.log('🔍 测试数据库连接...')
console.log('Supabase URL:', supabaseUrl)
console.log('Anon Key存在:', !!supabaseKey)

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDatabase() {
  try {
    // 1. 检查候选人数据
    console.log('\n📋 检查候选人数据...')
    const { data: candidates, error: candidatesError } = await supabase
      .from('resumes')
      .select('id, name, location, current_title, owner_id')
      .limit(10)

    if (candidatesError) {
      console.error('❌ 候选人数据查询错误:', candidatesError)
    } else {
      console.log('✅ 候选人数据:', {
        count: candidates?.length || 0,
        data: candidates?.map(c => ({
          id: c.id,
          name: c.name,
          location: c.location,
          title: c.current_title,
          owner_id: c.owner_id
        })) || []
      })
    }

    // 2. 检查职位数据
    console.log('\n💼 检查职位数据...')
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, company, location, owner_id')
      .limit(10)

    if (jobsError) {
      console.error('❌ 职位数据查询错误:', jobsError)
    } else {
      console.log('✅ 职位数据:', {
        count: jobs?.length || 0,
        data: jobs?.map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          owner_id: j.owner_id
        })) || []
      })
    }

    // 3. 检查embedding数据
    if (candidates && candidates.length > 0) {
      console.log('\n🔍 检查embedding数据...')
      const { data: embeddingData, error: embeddingError } = await supabase
        .from('resumes')
        .select('id, name, embedding')
        .limit(1)
        .single()

      if (embeddingError) {
        console.error('❌ Embedding数据查询错误:', embeddingError)
      } else {
        console.log('✅ Embedding数据检查:', {
          name: embeddingData.name,
          has_embedding: !!embeddingData.embedding,
          embedding_type: typeof embeddingData.embedding,
          embedding_length: embeddingData.embedding ? embeddingData.embedding.length : 0,
          embedding_sample: embeddingData.embedding ? embeddingData.embedding.substring(0, 100) + '...' : null
        })
      }
    }

    // 4. 测试RPC函数
    console.log('\n🧪 测试RPC函数...')
    const testEmbedding = `[${new Array(1536).fill(0.1).join(',')}]`
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_candidates_rpc', {
      query_embedding: testEmbedding,
      similarity_threshold: 0.0,
      match_count: 10,
      location_filter: null,
      experience_min: null,
      experience_max: null,
      salary_min: null,
      salary_max: null,
      skills_filter: null,
      status_filter: 'active',
      user_id: null // 不限制用户
    })

    if (rpcError) {
      console.error('❌ RPC函数测试错误:', {
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code
      })
    } else {
      console.log('✅ RPC函数测试结果:', {
        count: rpcResult?.length || 0,
        data: rpcResult?.map(r => ({
          name: r.name,
          location: r.location,
          similarity: r.similarity
        })) || []
      })
    }

    // 5. 检查RPC函数是否存在
    console.log('\n🔧 检查RPC函数是否存在...')
    const { data: functions, error: functionsError } = await supabase
      .from('pg_proc')
      .select('proname')
      .ilike('proname', '%search_candidates_rpc%')

    if (functionsError) {
      console.error('❌ 函数检查错误:', functionsError)
    } else {
      console.log('✅ 搜索函数存在:', functions?.length > 0)
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

testDatabase() 