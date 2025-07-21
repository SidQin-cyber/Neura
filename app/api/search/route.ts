import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embedding/openai-embedding'
import { normalizeTextWithCache } from '@/lib/embedding/text-normalizer'

// 混合搜索分数归一化接口
interface SearchCandidate {
  id: string
  name: string
  email: string
  phone: string
  current_title: string
  current_company: string
  location: string
  years_of_experience: number
  expected_salary_min?: number
  expected_salary_max?: number
  skills: string[]
  education: any
  experience: any
  certifications: any
  languages: any
  status: string
  similarity: number        // 向量相似度 [0, 1]
  fts_rank: number         // FTS相关性分数 [0, +∞]
  combined_score?: number  // 数据库原始组合分数（仅参考）
  // 🔥 增强版函数新增字段
  match_strategy?: string  // 匹配策略（PGroonga全文搜索、公司名匹配等）
  debug_info?: string      // 调试信息
}

interface NormalizedSearchResult extends SearchCandidate {
  normalized_vector_score: number     // 归一化后的向量分数 [0, 1]
  normalized_fts_score: number       // 归一化后的FTS分数 [0, 1]
  final_score: number                // 最终混合分数 [0, 1]
  match_score: number                // 前端期望的百分比 [0, 100]
}

// Min-Max 归一化函数
function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return []
  
  const min = Math.min(...values)
  const max = Math.max(...values)
  
  // 如果所有值相同，返回全1数组
  if (max === min) {
    return values.map(() => 1.0)
  }
  
  return values.map(value => (value - min) / (max - min))
}

// 混合搜索分数归一化与加权组合
function normalizeAndCombineScores(
  candidates: SearchCandidate[],
  alpha: number = 0.7  // 向量权重，推荐默认值0.7
): NormalizedSearchResult[] {
  if (candidates.length === 0) return []
  
  console.log(`🎯 开始分数归一化，候选人数量: ${candidates.length}, α权重: ${alpha}`)
  
  // Step 1: 提取原始分数
  const vectorScores = candidates.map(c => c.similarity)
  const ftsScores = candidates.map(c => c.fts_rank)
  
  console.log(`📊 原始分数范围:`)
  console.log(`  - 向量分数: [${Math.min(...vectorScores).toFixed(4)}, ${Math.max(...vectorScores).toFixed(4)}]`)
  console.log(`  - FTS分数: [${Math.min(...ftsScores).toFixed(4)}, ${Math.max(...ftsScores).toFixed(4)}]`)
  
  // Step 2: Min-Max 归一化
  const normalizedVectorScores = minMaxNormalize(vectorScores)
  const normalizedFtsScores = minMaxNormalize(ftsScores)
  
  console.log(`✨ 归一化后范围:`)
  console.log(`  - 归一化向量分数: [${Math.min(...normalizedVectorScores).toFixed(4)}, ${Math.max(...normalizedVectorScores).toFixed(4)}]`)
  console.log(`  - 归一化FTS分数: [${Math.min(...normalizedFtsScores).toFixed(4)}, ${Math.max(...normalizedFtsScores).toFixed(4)}]`)
  
  // Step 3: 加权组合计算最终分数
  const results: NormalizedSearchResult[] = candidates.map((candidate, index) => {
    const normalizedVectorScore = normalizedVectorScores[index]
    const normalizedFtsScore = normalizedFtsScores[index]
    
    // 最终公式: Final Score = (α × Normalized_Vector_Score) + ((1-α) × Normalized_FTS_Score)
    const finalScore = (alpha * normalizedVectorScore) + ((1 - alpha) * normalizedFtsScore)
    
    return {
      ...candidate,
      normalized_vector_score: normalizedVectorScore,
      normalized_fts_score: normalizedFtsScore,
      final_score: finalScore,
      match_score: Math.round(finalScore * 100), // 转换为百分比
      // 🔥 确保包含增强版函数的调试字段
      match_strategy: candidate.match_strategy || '未知策略',
      debug_info: candidate.debug_info || '无调试信息',
      full_text_content: `${candidate.name} ${candidate.current_title} ${candidate.current_company} ${candidate.location}`
    }
  })
  
  // 按最终分数降序排序
  results.sort((a, b) => b.final_score - a.final_score)
  
  console.log(`🏆 Top 3 最终分数:`)
  results.slice(0, 3).forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.name}: 最终分数=${result.final_score.toFixed(4)} (向量=${result.normalized_vector_score.toFixed(4)}, FTS=${result.normalized_fts_score.toFixed(4)})`)
  })
  
  return results
}

// 混合搜索主函数
async function hybridSearchCandidates(
  supabase: any,
  query: string,
  queryEmbedding: number[],
  userId: string,
  filters: any = {},
  alpha: number = 0.7,
  maxResults: number = 100
): Promise<NormalizedSearchResult[]> {
  console.log('🔄 执行混合搜索（数据库RPC + 后端归一化）...')
  
  const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`
  
  // 构建RPC调用参数
  const rpcParams = {
    query_embedding: queryEmbeddingStr,
    query_text: query,  // 用于FTS搜索
    similarity_threshold: 0.01,  // 低阈值确保充分召回
    match_count: Math.min(maxResults * 2, 200), // 召回更多候选人用于归一化
    location_filter: filters.location?.[0] || null,
    experience_min: filters.experience_min || null,
    experience_max: filters.experience_max || null,
    salary_min: filters.salary_min || null,
    salary_max: filters.salary_max || null,
    skills_filter: filters.skills || null,
    status_filter: 'active',
    user_id_param: userId,
    fts_weight: 0.5,    // 数据库内部权重（后续会被归一化覆盖）
    vector_weight: 0.5  // 数据库内部权重（后续会被归一化覆盖）
  }
  
  console.log('📞 调用数据库RPC函数: search_candidates_with_pgroonga_enhanced (启用增强版PGroonga中文搜索)')
  
  // 🔥 为增强版函数准备正确的参数
  const enhancedParams = {
    search_query: query,
    query_embedding: queryEmbeddingStr,
    similarity_threshold: rpcParams.similarity_threshold,
    match_count: rpcParams.match_count,
    user_id_param: userId
  }
  
  console.log('🎯 增强版函数参数:', enhancedParams)
  
  // 🔥 调用增强版搜索函数
  const { data: rawResults, error } = await supabase.rpc('search_candidates_with_pgroonga_enhanced', enhancedParams)
  
  if (error) {
    console.error('❌ 数据库混合搜索失败:', error)
    throw new Error(`数据库搜索失败: ${error.message}`)
  }
  
  if (!rawResults || rawResults.length === 0) {
    console.log('📭 数据库返回空结果')
    return []
  }
  
  console.log(`📊 数据库返回 ${rawResults.length} 个原始结果`)
  console.log('🔍 原始结果样本:', rawResults.slice(0, 2).map((r: any) => ({
    name: r.name,
    similarity: r.similarity,
    fts_rank: r.fts_rank,
    combined_score: r.combined_score
  })))
  
  // 执行分数归一化和加权组合
  const normalizedResults = normalizeAndCombineScores(rawResults, alpha)
  
  // 返回最终结果
  return normalizedResults.slice(0, maxResults)
}

