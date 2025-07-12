import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 调试数据库状态，用户ID:', user.id)

    // 1. 检查候选人数据
    const { data: candidates, error: candidatesError } = await supabase
      .from('resumes')
      .select('id, name, location, current_title, owner_id')
      .eq('owner_id', user.id)

    console.log('候选人数据查询结果:', {
      error: candidatesError,
      count: candidates?.length || 0,
      data: candidates?.map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        title: c.current_title
      })) || []
    })

    // 2. 检查职位数据
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, company, location, owner_id')
      .eq('owner_id', user.id)

    console.log('职位数据查询结果:', {
      error: jobsError,
      count: jobs?.length || 0,
      data: jobs?.map(j => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location
      })) || []
    })

    // 3. 测试RPC函数 - 使用简单的测试向量
    const testEmbedding = `[${new Array(1536).fill(0.1).join(',')}]`
    
    console.log('🧪 测试RPC函数，embedding长度:', testEmbedding.length)

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
      user_id: user.id
    })

    console.log('RPC函数测试结果:', {
      error: rpcError ? {
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code
      } : null,
      count: rpcResult?.length || 0,
      data: rpcResult?.map((r: any) => ({
        name: r.name,
        location: r.location,
        similarity: r.similarity
      })) || []
    })

    // 4. 检查embedding数据类型
    if (candidates && candidates.length > 0) {
      const { data: embeddingCheck, error: embeddingError } = await supabase
        .from('resumes')
        .select('id, name, embedding')
        .eq('owner_id', user.id)
        .limit(1)
        .single()

      if (embeddingCheck) {
        console.log('Embedding数据检查:', {
          name: embeddingCheck.name,
          has_embedding: !!embeddingCheck.embedding,
          embedding_type: typeof embeddingCheck.embedding,
          embedding_length: embeddingCheck.embedding ? embeddingCheck.embedding.length : 0
        })
      }
    }

    return NextResponse.json({
      success: true,
      user_id: user.id,
      candidates: {
        count: candidates?.length || 0,
        error: candidatesError?.message || null,
        data: candidates?.map(c => ({
          id: c.id,
          name: c.name,
          location: c.location,
          title: c.current_title
        })) || []
      },
      jobs: {
        count: jobs?.length || 0,
        error: jobsError?.message || null,
        data: jobs?.map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location
        })) || []
      },
      rpc_test: {
        error: rpcError ? {
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code
        } : null,
        count: rpcResult?.length || 0,
        results: rpcResult?.map((r: any) => ({
          name: r.name,
          location: r.location,
          similarity: r.similarity
        })) || []
      }
    })

  } catch (error) {
    console.error('调试API错误:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : '调试失败'
    }, { status: 500 })
  }
} 