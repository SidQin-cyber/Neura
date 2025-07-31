import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embedding/openai-embedding'


// 增强搜索结果接口 - 对应新的数据库函数返回
interface EnhancedSearchCandidate {
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
  // 增强算法评分细节
  similarity: number           // 原始向量相似度
  fts_rank: number            // 原始FTS分数
  exact_matches: number       // 精确关键词匹配数
  dynamic_alpha: number       // 动态计算的权重
  raw_combined_score: number  // 原始组合分数
  boosted_score: number       // 关键词提升后分数
  final_score: number         // 最终排序分数
  // 新增 Rerank 相关字段
  llm_score?: number          // LLM 重排分数
}

interface EnhancedSearchJob {
  id: string
  title: string
  company: string
  location: string
  employment_type: string
  salary_min?: number
  salary_max?: number
  currency: string
  description: string
  requirements: string
  benefits: string
  skills_required: string[]
  experience_required: number
  education_required: string
  industry: string
  department: string
  status: string
  // 🔧 确保Job搜索返回完整的评分细节（与人选一致）
  similarity: number           // 原始向量相似度
  fts_rank: number            // 原始FTS分数
  exact_matches: number       // 精确关键词匹配数
  dynamic_alpha: number       // 动态计算的权重
  raw_combined_score: number  // 原始组合分数
  boosted_score: number       // 关键词提升后分数
  final_score: number         // 最终排序分数
  // 新增 Rerank 相关字段
  llm_score?: number          // LLM 重排分数
}

