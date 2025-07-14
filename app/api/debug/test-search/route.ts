import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    console.log('🔍 调试搜索API - 开始检查数据库')

    // 1. 检查候选人数据（不过滤用户ID）
    console.log('🔍 检查候选人数据（全部）:')
    const { data: allCandidates, error: allCandidatesError } = await supabase
      .from('resumes')
      .select('id, name, location, current_title, owner_id, status')
      .limit(10)

    console.log('- 全部候选人数据:', {
      error: allCandidatesError,
      count: allCandidates?.length || 0,
      data: allCandidates?.map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        title: c.current_title,
        owner_id: c.owner_id,
        status: c.status
      })) || []
    })

    // 2. 检查活跃的候选人数据
    console.log('🔍 检查活跃候选人数据:')
    const { data: activeCandidates, error: activeCandidatesError } = await supabase
      .from('resumes')
      .select('id, name, location, current_title, owner_id, status')
      .eq('status', 'active')
      .limit(10)

    console.log('- 活跃候选人数据:', {
      error: activeCandidatesError,
      count: activeCandidates?.length || 0,
      data: activeCandidates?.map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        title: c.current_title,
        owner_id: c.owner_id,
        status: c.status
      })) || []
    })

    // 3. 检查embedding字段
    console.log('🔍 检查embedding字段:')
    const { data: embeddingData, error: embeddingError } = await supabase
      .from('resumes')
      .select('id, name, embedding')
      .eq('status', 'active')
      .limit(3)

    console.log('- Embedding数据:', {
      error: embeddingError,
      count: embeddingData?.length || 0,
      data: embeddingData?.map(c => ({
        id: c.id,
        name: c.name,
        has_embedding: !!c.embedding,
        embedding_type: typeof c.embedding,
        embedding_length: c.embedding ? c.embedding.length : 0
      })) || []
    })

    return NextResponse.json({
      success: true,
      message: '调试完成',
      all_candidates: {
        count: allCandidates?.length || 0,
        error: allCandidatesError?.message || null,
        data: allCandidates?.map(c => ({
          id: c.id,
          name: c.name,
          location: c.location,
          title: c.current_title,
          owner_id: c.owner_id,
          status: c.status
        })) || []
      },
      active_candidates: {
        count: activeCandidates?.length || 0,
        error: activeCandidatesError?.message || null,
        data: activeCandidates?.map(c => ({
          id: c.id,
          name: c.name,
          location: c.location,
          title: c.current_title,
          owner_id: c.owner_id,
          status: c.status
        })) || []
      },
      embedding_check: {
        error: embeddingError?.message || null,
        count: embeddingData?.length || 0,
        data: embeddingData?.map(c => ({
          id: c.id,
          name: c.name,
          has_embedding: !!c.embedding,
          embedding_type: typeof c.embedding,
          embedding_length: c.embedding ? c.embedding.length : 0
        })) || []
      }
    })

  } catch (error) {
    console.error('调试搜索API错误:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : '调试失败'
    }, { status: 500 })
  }
} 