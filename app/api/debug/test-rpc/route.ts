import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 开始RPC函数测试...')
    
    const supabase = await createClient()
    
    // 检查用户认证
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 创建一个简单的向量（全0向量）
    const simpleVector = new Array(1536).fill(0)
    const simpleVectorStr = `[${simpleVector.join(',')}]`

    console.log('📊 测试参数:')
    console.log('- 用户ID:', user.id)
    console.log('- 向量维度:', simpleVector.length)

    // 测试1: 最宽松的搜索参数
    const searchParams = {
      query_embedding: simpleVectorStr,
      query_text: '',
      similarity_threshold: 0.0, // 最低阈值
      match_count: 100,
      location_filter: [],
      experience_min: null,
      experience_max: null,
      salary_min: null,
      salary_max: null,
      skills_filter: [],
      status_filter: 'active',
      user_id_param: user.id,
      fts_weight: 0.0, // 完全关闭FTS
      vector_weight: 1.0  // 只用向量
    }

    console.log('🎯 RPC调用参数:', searchParams)

    // 执行RPC调用
    const { data, error } = await supabase.rpc('search_candidates_with_pgroonga', searchParams)
    
    console.log('📊 RPC结果:')
    console.log('- 错误:', error)
    console.log('- 数据类型:', typeof data)
    console.log('- 数据长度:', data?.length)
    console.log('- 前3个结果:', data?.slice(0, 3))

    // 测试2: 直接查询表（不通过RPC）
    const { data: directData, error: directError } = await supabase
      .from('resumes')
      .select('id, name, current_company, current_title')
      .eq('status', 'active')
      .eq('owner_id', user.id)
      .limit(5)

    console.log('📊 直接查询结果:')
    console.log('- 错误:', directError)
    console.log('- 数据长度:', directData?.length)
    console.log('- 数据:', directData)

    return NextResponse.json({
      success: true,
      tests: {
        rpc_test: {
          success: !error,
          error: error?.message || null,
          resultCount: data?.length || 0,
          results: data?.slice(0, 3) || []
        },
        direct_query_test: {
          success: !directError,
          error: directError?.message || null,
          resultCount: directData?.length || 0,
          results: directData || []
        }
      },
      debugInfo: {
        userId: user.id,
        userEmail: user.email
      }
    })

  } catch (error) {
    console.error('🚨 RPC测试失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '测试失败' 
      },
      { status: 500 }
    )
  }
} 