// 增强搜索主函数 - 候选人
async function enhancedSearchCandidates(
  supabase: any,
  query: string,
  queryEmbedding: number[],
  filters: any = {},
  maxResults: number = 100
): Promise<EnhancedSearchCandidate[]> {
  const phoneRegex = /^\d{11}$/
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // 检查是否为电话或邮箱精确查询
  if (phoneRegex.test(query) || emailRegex.test(query)) {
    console.log(`📞 执行电话/邮箱精确匹配: ${query}`)
    let queryBuilder = supabase.from('resumes').select('*')

    if (phoneRegex.test(query)) {
      // 🔧 修复电话号码搜索：支持不同格式的电话号码匹配
      // 清理用户输入：去除所有非数字字符
      const cleanPhone = query.replace(/[^0-9]/g, '')
      console.log(`📱 清理后的电话号码: ${cleanPhone}`)
      
      // 生成常见的中国手机号格式变体
      const phoneVariants = [
        query,                              // 原始输入 (18100171265)
        cleanPhone,                         // 纯数字 (18100171265)  
        `${cleanPhone.slice(0,3)}-${cleanPhone.slice(3,7)}-${cleanPhone.slice(7)}`, // 3-4-4格式 (181-0017-1265)
        `${cleanPhone.slice(0,3)} ${cleanPhone.slice(3,7)} ${cleanPhone.slice(7)}`, // 空格分隔 (181 0017 1265)
      ]
      
      console.log(`📱 生成的电话号码格式变体: ${phoneVariants.join(', ')}`)
      
      // 使用 .in() 方法匹配多种格式
      queryBuilder = queryBuilder.in('phone', phoneVariants)
    } else {
      queryBuilder = queryBuilder.eq('email', query)
    }

    queryBuilder = queryBuilder.eq('status', 'active').limit(maxResults)

    const { data: results, error } = await queryBuilder

    if (error) {
      console.error('❌ 精确匹配失败:', error)
      throw new Error(`精确匹配失败: ${error.message}`)
    }
    
    console.log(`✅ 精确匹配完成: ${results?.length || 0} 个结果`)

    // 为了与混合搜索的结果格式保持一致，需要手动补全一些字段
    return (results || []).map((r: any) => ({
      ...r,
      similarity: 1.0,
      fts_rank: 1.0,
      exact_matches: 1,
      dynamic_alpha: 1.0,
      raw_combined_score: 1.0,
      boosted_score: 1.0,
      final_score: 1.0
    }))
  }

  console.log('🔄 执行增强混合搜索（数据库端动态Alpha + 关键词提升）...')
  
  const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`
  
  // 构建增强搜索参数
  const searchParams = {
    query_embedding: queryEmbeddingStr,
    query_text: query,  // 原始查询用于FTS和关键词匹配
    similarity_threshold: 0.01,  // 低阈值确保充分召回
    match_count: maxResults,
    location_filter: filters.location?.[0] || null,
    // 🔧 兼容前端字段映射：experience 字段转换为 experience_min
    experience_min: filters.experience_min || (filters.experience ? parseInt(filters.experience) : null),
    experience_max: filters.experience_max || null,
    salary_min: filters.salary_min || null,
    salary_max: filters.salary_max || null,
    skills_filter: filters.skills || filters.skills_must || null,
    status_filter: 'active'
  }
  
  console.log('📞 调用增强搜索函数: search_candidates_enhanced')
  console.log('🎯 最终传递给数据库的完整参数:', searchParams)
  
  const { data: results, error } = await supabase.rpc('search_candidates_enhanced', searchParams)
  
  if (error) {
    console.error('❌ 增强搜索失败:', error)
    throw new Error(`增强搜索失败: ${error.message}`)
  }
  
  if (!results || results.length === 0) {
    console.log('📭 搜索返回空结果')
    return []
  }
  
  console.log(`📊 搜索完成: ${results.length} 个结果`)
  
  // 打印搜索质量统计
  if (results.length > 0) {
    const avgAlpha = results.reduce((sum: number, r: any) => sum + r.dynamic_alpha, 0) / results.length
    const avgExactMatches = results.reduce((sum: number, r: any) => sum + r.exact_matches, 0) / results.length
    const topScore = results[0]?.final_score || 0
    const avgScore = results.reduce((sum: number, r: any) => sum + r.final_score, 0) / results.length
    
    console.log(`📈 搜索质量报告:`)
    console.log(`  - 最高分数: ${topScore.toFixed(4)}`)
    console.log(`  - 平均分数: ${avgScore.toFixed(4)}`)
    console.log(`  - 平均Alpha: ${avgAlpha.toFixed(3)} (动态调整)`)
    console.log(`  - 平均精确匹配: ${avgExactMatches.toFixed(1)} 个关键词`)
    
    // 显示前3名的详细信息
    console.log(`🏆 Top 3 结果:`)
    results.slice(0, 3).forEach((result: any, index: number) => {
      console.log(`  ${index + 1}. ${result.name}: 最终=${result.final_score.toFixed(4)}, Alpha=${result.dynamic_alpha.toFixed(3)}, 匹配=${result.exact_matches}个词`)
    })
  }
  
  return results
}

// 增强搜索主函数 - 职位
async function enhancedSearchJobs(
  supabase: any,
  query: string,
  queryEmbedding: number[],
  filters: any = {},
  maxResults: number = 100
): Promise<EnhancedSearchJob[]> {
  console.log('🔄 执行职位增强混合搜索（数据库端动态Alpha + 关键词提升）...')
  
  const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`
  
  // 🔧 构建与人选搜索相同的增强搜索参数
  const searchParams = {
    query_embedding: queryEmbeddingStr,
    query_text: query,  // 原始查询用于FTS和关键词匹配
    similarity_threshold: 0.01,  // 低阈值确保充分召回
    match_count: maxResults,
    location_filter: filters.location?.[0] || null,
    // 🔧 兼容前端字段映射：experience 字段转换为 experience_min
    experience_min: filters.experience_min || (filters.experience ? parseInt(filters.experience) : null),
    experience_max: filters.experience_max || null,
    salary_min_filter: filters.salary_min || null,
    salary_max_filter: filters.salary_max || null,
    skills_filter: filters.skills || filters.skills_must || null,
    status_filter: 'active'
  }
  
  console.log('📞 调用增强搜索函数: search_jobs_enhanced')
  console.log('🎯 最终传递给数据库的完整参数:', searchParams)
  
  const { data: results, error } = await supabase.rpc('search_jobs_enhanced', searchParams)
  
  if (error) {
    console.error('❌ 职位增强搜索失败:', error)
    throw new Error(`职位搜索失败: ${error.message}`)
  }
  
  if (!results || results.length === 0) {
    console.log('📭 职位搜索返回空结果')
    return []
  }
  
  console.log(`📊 职位搜索完成: ${results.length} 个结果`)
  
  // 🔧 打印职位搜索质量统计（与人选搜索一致）
  if (results.length > 0) {
    const avgAlpha = results.reduce((sum: number, r: any) => sum + r.dynamic_alpha, 0) / results.length
    const avgExactMatches = results.reduce((sum: number, r: any) => sum + r.exact_matches, 0) / results.length
    const topScore = results[0]?.final_score || 0
    const avgScore = results.reduce((sum: number, r: any) => sum + r.final_score, 0) / results.length
    
    console.log(`📈 职位搜索质量报告:`)
    console.log(`  - 最高分数: ${topScore.toFixed(4)}`)
    console.log(`  - 平均分数: ${avgScore.toFixed(4)}`)
    console.log(`  - 平均Alpha: ${avgAlpha.toFixed(3)} (动态调整)`)
    console.log(`  - 平均精确匹配: ${avgExactMatches.toFixed(1)} 个关键词`)
    
    // 显示前3名的详细信息
    console.log(`🏆 Top 3 职位结果:`)
    results.slice(0, 3).forEach((result: any, index: number) => {
      console.log(`  ${index + 1}. ${result.title}: 最终=${result.final_score.toFixed(4)}, Alpha=${result.dynamic_alpha.toFixed(3)}, 匹配=${result.exact_matches}个词`)
    })
  }
  
  return results
}