// 混合搜索职位函数（类似实现）
async function hybridSearchJobs(
  supabase: any,
  query: string,
  queryEmbedding: number[],
  filters: any = {},
  alpha: number = 0.7,
  maxResults: number = 100
): Promise<any[]> {
  console.log('🔄 执行职位混合搜索...')
  
  const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`
  
  const rpcParams = {
    query_embedding: queryEmbeddingStr,
    query_text: query,
    similarity_threshold: 0.01,
    match_count: Math.min(maxResults * 2, 200),
    location_filter: filters.location?.[0] || null,
    experience_min: filters.experience_min || null,
    experience_max: filters.experience_max || null,
    salary_min_filter: filters.salary_min || null,
    salary_max_filter: filters.salary_max || null,
    skills_filter: filters.skills || null,
    status_filter: 'active',
    user_id_param: null, // 职位搜索不限制用户
    fts_weight: 0.5,
    vector_weight: 0.5
  }
  
  const { data: rawResults, error } = await supabase.rpc('search_jobs_with_pgroonga', rpcParams)
  
  if (error) {
    console.error('❌ 职位混合搜索失败:', error)
    throw new Error(`职位搜索失败: ${error.message}`)
  }
  
  if (!rawResults || rawResults.length === 0) {
    return []
  }
  
  // 对职位结果也进行归一化处理
  const vectorScores = rawResults.map((r: any) => r.similarity)
  const ftsScores = rawResults.map((r: any) => r.fts_rank)
  
  const normalizedVectorScores = minMaxNormalize(vectorScores)
  const normalizedFtsScores = minMaxNormalize(ftsScores)
  
  const results = rawResults.map((job: any, index: number) => {
    const normalizedVectorScore = normalizedVectorScores[index]
    const normalizedFtsScore = normalizedFtsScores[index]
    const finalScore = (alpha * normalizedVectorScore) + ((1 - alpha) * normalizedFtsScore)
    
    return {
      ...job,
      normalized_vector_score: normalizedVectorScore,
      normalized_fts_score: normalizedFtsScore,
      final_score: finalScore,
      match_score: Math.round(finalScore * 100),
      full_text_content: `${job.title} ${job.company} ${job.location} ${job.description || ''}`
    }
  })
  
     return results.sort((a: any, b: any) => b.final_score - a.final_score).slice(0, maxResults)
}

export async function POST(request: NextRequest) {
  try {
    const { query, mode, filters } = await request.json()
    
    if (!query || !mode) {
      return NextResponse.json(
        { success: false, error: 'Missing query or mode' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // 检查用户认证
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('🔍 搜索API认证检查:')
    console.log('- 认证错误:', authError)
    console.log('- 用户ID:', user?.id)
    console.log('- 用户邮箱:', user?.email)
    
    if (authError || !user) {
      console.error('❌ 用户未认证:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Support both candidates and jobs mode
    if (mode !== 'candidates' && mode !== 'jobs') {
      return NextResponse.json(
        { success: false, error: 'Only candidates and jobs modes are currently supported' },
        { status: 400 }
      )
    }

    // 🎯 使用固定的最优权重配置
    const vectorWeight = 0.65 // 固定值：65%向量权重 + 35%FTS权重

    console.log(`🎯 混合搜索配置: α=${vectorWeight} (${Math.round(vectorWeight*100)}%向量 + ${Math.round((1-vectorWeight)*100)}%FTS)`)

    // Set up streaming response
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    // 混合搜索处理流程
    const processHybridSearch = async () => {
      try {
        console.log('🚀 开始混合搜索流程（FTS + 向量 + 归一化）...')
        console.log('📝 原始查询:', query)
        
        // Step 1: 文本标准化 + 向量生成
        console.log('🎯 对查询进行标准化...')
        const normalizedQuery = await normalizeTextWithCache(query)
        console.log('✨ 标准化后文本:', normalizedQuery.substring(0, 100) + '...')
        
        const queryEmbedding = await generateEmbedding(normalizedQuery)
        if (!queryEmbedding) {
          await writer.write(encoder.encode(JSON.stringify({
            type: 'error',
            error: '无法生成查询向量'
          }) + '\n'))
          return
        }
        
        console.log('✅ 查询向量生成成功，维度:', queryEmbedding.length)

        // Step 2: 执行混合搜索（数据库RPC + 后端归一化）
        let results = []
        
        if (mode === 'candidates') {
          results = await hybridSearchCandidates(
            supabase,
            query, // 原始查询用于FTS
            queryEmbedding,
            user.id,
            filters,
            vectorWeight, // α权重
            100  // max results
          )
        } else {
          results = await hybridSearchJobs(
            supabase,
            query,
            queryEmbedding,
            filters,
            vectorWeight,
            100
          )
        }

        console.log(`✅ 混合搜索完成: ${results.length} 个最终结果`)
        
        // 输出搜索质量报告
        if (results.length > 0) {
          const avgFinalScore = results.reduce((sum, r) => sum + r.final_score, 0) / results.length
          const topScore = results[0]?.final_score || 0
          console.log(`📈 搜索质量报告:`)
          console.log(`  - 最高分数: ${topScore.toFixed(4)}`)
          console.log(`  - 平均分数: ${avgFinalScore.toFixed(4)}`)
          console.log(`  - 权重配置: ${Math.round(vectorWeight*100)}%向量 + ${Math.round((1-vectorWeight)*100)}%FTS`)
        }

        // Step 3: 流式返回结果
        await writer.write(encoder.encode(JSON.stringify({
          type: 'results',
          data: results,
          count: results.length,
          search_config: {
            mode: 'hybrid',
            vector_weight: vectorWeight,
            fts_weight: 1 - vectorWeight,
            normalization: 'min-max',
            alpha: vectorWeight
          }
        }) + '\n'))
        
        await writer.write(encoder.encode(JSON.stringify({
          type: 'complete',
          message: '混合搜索完成'
        }) + '\n'))

      } catch (error) {
        console.error('🚨 混合搜索失败:', error)
        await writer.write(encoder.encode(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : '搜索失败'
        }) + '\n'))
      } finally {
        writer.close()
      }
    }

    // Start the search pipeline
    processHybridSearch()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
      },
    })

  } catch (error) {
    console.error('🚨 搜索API错误:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '搜索请求失败' },
      { status: 500 }
    )
  }
} 