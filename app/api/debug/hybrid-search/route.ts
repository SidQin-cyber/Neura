import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embedding/openai-embedding'
import { normalizeTextWithCache } from '@/lib/embedding/text-normalizer'

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now()
    console.log('🐛 [DEBUG] 混合搜索调试开始...')
    
    const { query, mode, filters, alpha } = await request.json()
    
    console.log('🐛 [DEBUG] 请求参数:', {
      query: query?.substring(0, 50) + (query?.length > 50 ? '...' : ''),
      mode,
      alpha,
      filters: JSON.stringify(filters)
    })
    
    if (!query || !mode) {
      return NextResponse.json({
        success: false,
        error: 'Missing query or mode',
        debug: { step: 'parameter_validation', query, mode }
      }, { status: 400 })
    }

    const supabase = await createClient()
    console.log('🐛 [DEBUG] Supabase客户端创建成功')
    
    // 检查用户认证
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('🐛 [DEBUG] 认证检查:', {
      authError: authError?.message,
      userId: user?.id,
      userEmail: user?.email
    })
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        debug: { 
          step: 'authentication',
          authError: authError?.message,
          hasUser: !!user
        }
      }, { status: 401 })
    }

    // 权重参数验证
    const vectorWeight = alpha !== undefined ? Number(alpha) : 0.7
    if (vectorWeight < 0 || vectorWeight > 1) {
      return NextResponse.json({
        success: false,
        error: 'Alpha weight must be between 0 and 1',
        debug: { step: 'weight_validation', alpha, vectorWeight }
      }, { status: 400 })
    }

    console.log('🐛 [DEBUG] 权重配置:', {
      alpha,
      vectorWeight,
      ftsWeight: 1 - vectorWeight
    })

    try {
      // Step 1: 文本标准化
      console.log('🐛 [DEBUG] Step 1: 开始文本标准化...')
      const normalizedQuery = await normalizeTextWithCache(query)
      console.log('🐛 [DEBUG] 标准化结果:', {
        original: query,
        normalized: normalizedQuery?.substring(0, 100) + (normalizedQuery?.length > 100 ? '...' : '')
      })
      
      // Step 2: 向量生成
      console.log('🐛 [DEBUG] Step 2: 开始向量生成...')
      const queryEmbedding = await generateEmbedding(normalizedQuery)
      
      if (!queryEmbedding) {
        return NextResponse.json({
          success: false,
          error: '向量生成失败',
          debug: { 
            step: 'embedding_generation',
            query: normalizedQuery?.substring(0, 50)
          }
        }, { status: 500 })
      }
      
      console.log('🐛 [DEBUG] 向量生成成功:', {
        dimension: queryEmbedding.length,
        sampleValues: queryEmbedding.slice(0, 3)
      })

      // Step 3: 检查候选人数据
      console.log('🐛 [DEBUG] Step 3: 检查用户候选人数据...')
      const { data: candidateCount, error: countError } = await supabase
        .from('resumes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('owner_id', user.id)

      console.log('🐛 [DEBUG] 候选人数据检查:', {
        count: candidateCount,
        countError: countError?.message,
        userId: user.id
      })

      // Step 4: 检查RPC函数是否存在
      console.log('🐛 [DEBUG] Step 4: 检查RPC函数...')
      
      // 先尝试简单的RPC调用测试
      const { data: rpcTest, error: rpcTestError } = await supabase.rpc('search_candidates_rpc_v2', {
        query_embedding: `[${new Array(1536).fill(0.1).join(',')}]`,
        query_text: 'test',
        similarity_threshold: 0.01,
        match_count: 1,
        location_filter: null,
        experience_min: null,
        experience_max: null,
        salary_min: null,
        salary_max: null,
        skills_filter: null,
        status_filter: 'active',
        user_id_param: user.id,
        fts_weight: 0.5,
        vector_weight: 0.5
      })

      console.log('🐛 [DEBUG] RPC函数测试:', {
        testResult: rpcTest?.length || 0,
        rpcError: rpcTestError?.message,
        rpcDetails: rpcTestError?.details,
        rpcHint: rpcTestError?.hint
      })

      if (rpcTestError) {
        return NextResponse.json({
          success: false,
          error: `RPC函数调用失败: ${rpcTestError.message}`,
          debug: {
            step: 'rpc_function_test',
            rpcError: rpcTestError.message,
            rpcDetails: rpcTestError.details,
            rpcHint: rpcTestError.hint,
            functionName: 'search_candidates_rpc'
          }
        }, { status: 500 })
      }

      // Step 5: 执行真实搜索
      console.log('🐛 [DEBUG] Step 5: 执行真实混合搜索...')
      
      const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`
      const rpcParams = {
        query_embedding: queryEmbeddingStr,
        query_text: query,
        similarity_threshold: 0.01,
        match_count: 50,
        location_filter: filters?.location?.[0] || null,
        experience_min: filters?.experience_min || null,
        experience_max: filters?.experience_max || null,
        salary_min: filters?.salary_min || null,
        salary_max: filters?.salary_max || null,
        skills_filter: filters?.skills || null,
        status_filter: 'active',
        user_id_param: user.id,
        fts_weight: 1 - vectorWeight,
        vector_weight: vectorWeight
      }

      console.log('🐛 [DEBUG] RPC调用参数:', {
        query_text: rpcParams.query_text,
        similarity_threshold: rpcParams.similarity_threshold,
        match_count: rpcParams.match_count,
        user_id: rpcParams.user_id_param,
        vector_weight: rpcParams.vector_weight,
        fts_weight: rpcParams.fts_weight
      })

      const { data: searchResults, error: searchError } = await supabase.rpc('search_candidates_rpc', rpcParams)

      console.log('🐛 [DEBUG] 搜索结果:', {
        resultCount: searchResults?.length || 0,
        searchError: searchError?.message,
        searchDetails: searchError?.details,
        sampleResult: searchResults?.[0] ? {
          name: searchResults[0].name,
          company: searchResults[0].current_company,
          similarity: searchResults[0].similarity,
          fts_rank: searchResults[0].fts_rank
        } : null
      })

      if (searchError) {
        return NextResponse.json({
          success: false,
          error: `搜索执行失败: ${searchError.message}`,
          debug: {
            step: 'search_execution',
            searchError: searchError.message,
            searchDetails: searchError.details,
            rpcParams: {
              query_text: rpcParams.query_text,
              user_id: rpcParams.user_id_param,
              match_count: rpcParams.match_count
            }
          }
        }, { status: 500 })
      }

      // Step 6: 分析结果
      const results = searchResults || []
      const endTime = Date.now()
      
      console.log('🐛 [DEBUG] 最终结果分析:', {
        totalResults: results.length,
        executionTime: endTime - startTime,
        hasVectorScores: results.length > 0 && typeof results[0].similarity === 'number',
        hasFtsScores: results.length > 0 && typeof results[0].fts_rank === 'number',
                 scoreRanges: results.length > 0 ? {
           vectorMin: Math.min(...results.map((r: any) => r.similarity || 0)),
           vectorMax: Math.max(...results.map((r: any) => r.similarity || 0)),
           ftsMin: Math.min(...results.map((r: any) => r.fts_rank || 0)),
           ftsMax: Math.max(...results.map((r: any) => r.fts_rank || 0))
         } : null
      })

      return NextResponse.json({
        success: true,
        results: results.slice(0, 10), // 返回前10个结果
        debug: {
          step: 'success',
          totalResults: results.length,
          executionTime: endTime - startTime,
          searchConfig: {
            mode: 'hybrid',
            vector_weight: vectorWeight,
            fts_weight: 1 - vectorWeight,
            normalization: 'min-max'
          },
          rpcParams: {
            query_text: rpcParams.query_text,
            similarity_threshold: rpcParams.similarity_threshold,
            match_count: rpcParams.match_count
          }
        }
      })

    } catch (processingError) {
      console.error('🐛 [DEBUG] 处理错误:', processingError)
      return NextResponse.json({
        success: false,
        error: `处理错误: ${processingError instanceof Error ? processingError.message : String(processingError)}`,
        debug: {
          step: 'processing_error',
          errorType: processingError instanceof Error ? processingError.constructor.name : typeof processingError,
          errorMessage: processingError instanceof Error ? processingError.message : String(processingError),
          stack: processingError instanceof Error ? processingError.stack : undefined
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('🐛 [DEBUG] 全局错误:', error)
    return NextResponse.json({
      success: false,
      error: `全局错误: ${error instanceof Error ? error.message : String(error)}`,
      debug: {
        step: 'global_error',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }, { status: 500 })
  }
} 