// ✨ 新增：LLM Rerank 函数
async function rerankWithLLM<T extends EnhancedSearchCandidate | EnhancedSearchJob>(
  rerankerQuery: string,
  candidates: T[]
): Promise<T[]> {
  console.log(`🤖 开始 LLM Rerank... 正在为 ${candidates.length} 个结果打分。`)
  console.log(`🎯 使用的重排查询: ${rerankerQuery.substring(0, 200)}...`)
  
  try {
    // 1. 准备候选人摘要数据，用于注入 Prompt
    const candidateSummaries = candidates.map(candidate => {
      // 判断是候选人还是职位
      const isCandidate = 'name' in candidate;
      
      if (isCandidate) {
        const c = candidate as EnhancedSearchCandidate;
        return {
          id: c.id,
          profile: `${c.name}: ${c.current_title} at ${c.current_company}, ${c.years_of_experience}年经验, 技能: ${c.skills.slice(0, 5).join(', ')}, 地点: ${c.location}`
        };
      } else {
        const j = candidate as EnhancedSearchJob;
        return {
          id: j.id,
          profile: `${j.title} at ${j.company}, 要求${j.experience_required}年经验, 技能要求: ${j.skills_required.slice(0, 5).join(', ')}, 地点: ${j.location}`
        };
      }
    });

    // 2. 构造 Prompt
    const prompt = `你是一位专家级的技术招聘官。请根据用户的搜索需求，为以下候选人/职位列表进行重排序。

用户搜索需求：
${rerankerQuery}

候选人/职位列表：
${JSON.stringify(candidateSummaries, null, 2)}

请为每个候选人/职位根据与搜索需求的匹配度，给出一个 0.0 到 1.0 的分数。分数越高表示匹配度越好。

请严格按照以下 JSON 格式返回结果，数组必须按分数降序排列：
{
  "ranked_candidates": [
    {"id": "candidate_id_1", "score": 0.95},
    {"id": "candidate_id_2", "score": 0.87},
    ...
  ]
}`;

    // 3. 调用 OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 调用失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const llmResult = JSON.parse(data.choices[0].message.content);

    // 4. 处理 LLM 响应并合并分数
    if (!llmResult.ranked_candidates || !Array.isArray(llmResult.ranked_candidates)) {
      throw new Error('LLM 返回格式不正确');
    }

    // 创建 id 到分数的映射
    const scoreMap = new Map();
    llmResult.ranked_candidates.forEach((item: any) => {
      if (item.id && typeof item.score === 'number') {
        scoreMap.set(item.id, item.score);
      }
    });

    // 5. 为每个候选人添加 llm_score 并按此排序
    const rerankedCandidates = candidates.map(candidate => ({
      ...candidate,
      llm_score: scoreMap.get(candidate.id) || 0
    }));

    // 按 llm_score 降序排序
    rerankedCandidates.sort((a, b) => (b.llm_score || 0) - (a.llm_score || 0));

    console.log('✅ LLM Rerank 完成。');
    
    // 打印前3名的结果用于调试
    console.log('🏆 LLM Rerank Top 3:');
    rerankedCandidates.slice(0, 3).forEach((result, index) => {
      const name = 'name' in result ? result.name : (result as EnhancedSearchJob).title;
      console.log(`  ${index + 1}. ${name}: LLM分数=${result.llm_score?.toFixed(3)}, 原始分数=${result.final_score.toFixed(3)}`);
    });

    return rerankedCandidates;

  } catch (error) {
    console.error('❌ LLM Rerank 失败，使用原始排序作为后备:', error);
    // 优雅降级：返回原始列表
    return candidates;
  }
}

