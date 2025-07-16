import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embedding/openai-embedding'

// Type definitions for the reranking process
interface CandidateResult {
  id: string
  name: string
  email?: string
  phone?: string
  current_title?: string
  current_company?: string
  location?: string
  years_of_experience?: number
  expected_salary_min?: number
  expected_salary_max?: number
  skills?: string[]
  education?: any
  experience?: any
  certifications?: any
  languages?: any
  file_url?: string
  status: string
  created_at: string
  updated_at: string
  similarity: number
  fts_rank: number
  combined_score: number
  full_text_content: string
}

interface RerankRequest {
  inputs: {
    source_sentence: string
    sentences: string[]
  }
}

interface StreamChunk {
  type: 'meta' | 'chunk' | 'complete' | 'error'
  data?: any
  chunk_info?: {
    chunk_number: number
    total_chunks: number
    candidates_in_chunk: number
    is_final: boolean
  }
  total?: number
  processed?: number
  phase?: string
  pipeline_summary?: {
    recall_count: number
    rerank_count: number
    top_score: number
    chunks_delivered: number
  }
  error?: string
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

    // Only handle candidates mode for now (jobs can be added later)
    if (mode !== 'candidates') {
      return NextResponse.json(
        { success: false, error: 'Only candidates mode is currently supported for reranking' },
        { status: 400 }
      )
    }

