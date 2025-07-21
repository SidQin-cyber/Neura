import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embedding/openai-embedding'
import { createCandidateEmbeddingText } from '@/lib/embedding/openai-embedding'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 开始硬编码搜索测试...')
    
    const supabase = await createClient()
    
    // 检查用户认证
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 先获取贝文瑾的完整数据来构建真实的embedding文本
    const { data: beiwenjin, error: dataError } = await supabase
      .from('resumes')
      .select('*')
      .eq('name', '贝文瑾')
      .single()

    let realEmbeddingText = ''
    if (!dataError && beiwenjin) {
      realEmbeddingText = createCandidateEmbeddingText(beiwenjin)
      console.log('🎯 贝文瑾真实embedding文本预览:', realEmbeddingText.substring(0, 200) + '...')
      console.log('📏 完整文本长度:', realEmbeddingText.length)
    }

    // 硬编码测试查询 - 从简单到复杂，包括真实embedding文本
    const testQueries = [
      // 测试1: 真实embedding文本的前半部分
      realEmbeddingText ? realEmbeddingText.substring(0, 100) : '',
      // 测试2: 候选人自己的summary (最可能匹配)
      "具备人形轮式机器人整机及核心部组件的全流程运动学与动力学仿真经验，曾主导多个机器人仿真平台建设与算法开发项目",
      // 测试3: 简化版
      "机器人仿真平台建设算法开发",
      // 测试4: 公司部门
      "小米通讯技术有限公司机器人事业部",
      // 测试5: 职位相关
      "机器人运动学动力学仿真工程师",
      // 测试6: 技能组合
      "ROS Python C++ 机器人仿真",
      // 测试7: 最简化
      "机器人",
      // 测试8: 姓名
      "贝文瑾"
    ].filter(Boolean) // 过滤掉空字符串

    const results = []

    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i]
      console.log(`🔍 测试${i + 1}: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`)
      
      try {
        // 生成向量
        const queryEmbedding = await generateEmbedding(query)
        if (!queryEmbedding) {
          console.log(`❌ 测试${i + 1}: 向量生成失败`)
          continue
        }

        const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`
        
        // 搜索参数 - 进一步降低阈值
        const searchParams = {
          query_embedding: queryEmbeddingStr,
          query_text: query,
          similarity_threshold: 0.01, // 极低阈值
          match_count: 20,
          location_filter: [],
          experience_min: null,
          experience_max: null,
          salary_min: null,
          salary_max: null,
          skills_filter: [],
          status_filter: 'active',
          user_id_param: user.id,
          fts_weight: 0.1, // 降低FTS权重
          vector_weight: 0.9  // 提高向量权重
        }

        console.log(`🎯 测试${i + 1} 搜索参数:`, {
          query_length: query.length,
          similarity_threshold: searchParams.similarity_threshold,
          fts_weight: searchParams.fts_weight,
          vector_weight: searchParams.vector_weight
        })

        // 执行搜索
        const { data, error } = await supabase.rpc('search_candidates_with_pgroonga', searchParams)
        
        if (error) {
          console.log(`❌ 测试${i + 1} 搜索错误:`, error)
          results.push({
            query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
            success: false,
            error: error.message,
            count: 0
          })
        } else {
          console.log(`✅ 测试${i + 1} 搜索成功: ${data?.length || 0} 个结果`)
          if (data && data.length > 0) {
            console.log(`📋 前3个结果:`, data.slice(0, 3).map((item: any) => ({
              name: item.name,
              company: item.current_company,
              similarity: item.similarity
            })))
          }
          
          results.push({
            query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
            success: true,
            count: data?.length || 0,
            results: data?.map((item: any) => ({
              id: item.id,
              name: item.name,
              current_company: item.current_company,
              current_title: item.current_title,
              similarity: item.similarity,
              location: item.location
            })) || []
          })
        }
      } catch (error) {
        console.log(`❌ 测试${i + 1} 异常:`, error)
        results.push({
          query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
          success: false,
          error: error instanceof Error ? error.message : String(error),
          count: 0
        })
      }
    }

    return NextResponse.json({
      success: true,
      testResults: results,
      summary: {
        totalTests: testQueries.length,
        successfulTests: results.filter(r => r.success).length,
        totalCandidatesFound: results.reduce((sum, r) => sum + r.count, 0),
        foundBeiwenjin: results.some(r => r.results?.some((candidate: any) => candidate.name === '贝文瑾'))
      },
      debugInfo: {
        realEmbeddingTextLength: realEmbeddingText.length,
        realEmbeddingTextPreview: realEmbeddingText.substring(0, 300) + '...'
      }
    })

  } catch (error) {
    console.error('🚨 硬编码搜索测试失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '测试失败' 
      },
      { status: 500 }
    )
  }
} 