// ✨ 新增：构建最佳查询函数
function buildBestQuery(
  query: string,
  finalQuery: string,
  effectiveFilters: any,
  isSparkProcessed: boolean
): string {
  // 优先级 1: Spark 模式 - 使用完整的格式化文本
  if (isSparkProcessed) {
    return query; // 完整的 Spark 格式文本
  }

  // 优先级 2: 复杂查询 - 组合重写查询和筛选条件
  if (finalQuery !== query.trim()) {
    let bestQuery = `重写后的查询：${finalQuery}`;
    
    // 添加筛选条件到查询中
    const filterParts = [];
    if (effectiveFilters.experience_min) {
      filterParts.push(`最低经验要求：${effectiveFilters.experience_min}年`);
    }
    if (effectiveFilters.skills) {
      filterParts.push(`必须包含技能：${Array.isArray(effectiveFilters.skills) ? effectiveFilters.skills.join(', ') : effectiveFilters.skills}`);
    }
    if (effectiveFilters.location) {
      filterParts.push(`地点要求：${Array.isArray(effectiveFilters.location) ? effectiveFilters.location.join(', ') : effectiveFilters.location}`);
    }
    if (effectiveFilters.salary_min) {
      filterParts.push(`最低薪资：${effectiveFilters.salary_min}`);
    }
    
    if (filterParts.length > 0) {
      bestQuery += `\n\n筛选条件：${filterParts.join(', ')}`;
    }
    
    return bestQuery;
  }

  // 优先级 3: 简单查询 - 使用原始输入
  return query.trim();
}