    // Set up streaming response
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    // Async function to handle the recall-rerank pipeline
    const processSearchPipeline = async () => {
      try {
        // 🎯 PHASE 1: RECALL STAGE
        console.log('🔍 Phase 1: Starting recall stage...')
        
        // Generate query embedding
        console.log('生成查询向量:', query)
        const queryEmbedding = await generateEmbedding(query)
        
        if (!queryEmbedding) {
          await writer.write(encoder.encode(JSON.stringify({
            type: 'error',
            error: '无法生成查询向量'
          }) + '\n'))
          return
    }
    
    console.log('查询向量生成成功，维度:', queryEmbedding.length)
    
        // Convert query embedding to string format
    const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`
    
        // Parse filters
    const parseSalaryFilter = (salaryStr?: string) => {
      if (!salaryStr) return { min: null, max: null }
      const parts = salaryStr.split('-')
      return {
        min: parts[0] ? parseInt(parts[0]) : null,
        max: parts[1] ? parseInt(parts[1]) : null
      }
    }
    
    const salary = parseSalaryFilter(filters?.salary)
    const experienceFilter = filters?.experience ? parseInt(filters.experience) : null
    
        // 🚀 Enhanced search parameters for recall (up to 100 candidates)
      const searchParams = {
        query_embedding: queryEmbeddingStr,
          query_text: query,
          similarity_threshold: 0.05, // Lower threshold for broader recall
          match_count: 100, // Increased for better recall
        location_filter: filters?.location || null,
        experience_min: experienceFilter,
        experience_max: experienceFilter ? experienceFilter + 2 : null,
        salary_min: salary.min,
        salary_max: salary.max,
        skills_filter: filters?.skills || [],
        status_filter: 'active',
          user_id_param: user.id,
        fts_weight: 0.3,
        vector_weight: 0.7
      }
      
        console.log('🔍 Calling Supabase RPC for recall with params:', {
        similarity_threshold: searchParams.similarity_threshold,
          match_count: searchParams.match_count,
        location_filter: searchParams.location_filter,
        experience_min: searchParams.experience_min,
        experience_max: searchParams.experience_max,
        salary_min: searchParams.salary_min,
        salary_max: searchParams.salary_max,
        skills_filter: searchParams.skills_filter,
        status_filter: searchParams.status_filter
      })
      
        const { data: recallResults, error: recallError } = await supabase.rpc('search_candidates_rpc', searchParams)
        
        if (recallError) {
          console.error('❌ Recall stage error:', recallError)
          await writer.write(encoder.encode(JSON.stringify({
            type: 'error',
            error: recallError.message
          }) + '\n'))
          return
        }
        
        const candidates: CandidateResult[] = recallResults || []
        console.log(`✅ Recall stage completed: ${candidates.length} candidates retrieved`)
        
        // Send initial metadata
        await writer.write(encoder.encode(JSON.stringify({
          type: 'meta',
          total: candidates.length,
          phase: 'recall_complete'
        }) + '\n'))

        if (candidates.length === 0) {
          await writer.write(encoder.encode(JSON.stringify({
            type: 'complete',
            pipeline_summary: {
              recall_count: 0,
              rerank_count: 0,
              top_score: 0,
              chunks_delivered: 0
            }
          }) + '\n'))
          return
        }

        // 🎯 PHASE 2: RERANK STAGE
        console.log('🧠 Phase 2: Starting rerank stage...')
        
        // Prepare full text content for each candidate
        const candidatesWithFullText = candidates.map(candidate => {
          const fullTextParts = [
            candidate.name,
            candidate.current_title,
            candidate.current_company,
            candidate.location,
            candidate.years_of_experience ? `${candidate.years_of_experience} years experience` : null,
            candidate.skills ? candidate.skills.join(', ') : null,
            candidate.education ? JSON.stringify(candidate.education) : null,
            candidate.experience ? JSON.stringify(candidate.experience) : null,
            candidate.certifications ? JSON.stringify(candidate.certifications) : null,
            candidate.languages ? JSON.stringify(candidate.languages) : null
          ].filter(Boolean)
          
          return {
            ...candidate,
            full_text_content: fullTextParts.join(' | ')
          }
        })
        
        // Check if reranking configuration is available
        const rerankerEndpoint = process.env.RERANKER_ENDPOINT_URL
        const hfApiKey = process.env.HF_API_KEY
        
        if (!rerankerEndpoint || !hfApiKey) {
          console.log('⚠️ Reranking configuration missing, falling back to vector-only results...')
          
          // Stream the results without reranking using chunked delivery (应用相同的分数优化)
          const finalCandidates = candidatesWithFullText.map((candidate, index) => {
            const normalizedSimilarity = Math.max(0, Math.min(1, candidate.combined_score || 0.5))
            
            // 应用与重排版本相同的语义加分逻辑
            const titleLower = candidate.current_title?.toLowerCase() || ''
            const titleMatch = titleLower.includes('后端') ||
                              titleLower.includes('backend') ||
                              titleLower.includes('server') ||
                              titleLower.includes('golang') ||
                              titleLower.includes('java') ||
                              titleLower.includes('python') ? 0.3 : 0
            
            const skillsMatch = candidate.skills?.some(skill => 
              ['golang', 'java', 'python', 'node.js', 'c++', 'c#', 'rust', 'mysql', 'redis', 'mongodb', 'postgresql'].some(backend_skill => 
                skill.toLowerCase().includes(backend_skill)
              )) ? 0.2 : 0
            
            const semanticBonus = titleMatch + skillsMatch
            const finalScore = (normalizedSimilarity * 0.7) + (semanticBonus * 0.3) // 无重排时，向量权重更高
            
            // 相同的用户友好显示分数
            let displayScore
            if (finalScore >= 0.8) displayScore = Math.round(85 + (finalScore - 0.8) * 75)
            else if (finalScore >= 0.6) displayScore = Math.round(70 + (finalScore - 0.6) * 75)
            else if (finalScore >= 0.4) displayScore = Math.round(55 + (finalScore - 0.4) * 75)
            else if (finalScore >= 0.2) displayScore = Math.round(40 + (finalScore - 0.2) * 75)
            else displayScore = Math.round(25 + finalScore * 75)
            
            return {
              ...candidate,
              search_score: candidate.combined_score || 0.5,
              rerank_score: null,
              normalized_similarity: normalizedSimilarity,
              title_match_bonus: titleMatch,
              skills_match_bonus: skillsMatch,
              semantic_bonus: semanticBonus,
              final_score: finalScore,
              display_score: displayScore,
              rank: index + 1
            }
          })

          // Inline chunked streaming delivery
          const startTime = Date.now()
          const totalCandidates = finalCandidates.length

          // Format candidate function (fallback版本)
          const formatCandidate = (candidate: any) => ({
            id: candidate.id,
            name: candidate.name,
            current_title: candidate.current_title,
            current_company: candidate.current_company,
            location: candidate.location,
            years_of_experience: candidate.years_of_experience,
            expected_salary_min: candidate.expected_salary_min,
            expected_salary_max: candidate.expected_salary_max,
            skills: candidate.skills,
            match_score: candidate.display_score || Math.round(candidate.final_score * 100),
            search_score: candidate.search_score,
            rerank_score: candidate.rerank_score,
            normalized_similarity: candidate.normalized_similarity,
            final_score: candidate.final_score,
            display_score: candidate.display_score,
            rank: candidate.rank
          })

          // 📦 CHUNK 1: IMMEDIATE TOP 5 CANDIDATES
          const firstChunkSize = Math.min(5, totalCandidates)
          const firstChunk = finalCandidates.slice(0, firstChunkSize)

          console.log(`📦 Sending first chunk: top ${firstChunk.length} candidates (1-${firstChunkSize})`)

          const formattedFirstChunk = firstChunk.map(formatCandidate)

          await writer.write(encoder.encode(JSON.stringify({
            type: 'chunk',
            data: formattedFirstChunk,
            chunk_info: {
              chunk_number: 1,
              total_chunks: totalCandidates <= 5 ? 1 : totalCandidates <= 20 ? 2 : 3,
              candidates_in_chunk: firstChunk.length,
              is_final: totalCandidates <= 5
            }
          }) + '\n'))

          // Send more chunks if needed
          if (totalCandidates > 5) {
            const remainingCandidates = finalCandidates.slice(5)

            // Small delay for better UX
            await new Promise(resolve => setTimeout(resolve, 50))

            // 📦 CHUNK 2: NEXT 15 CANDIDATES
            const secondChunkSize = Math.min(15, remainingCandidates.length)
            const secondChunk = remainingCandidates.slice(0, secondChunkSize)

            console.log(`📦 Sending second chunk: next ${secondChunk.length} candidates (${firstChunkSize + 1}-${firstChunkSize + secondChunk.length})`)

            const formattedSecondChunk = secondChunk.map(formatCandidate)

            await writer.write(encoder.encode(JSON.stringify({
              type: 'chunk',
              data: formattedSecondChunk,
              chunk_info: {
                chunk_number: 2,
                total_chunks: remainingCandidates.length > secondChunkSize ? 3 : 2,
                candidates_in_chunk: secondChunk.length,
                is_final: remainingCandidates.length <= secondChunkSize
              }
            }) + '\n'))

            // 📦 CHUNK 3+: ANY ADDITIONAL CANDIDATES (if more than 20 total)
            if (remainingCandidates.length > secondChunkSize) {
              const additionalCandidates = remainingCandidates.slice(secondChunkSize)

              // Small delay between additional chunks
              await new Promise(resolve => setTimeout(resolve, 100))

              console.log(`📦 Sending final chunk: remaining ${additionalCandidates.length} candidates`)

              const formattedAdditionalChunk = additionalCandidates.map(formatCandidate)

              await writer.write(encoder.encode(JSON.stringify({
                type: 'chunk',
                data: formattedAdditionalChunk,
                chunk_info: {
                  chunk_number: 3,
                  total_chunks: 3,
                  candidates_in_chunk: additionalCandidates.length,
                  is_final: true
                }
              }) + '\n'))
            }
          }

          // Send completion signal
          const chunksDelivered = totalCandidates <= 5 ? 1 : totalCandidates <= 20 ? 2 : 3

          await writer.write(encoder.encode(JSON.stringify({
            type: 'complete',
            pipeline_summary: {
              recall_count: candidates.length,
              rerank_count: 0,
              top_score: finalCandidates[0]?.final_score || 0,
              chunks_delivered: chunksDelivered
            }
          }) + '\n'))

          console.log(`🎉 Fallback streaming completed! Delivered ${totalCandidates} candidates in ${chunksDelivered} chunks`)
          return
        }

        // Prepare reranking request
        const candidateTexts = candidatesWithFullText.map(candidate => {
          // Truncate to prevent token limit issues (approximately 512 tokens)
          return candidate.full_text_content.slice(0, 2000)
        })

        const rerankRequest = {
          query: query,
          texts: candidateTexts
        }

        console.log('🚀 Calling Hugging Face reranking endpoint...')
        console.log('Query:', query)
        console.log('Candidates to rerank:', candidatesWithFullText.length)
        
        // Call Hugging Face reranking endpoint
        const rerankerResponse = await fetch(rerankerEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hfApiKey}`
          },
          body: JSON.stringify(rerankRequest)
        })

        if (!rerankerResponse.ok) {
          const errorText = await rerankerResponse.text()
          console.error('❌ Reranking API error:', rerankerResponse.status, errorText)
          
          // 检查是否是503服务不可用错误（冷启动场景）
          if (rerankerResponse.status === 503) {
            console.log('🔥 Detected 503 error - likely cold start. Implementing retry strategy...')
            
            // 发送延长loading状态的元数据
            await writer.write(encoder.encode(JSON.stringify({
              type: 'meta',
              phase: 'rerank_coldstart',
              message: 'Reranking service is starting up, please wait...'
            }) + '\n'))

            // 冷启动重试策略：等待更长时间，多次重试
            const maxRetries = 3
            const retryDelays = [30000, 45000, 60000] // 30秒、45秒、60秒 - 适合TEI容器冷启动
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries}, waiting ${retryDelays[attempt]}ms...`)
              
              // 发送重试状态更新
              await writer.write(encoder.encode(JSON.stringify({
                type: 'meta',
                phase: 'rerank_retry',
                retry_attempt: attempt + 1,
                max_retries: maxRetries,
                message: `Waiting for service startup... (${attempt + 1}/${maxRetries})`
              }) + '\n'))
              
              // 等待指定时间
              await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]))
              
              try {
                console.log(`🚀 Retry ${attempt + 1}: Calling reranking endpoint again...`)
                const retryResponse = await fetch(rerankerEndpoint, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${hfApiKey}`
                  },
                  body: JSON.stringify(rerankRequest)
                })

                if (retryResponse.ok) {
                  console.log(`✅ Retry ${attempt + 1} successful! Service is now available.`)
                  const rerankResults: Array<{ index: number, score: number }> = await retryResponse.json()
                  console.log('✅ Reranking completed, results received:', rerankResults.length)

                  // 发送重试成功的元数据
                  await writer.write(encoder.encode(JSON.stringify({
                    type: 'meta',
                    phase: 'rerank_success_after_retry',
                    retry_attempt: attempt + 1,
                    message: 'Service ready! Processing results...'
                  }) + '\n'))

                  // 继续执行正常的重排序流程...
                  // [这里继续原有的重排序成功后的处理逻辑]
                  
                  // 🎯 PHASE 3: COMBINE AND SORT (优化分数计算) - 复制原有逻辑
                  const rerankedCandidates = candidatesWithFullText
                    .map((candidate, index) => {
                      const rerankResult = rerankResults.find(r => r.index === index)
                      const rerankScore = rerankResult ? rerankResult.score : 0
                      
                      const normalizedSimilarity = Math.max(0, Math.min(1, candidate.combined_score))
                      const enhancedRerankScore = Math.min(1, rerankScore * 2.5)
                      const balancedScore = (normalizedSimilarity * 0.6) + (enhancedRerankScore * 0.4)
                      const displayScore = Math.round(balancedScore * 100)
                      
                      return {
                        ...candidate,
                        rerank_score: rerankScore,
                        enhanced_rerank_score: enhancedRerankScore,
                        normalized_similarity: normalizedSimilarity,
                        final_score: balancedScore,
                        display_score: displayScore
                      }
                    })
                    .sort((a, b) => b.final_score - a.final_score)

                  console.log('🎯 Final ranking completed after retry, top 3 candidates:')
                  rerankedCandidates.slice(0, 3).forEach((c, i) => {
                    console.log(`${i + 1}. ${c.name} - Display Score: ${c.display_score}% (after ${attempt + 1} retries)`)
                  })

                  // 发送重排序完成元数据
                  await writer.write(encoder.encode(JSON.stringify({
                    type: 'meta',
                    phase: 'rerank_complete',
                    reranked: rerankedCandidates.length
                  }) + '\n'))

                  // 🎯 PHASE 4: 继续正常的分块流式传输...
                  // [这里需要复制完整的分块传输逻辑]
                  const totalCandidates = rerankedCandidates.length
                  const formatCandidate = (candidate: any) => ({
                    id: candidate.id,
                    data: candidate,
                    similarity: candidate.similarity,
                    created_at: candidate.created_at,
                    updated_at: candidate.updated_at,
                    name: candidate.name,
                    email: candidate.email,
                    phone: candidate.phone,
                    title: candidate.current_title,
                    current_title: candidate.current_title,
                    current_company: candidate.current_company,
                    location: candidate.location,
                    years_of_experience: candidate.years_of_experience,
                    expected_salary_min: candidate.expected_salary_min,
                    expected_salary_max: candidate.expected_salary_max,
                    skills: candidate.skills || [],
                    file_url: candidate.file_url,
                    match_score: candidate.display_score || Math.round(candidate.final_score * 100),
                    experience: candidate.years_of_experience ? `${candidate.years_of_experience}年经验` : null,
                    rerank_score: candidate.rerank_score,
                    enhanced_rerank_score: candidate.enhanced_rerank_score,
                    normalized_similarity: candidate.normalized_similarity,
                    final_score: candidate.final_score,
                    display_score: candidate.display_score,
                    original_rank: candidates.findIndex(c => c.id === candidate.id) + 1,
                    final_rank: rerankedCandidates.findIndex(c => c.id === candidate.id) + 1
                  })

                  // 发送分块数据
                  const firstChunkSize = Math.min(5, totalCandidates)
                  const firstChunk = rerankedCandidates.slice(0, firstChunkSize)
                  const formattedFirstChunk = firstChunk.map(formatCandidate)

                  await writer.write(encoder.encode(JSON.stringify({
                    type: 'chunk',
                    data: formattedFirstChunk,
                    chunk_info: {
                      chunk_number: 1,
                      total_chunks: totalCandidates <= 5 ? 1 : totalCandidates <= 20 ? 2 : 3,
                      candidates_in_chunk: firstChunk.length,
                      is_final: totalCandidates <= 5
                    }
                  }) + '\n'))

                  // 继续发送其他块...
                  if (totalCandidates > 5) {
                    await new Promise(resolve => setTimeout(resolve, 50))
                    const remainingCandidates = rerankedCandidates.slice(5)
                    const secondChunkSize = Math.min(15, remainingCandidates.length)
                    const secondChunk = remainingCandidates.slice(0, secondChunkSize)
                    const formattedSecondChunk = secondChunk.map(formatCandidate)

                    await writer.write(encoder.encode(JSON.stringify({
                      type: 'chunk',
                      data: formattedSecondChunk,
                      chunk_info: {
                        chunk_number: 2,
                        total_chunks: remainingCandidates.length > secondChunkSize ? 3 : 2,
                        candidates_in_chunk: secondChunk.length,
                        is_final: remainingCandidates.length <= secondChunkSize
                      }
                    }) + '\n'))

                    if (remainingCandidates.length > secondChunkSize) {
                      const additionalCandidates = remainingCandidates.slice(secondChunkSize)
                      await new Promise(resolve => setTimeout(resolve, 100))
                      const formattedAdditionalChunk = additionalCandidates.map(formatCandidate)

                      await writer.write(encoder.encode(JSON.stringify({
                        type: 'chunk',
                        data: formattedAdditionalChunk,
                        chunk_info: {
                          chunk_number: 3,
                          total_chunks: 3,
                          candidates_in_chunk: additionalCandidates.length,
                          is_final: true
                        }
                      }) + '\n'))
                    }
                  }

                  // 发送完成信号
                  const chunksDelivered = totalCandidates <= 5 ? 1 : totalCandidates <= 20 ? 2 : 3
                  await writer.write(encoder.encode(JSON.stringify({
                    type: 'complete',
                    pipeline_summary: {
                      recall_count: candidates.length,
                      rerank_count: rerankedCandidates.length,
                      top_score: rerankedCandidates[0]?.final_score || 0,
                      chunks_delivered: chunksDelivered,
                      retry_attempts: attempt + 1
                    }
                  }) + '\n'))

                  console.log(`🎉 Chunked streaming completed after ${attempt + 1} retries! Delivered ${totalCandidates} candidates`)
                  return // 成功完成，退出函数
                } else {
                  console.log(`❌ Retry ${attempt + 1} failed with status:`, retryResponse.status)
                  if (attempt === maxRetries - 1) {
                    console.log('😞 All retries exhausted, falling back to vector-only results...')
                    break // 最后一次重试也失败了，跳出循环执行fallback
                  }
                }
              } catch (retryError) {
                console.error(`❌ Error during retry ${attempt + 1}:`, retryError)
                if (attempt === maxRetries - 1) {
                  console.log('😞 All retries exhausted due to errors, falling back to vector-only results...')
                  break
                }
              }
            }
          }

          // 如果不是503错误，或者重试全部失败，执行fallback
          console.log('🔄 Falling back to vector-only results...')
          
                     // Fallback to vector-only results with the same chunked delivery pattern
           const fallbackCandidates = candidatesWithFullText.map((candidate, index) => {
             const normalizedSimilarity = Math.max(0, Math.min(1, candidate.combined_score || 0.5))
             
             // 应用与主流程相同的语义加分逻辑
             const titleLower = candidate.current_title?.toLowerCase() || ''
             const titleMatch = titleLower.includes('后端') ||
                               titleLower.includes('backend') ||
                               titleLower.includes('server') ||
                               titleLower.includes('golang') ||
                               titleLower.includes('java') ||
                               titleLower.includes('python') ? 0.3 : 0
             
             const skillsMatch = candidate.skills?.some(skill => 
               ['golang', 'java', 'python', 'node.js', 'c++', 'c#', 'rust', 'mysql', 'redis', 'mongodb', 'postgresql'].some(backend_skill => 
                 skill.toLowerCase().includes(backend_skill)
               )) ? 0.2 : 0
             
             const semanticBonus = titleMatch + skillsMatch
             const finalScore = (normalizedSimilarity * 0.7) + (semanticBonus * 0.3)
             
             // 用户友好的显示分数
             let displayScore
             if (finalScore >= 0.8) displayScore = Math.round(85 + (finalScore - 0.8) * 75)
             else if (finalScore >= 0.6) displayScore = Math.round(70 + (finalScore - 0.6) * 75)
             else if (finalScore >= 0.4) displayScore = Math.round(55 + (finalScore - 0.4) * 75)
             else if (finalScore >= 0.2) displayScore = Math.round(40 + (finalScore - 0.2) * 75)
             else displayScore = Math.round(25 + finalScore * 75)
             
             return {
               ...candidate,
               search_score: candidate.combined_score || 0.5,
               rerank_score: null,
               normalized_similarity: normalizedSimilarity,
               title_match_bonus: titleMatch,
               skills_match_bonus: skillsMatch,
               semantic_bonus: semanticBonus,
               final_score: finalScore,
               display_score: displayScore,
               rank: index + 1
             }
           })

          // Send metadata indicating fallback mode
          await writer.write(encoder.encode(JSON.stringify({
            type: 'meta',
            phase: 'fallback_vector_only',
            message: rerankerResponse.status === 503 
              ? 'Service startup timeout - using vector search results'
              : 'Using vector search only due to reranking service error'
          }) + '\n'))

          // Use the same chunked streaming delivery as the fallback section above
          const totalCandidates = fallbackCandidates.length
          const formatCandidate = (candidate: any) => ({
            id: candidate.id,
            name: candidate.name,
            current_title: candidate.current_title,
            current_company: candidate.current_company,
            location: candidate.location,
            years_of_experience: candidate.years_of_experience,
            expected_salary_min: candidate.expected_salary_min,
            expected_salary_max: candidate.expected_salary_max,
            skills: candidate.skills,
            match_score: candidate.display_score || Math.round(candidate.final_score * 100),
            search_score: candidate.search_score,
            rerank_score: candidate.rerank_score,
            normalized_similarity: candidate.normalized_similarity,
            final_score: candidate.final_score,
            display_score: candidate.display_score,
            rank: candidate.rank
          })

          // 📦 CHUNK 1: IMMEDIATE TOP 5 CANDIDATES
          const firstChunkSize = Math.min(5, totalCandidates)
          const firstChunk = fallbackCandidates.slice(0, firstChunkSize)

          console.log(`⚡ Sending immediate chunk: top ${firstChunk.length} candidates`)

          const formattedFirstChunk = firstChunk.map(formatCandidate)

          await writer.write(encoder.encode(JSON.stringify({
            type: 'chunk',
            data: formattedFirstChunk,
            chunk_info: {
              chunk_number: 1,
              total_chunks: totalCandidates <= 5 ? 1 : totalCandidates <= 20 ? 2 : 3,
              candidates_in_chunk: firstChunk.length,
              is_final: totalCandidates <= 5
            }
          }) + '\n'))

          // Send more chunks if needed
          if (totalCandidates > 5) {
            const remainingCandidates = fallbackCandidates.slice(5)

            // Small delay for better UX
            await new Promise(resolve => setTimeout(resolve, 50))

            // 📦 CHUNK 2: NEXT 15 CANDIDATES
            const secondChunkSize = Math.min(15, remainingCandidates.length)
            const secondChunk = remainingCandidates.slice(0, secondChunkSize)

            console.log(`📦 Sending second chunk: next ${secondChunk.length} candidates (${firstChunkSize + 1}-${firstChunkSize + secondChunk.length})`)

            const formattedSecondChunk = secondChunk.map(formatCandidate)

            await writer.write(encoder.encode(JSON.stringify({
              type: 'chunk',
              data: formattedSecondChunk,
              chunk_info: {
                chunk_number: 2,
                total_chunks: remainingCandidates.length > secondChunkSize ? 3 : 2,
                candidates_in_chunk: secondChunk.length,
                is_final: remainingCandidates.length <= secondChunkSize
              }
            }) + '\n'))

            // 📦 CHUNK 3+: ANY ADDITIONAL CANDIDATES (if more than 20 total)
            if (remainingCandidates.length > secondChunkSize) {
              const additionalCandidates = remainingCandidates.slice(secondChunkSize)

              // Small delay between additional chunks
              await new Promise(resolve => setTimeout(resolve, 100))

              console.log(`📦 Sending final chunk: remaining ${additionalCandidates.length} candidates`)

              const formattedAdditionalChunk = additionalCandidates.map(formatCandidate)

              await writer.write(encoder.encode(JSON.stringify({
                type: 'chunk',
                data: formattedAdditionalChunk,
                chunk_info: {
                  chunk_number: 3,
                  total_chunks: 3,
                  candidates_in_chunk: additionalCandidates.length,
                  is_final: true
                }
              }) + '\n'))
            }
          }

          // Send completion signal
          const chunksDelivered = totalCandidates <= 5 ? 1 : totalCandidates <= 20 ? 2 : 3

          await writer.write(encoder.encode(JSON.stringify({
            type: 'complete',
            pipeline_summary: {
              recall_count: candidates.length,
              rerank_count: 0,
              top_score: fallbackCandidates[0]?.final_score || 0,
              chunks_delivered: chunksDelivered,
              fallback_reason: rerankerResponse.status === 503
                ? `Service startup timeout (${rerankerResponse.status})`
                : `Reranking service unavailable (${rerankerResponse.status})`
            }
          }) + '\n'))

          console.log(`🎉 Fallback streaming completed! Delivered ${totalCandidates} candidates in ${chunksDelivered} chunks`)
          return
        }

        const rerankResults: Array<{ index: number, score: number }> = await rerankerResponse.json()
        console.log('✅ Reranking completed, results received:', rerankResults.length)

        // 🎯 PHASE 3: COMBINE AND SORT (优化分数计算)
        const rerankedCandidates = candidatesWithFullText
          .map((candidate, index) => {
            const rerankResult = rerankResults.find(r => r.index === index)
            const rerankScore = rerankResult ? rerankResult.score : 0
            
            // 🔧 新的分数优化策略
            const normalizedSimilarity = Math.max(0, Math.min(1, candidate.combined_score))
            
            // 🎯 针对数据质量调整重排分数权重
            const effectiveRerankScore = rerankScore * 10 // 对于简短文本，放大重排分数
            const cappedRerankScore = Math.min(1, effectiveRerankScore)
            
            // 🎪 三重分数组合策略
            const vectorScore = normalizedSimilarity
            const titleLower = candidate.current_title?.toLowerCase() || ''
            const titleMatch = titleLower.includes('后端') ||
                              titleLower.includes('backend') ||
                              titleLower.includes('server') ||
                              titleLower.includes('golang') ||
                              titleLower.includes('java') ||
                              titleLower.includes('python') ? 0.3 : 0
            
            const skillsMatch = candidate.skills?.some(skill => 
              ['golang', 'java', 'python', 'node.js', 'c++', 'c#', 'rust', 'mysql', 'redis', 'mongodb', 'postgresql'].some(backend_skill => 
                skill.toLowerCase().includes(backend_skill)
              )) ? 0.2 : 0
            
            // 综合分数：向量(50%) + 重排(30%) + 语义匹配(20%)
            const semanticBonus = titleMatch + skillsMatch
            const finalScore = (vectorScore * 0.5) + (cappedRerankScore * 0.3) + (semanticBonus * 0.2)
            
            // 🎨 用户友好的显示分数：转换到更直观的范围
            let displayScore
            if (finalScore >= 0.8) displayScore = Math.round(85 + (finalScore - 0.8) * 75) // 85-100%
            else if (finalScore >= 0.6) displayScore = Math.round(70 + (finalScore - 0.6) * 75) // 70-85%
            else if (finalScore >= 0.4) displayScore = Math.round(55 + (finalScore - 0.4) * 75) // 55-70%
            else if (finalScore >= 0.2) displayScore = Math.round(40 + (finalScore - 0.2) * 75) // 40-55%
            else displayScore = Math.round(25 + finalScore * 75) // 25-40%
            
            return {
              ...candidate,
              rerank_score: rerankScore,
              enhanced_rerank_score: cappedRerankScore,
              normalized_similarity: normalizedSimilarity,
              title_match_bonus: titleMatch,
              skills_match_bonus: skillsMatch,
              semantic_bonus: semanticBonus,
              final_score: finalScore,
              display_score: displayScore
            }
          })
          .sort((a, b) => b.final_score - a.final_score)

        console.log('🎯 Final ranking completed, top 3 candidates (优化后):')
        rerankedCandidates.slice(0, 3).forEach((c, i) => {
          console.log(`${i + 1}. ${c.name} - Display Score: ${c.display_score}% | Final: ${c.final_score.toFixed(3)} | Vector: ${c.normalized_similarity.toFixed(3)} | Rerank: ${c.rerank_score.toFixed(3)}→${c.enhanced_rerank_score.toFixed(3)}`)
        })

        // Send reranking metadata
        await writer.write(encoder.encode(JSON.stringify({
          type: 'meta',
          phase: 'rerank_complete',
          reranked: rerankedCandidates.length
        }) + '\n'))

        // 🎯 PHASE 4: CHUNKED STREAMING FOR OPTIMAL UX
        console.log('📡 Phase 4: Starting chunked streaming...')
        
        const formatCandidate = (candidate: any) => ({
          id: candidate.id,
          data: candidate,
          similarity: candidate.similarity,
          created_at: candidate.created_at,
          updated_at: candidate.updated_at,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          title: candidate.current_title,
          current_title: candidate.current_title,
          current_company: candidate.current_company,
          location: candidate.location,
          years_of_experience: candidate.years_of_experience,
          expected_salary_min: candidate.expected_salary_min,
          expected_salary_max: candidate.expected_salary_max,
          skills: candidate.skills || [],
          file_url: candidate.file_url,
          match_score: candidate.display_score || Math.round(candidate.final_score * 100), // 使用优化后的显示分数
          experience: candidate.years_of_experience ? `${candidate.years_of_experience}年经验` : null,
          // 完整的分数元数据
          rerank_score: candidate.rerank_score,
          enhanced_rerank_score: candidate.enhanced_rerank_score,
          normalized_similarity: candidate.normalized_similarity,
          final_score: candidate.final_score,
          display_score: candidate.display_score,
          original_rank: candidates.findIndex(c => c.id === candidate.id) + 1,
          final_rank: rerankedCandidates.findIndex(c => c.id === candidate.id) + 1
        })

        // 🚀 CHUNK 1: IMMEDIATE TOP 5 (First Screen Acceleration)
        const totalCandidates = rerankedCandidates.length
        const firstChunkSize = Math.min(5, totalCandidates)
        const firstChunk = rerankedCandidates.slice(0, firstChunkSize)
        
        console.log(`⚡ Sending immediate chunk: top ${firstChunkSize} candidates`)
        
        const formattedFirstChunk = firstChunk.map(formatCandidate)
        
        await writer.write(encoder.encode(JSON.stringify({
          type: 'chunk',
          data: formattedFirstChunk,
          chunk_info: {
            chunk_number: 1,
            total_chunks: totalCandidates > firstChunkSize ? 2 : 1,
            candidates_in_chunk: firstChunkSize,
            is_final: totalCandidates <= firstChunkSize
          }
        }) + '\n'))

        // 🔄 CHUNK 2: REMAINING CANDIDATES (Asynchronous Load)
        if (totalCandidates > firstChunkSize) {
          // Brief delay for optimal UX (allows first chunk to render)
          await new Promise(resolve => setTimeout(resolve, 50))
          
          const remainingCandidates = rerankedCandidates.slice(firstChunkSize)
          const secondChunkSize = Math.min(15, remainingCandidates.length)
          const secondChunk = remainingCandidates.slice(0, secondChunkSize)
          
          console.log(`📦 Sending second chunk: next ${secondChunk.length} candidates (${firstChunkSize + 1}-${firstChunkSize + secondChunk.length})`)
          
          const formattedSecondChunk = secondChunk.map(formatCandidate)
          
          await writer.write(encoder.encode(JSON.stringify({
            type: 'chunk',
            data: formattedSecondChunk,
            chunk_info: {
              chunk_number: 2,
              total_chunks: remainingCandidates.length > secondChunkSize ? 3 : 2,
              candidates_in_chunk: secondChunk.length,
              is_final: remainingCandidates.length <= secondChunkSize
            }
          }) + '\n'))

          // 📦 CHUNK 3+: ANY ADDITIONAL CANDIDATES (if more than 20 total)
          if (remainingCandidates.length > secondChunkSize) {
            const additionalCandidates = remainingCandidates.slice(secondChunkSize)
            
            // Small delay between additional chunks
            await new Promise(resolve => setTimeout(resolve, 100))
            
            console.log(`📦 Sending final chunk: remaining ${additionalCandidates.length} candidates`)
            
            const formattedAdditionalChunk = additionalCandidates.map(formatCandidate)
            
            await writer.write(encoder.encode(JSON.stringify({
              type: 'chunk',
              data: formattedAdditionalChunk,
              chunk_info: {
                chunk_number: 3,
                total_chunks: 3,
                candidates_in_chunk: additionalCandidates.length,
                is_final: true
              }
            }) + '\n'))
          }
        }

        // Send completion signal
        const chunksDelivered = totalCandidates <= 5 ? 1 : totalCandidates <= 20 ? 2 : 3
        
        await writer.write(encoder.encode(JSON.stringify({
          type: 'complete',
          pipeline_summary: {
            recall_count: candidates.length,
            rerank_count: rerankedCandidates.length,
            top_score: rerankedCandidates[0]?.final_score || 0,
            chunks_delivered: chunksDelivered
          }
        }) + '\n'))

        console.log(`🎉 Chunked streaming completed! Delivered ${totalCandidates} candidates in ${chunksDelivered} chunks`)

      } catch (error) {
        console.error('❌ Pipeline error:', error)
        await writer.write(encoder.encode(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown pipeline error'
        }) + '\n'))
      } finally {
        await writer.close()
      }
    }

    // Start the pipeline asynchronously
    processSearchPipeline()

    // Return streaming response
    return new NextResponse(readable, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error) {
    console.error('❌ Search API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '搜索请求失败' 
      },
      { status: 500 }
    )
  }
} 