export async function POST(request: NextRequest) {
  try {
    // ✨ Step 1: 新增 rerank 参数解析
    const { query, mode, filters, rerank } = await request.json()
    
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

    // 支持候选人和职位搜索模式
    if (mode !== 'candidates' && mode !== 'jobs') {
      return NextResponse.json(
        { success: false, error: 'Only candidates and jobs modes are currently supported' },
        { status: 400 }
      )
    }

    console.log(`🎯 启动增强搜索算法 (Dynamic Alpha + Keyword Elevation)`)
    console.log(`🎛️ Rerank 模式: ${rerank ? '开启' : '关闭'}`)

    // 设置流式响应
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    // 增强搜索处理流程
    const processEnhancedSearch = async () => {
      try {
        console.log('🚀 开始增强搜索流程...')
        console.log('📝 原始查询:', query)
        
        // 🎯 智能检测：判断用户是否使用了 Neura spark 功能
        const isSparkProcessed = query.includes('【Spark Info.】') || 
                                query.includes('结构化描述：') || 
                                query.includes('关键词：') ||
                                (filters && filters._sparkMode === true)
        
        let finalQuery = query
        let queryEmbedding: number[] | null = null
        let effectiveFilters = { ...filters }
        
        if (isSparkProcessed) {
          console.log('🧠 检测到Spark处理过的查询，跳过标准化')
          
          // 从Spark格式化的文本中提取实际查询内容
          if (filters && filters._embeddingQuery) {
            // 如果filters中有embedding查询文本，使用它
            finalQuery = filters._embeddingQuery
            console.log('✅ 使用Spark提供的embedding文本:', finalQuery.substring(0, 100) + '...')
          } else {
            // 否则从格式化文本中提取"原始查询"部分
            const originalQueryMatch = query.match(/原始查询：(.+)$/)
            if (originalQueryMatch) {
              finalQuery = originalQueryMatch[1].trim()
              console.log('✅ 从Spark文本中提取原始查询:', finalQuery)
            } else {
              // 如果无法提取，去除格式化标记，使用清理后的文本
              finalQuery = query
                .replace(/【Spark Info\.】[\s\S]*?原始查询：/, '')
                .replace(/结构化描述：[\s\S]*?关键词：[\s\S]*?原始查询：/, '')
                .trim()
              console.log('✅ 清理Spark格式化标记后的查询:', finalQuery)
            }
          }
          
          // 对最终查询生成向量（不进行标准化）
          queryEmbedding = await generateEmbedding(finalQuery)
        } else {
          console.log('📝 普通查询，启动智能解析流程')
          
          // 🚀 智能判断：是否为简单查询
          const isSimple = isSimpleQuery(query)
          
          if (!isSimple) {
            console.log('🎯 复杂查询，调用 parse-query API 进行增强解析...')
            try {
              // 调用 parse-query API
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
              const parseResponse = await fetch(`${baseUrl}/api/parse-query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, search_type: mode }),
              })

              if (parseResponse.ok) {
                const response = await parseResponse.json()
                console.log('✨ 解析完成:', response)

                if (response.success && response.data) {
                  const parsedData = response.data  // 正确提取 data 字段
                  
                  if (parsedData.rewritten_query) {
                    finalQuery = parsedData.rewritten_query
                    console.log('✅ 使用解析后的 rewritten_query:', finalQuery)
                    
                    // 合并解析出的filters
                    const { rewritten_query, search_type, ...parsedFilters } = parsedData
                    effectiveFilters = { ...effectiveFilters, ...parsedFilters }
                    console.log('🔧 合并后的有效Filters:', effectiveFilters)
                  }
                }
              } else {
                console.error('❌ parse-query API 失败，使用原始查询')
                finalQuery = query
              }
            } catch (e) {
              console.error('❌ 调用 parse-query API 失败，使用原始查询作为后备:', e)
              finalQuery = query
            }
          } else {
            console.log('⚡ 简单查询，直接使用原始文本')
            finalQuery = query
          }
          
          queryEmbedding = await generateEmbedding(finalQuery)
        }
        
        if (!queryEmbedding) {
          await writer.write(encoder.encode(JSON.stringify({
            type: 'error',
            error: '无法生成查询向量'
          }) + '\n'))
          return
        }
        
        console.log('✅ 查询向量生成成功，维度:', queryEmbedding.length)

        // Step 2: 执行增强搜索 - 使用原始query作为FTS查询
        let results: EnhancedSearchCandidate[] | EnhancedSearchJob[] = []
        
        // 📌 重要：对于FTS搜索，始终使用原始用户输入，不使用处理后的文本
        const ftsQuery = isSparkProcessed && filters._ftsQuery ? filters._ftsQuery : 
                        extractOriginalUserQuery(query)
        
        // ✨ Step 2: 固定召回数量为 30
        const recallCount = 30
        console.log(`🔍 召回池大小设置为: ${recallCount}`)

        if (mode === 'candidates') {
          // 🚀 针对电话/邮箱这类简单查询，直接传递原始query
          const searchQuery = isSimpleQuery(query) ? query : ftsQuery
          results = await enhancedSearchCandidates(
            supabase,
            searchQuery,  // 使用适合的查询文本
            queryEmbedding!,  // 已检查null，这里可以安全使用
            effectiveFilters,
            recallCount
          )
        } else {
          results = await enhancedSearchJobs(
            supabase,
            ftsQuery,  // 使用适合FTS的查询文本  
            queryEmbedding!,  // 已检查null，这里可以安全使用
            effectiveFilters,
            recallCount
          )
        }

        console.log(`✅ 增强搜索完成: ${results.length} 个结果`)

        let finalResults = results
        let searchAlgorithm = 'enhanced_dynamic_alpha'

        // ✨ Step 5: 执行条件化 Rerank 逻辑
        if (rerank && results.length > 0) {
          console.log('🔄 开始执行 LLM Rerank 流程...')
          searchAlgorithm = 'enhanced_dynamic_alpha_with_llm_rerank'
          
          // ✨ Step 4: 构建最佳查询
          const rerankerQuery = buildBestQuery(query, finalQuery, effectiveFilters, isSparkProcessed)
          console.log('🎯 构建的重排查询:', rerankerQuery.substring(0, 200) + '...')
          
          // 执行 LLM 重排 - 使用类型断言来处理联合类型
          if (mode === 'candidates') {
            finalResults = await rerankWithLLM(rerankerQuery, results as EnhancedSearchCandidate[])
          } else {
            finalResults = await rerankWithLLM(rerankerQuery, results as EnhancedSearchJob[])
          }
          console.log(`🏆 Rerank 后，准备返回前 20 结果。`)
        }

        // ✨ Step 6: 最终结果裁剪为 20 条
        const displayResults = finalResults.slice(0, 20)
        console.log(`📋 最终显示结果数量: ${displayResults.length}`)
        
        // Step 3: 将结果转换为前端期望的格式 (添加match_score百分比) - 确保job和candidate格式一致
        const formattedResults = displayResults.map((result: any) => {
          // 如果有 LLM 分数，优先使用；否则使用原始分数
          const displayScore = result.llm_score ?? result.final_score

          return {
            ...result,
            match_score: Math.round(displayScore * 100), // 转换为百分比
            // ✨ Step 7: 更新调试信息
            debug_info: {
              algorithm: searchAlgorithm,
              rerank_applied: rerank,
              similarity: result.similarity,
              fts_rank: result.fts_rank,
              exact_matches: result.exact_matches,
              dynamic_alpha: result.dynamic_alpha,
              raw_combined_score: result.raw_combined_score,
              boosted_score: result.boosted_score,
              original_final_score: result.final_score, // 保留原始分数
              llm_score: result.llm_score, // 添加 LLM 分数
              final_score: displayScore, // 更新最终用于展示的分数
              processing_mode: isSparkProcessed ? 'spark_processed' : 'standard',
              final_query: finalQuery.substring(0, 100) + '...',
              fts_query: ftsQuery.substring(0, 100) + '...',
              search_type: mode
            }
          }
        })

        // Step 4: 流式返回结果 - 统一job和candidate的搜索配置
        await writer.write(encoder.encode(JSON.stringify({
          type: 'results',
          data: formattedResults,
          count: formattedResults.length,
          search_config: {
            algorithm: searchAlgorithm,
            rerank_strategy: rerank ? 'llm_rerank' : 'none', // 标记rerank策略
            search_type: mode,
            mode: isSparkProcessed ? 'spark_mode' : 'standard_mode',
            processing_strategy: isSparkProcessed ? 'no_normalization' : 
                               !isSimpleQuery(query) ? 'intelligent_parsing' : 'direct',
            features: [
              'dynamic_alpha_calculation',
              'keyword_hit_elevation',
              'query_characteristic_analysis',
              isSparkProcessed ? 'spark_optimization' : 'standard_processing',
              mode === 'jobs' ? 'job_specific_matching' : 'candidate_specific_matching',
              rerank ? 'llm_reranking' : 'standard_ranking' // 标记rerank功能
            ],
            base_alpha: 0.65,
            boost_factor: 1.2,
            type_specific: {
              search_entity: mode,
              initial_recall: recallCount, // 返回召回数量
              final_results_count: formattedResults.length,
              avg_score: formattedResults.length > 0 ? 
                (formattedResults.reduce((sum: number, r: any) => sum + (r.llm_score ?? r.final_score), 0) / formattedResults.length).toFixed(4) : '0',
              top_score: formattedResults.length > 0 ? (formattedResults[0]?.llm_score ?? formattedResults[0]?.final_score)?.toFixed(4) || '0' : '0'
            }
          }
        }) + '\n'))
        
        await writer.write(encoder.encode(JSON.stringify({
          type: 'complete',
          message: rerank ? 
            `LLM增强${mode === 'jobs' ? '职位' : '人选'}搜索完成` : 
            `标准${mode === 'jobs' ? '职位' : '人选'}搜索完成`,
          algorithm_version: rerank ? 'v3.0_llm_rerank' : 'v2.1_smart_processing',
          search_summary: {
            entity_type: mode,
            total_results: formattedResults.length,
            processing_mode: isSparkProcessed ? 'spark_processed' : 'standard_processed',
            algorithm_features: [
              'dynamic_alpha_weighting',
              'keyword_exact_matching', 
              'fts_vector_hybrid_search',
              'smart_query_analysis',
              ...(rerank ? ['llm_reranking'] : [])
            ]
          }
        }) + '\n'))

      } catch (error) {
        console.error('🚨 增强搜索失败:', error)
        await writer.write(encoder.encode(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : '搜索失败'
        }) + '\n'))
      } finally {
        writer.close()
      }
    }

    // 启动搜索管道
    processEnhancedSearch()

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

// 🎯 智能判断是否为简单查询
function isSimpleQuery(query: string): boolean {
  const trimmedQuery = query.trim()
  
  // 正则表达式，用于匹配常见的手机号和邮箱格式
  const phoneRegex = /^\d{11}$/
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // 如果是手机号或邮箱，直接认为是简单查询，用于精确匹配
  if (phoneRegex.test(trimmedQuery) || emailRegex.test(trimmedQuery)) {
    return true
  }
  
  // 1. 如果查询包含数字（如"5年", "20k", "3年经验"），几乎可以肯定是复杂查询
  if (/\d/.test(trimmedQuery)) {
    return false
  }
  
  // 2. 如果查询包含常见的复杂查询关键词，判断为复杂查询
  const complexKeywords = /经验|年限|薪资|工资|要求|需要|寻找|招聘|职位|岗位|公司|地点|技能/
  if (complexKeywords.test(trimmedQuery)) {
    return false
  }
  
  // 3. 如果查询很短（少于8个字符）且不含上述复杂特征，认为是简单查询
  if (trimmedQuery.length < 8) {
    return true
  }
  
  // 4. 默认情况下，将查询视为复杂查询，最大化利用LLM解析能力
  return false
}

// 提取原始用户查询的辅助函数
function extractOriginalUserQuery(sparkFormattedQuery: string): string {
  // 尝试从不同的Spark格式中提取原始查询
  const patterns = [
    /原始查询：(.+)$/m,
    /查询：(.+)$/m,
    /用户输入：(.+)$/m
  ]
  
  for (const pattern of patterns) {
    const match = sparkFormattedQuery.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  // 如果无法提取，返回清理后的文本
  return sparkFormattedQuery
    .replace(/【Spark Info\.】[\s\S]*?/, '')
    .replace(/结构化描述：[\s\S]*?/, '')
    .replace(/关键词：[\s\S]*?/, '')
    .trim()
} 