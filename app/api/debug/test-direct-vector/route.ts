import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embedding/openai-embedding'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 开始直接向量搜索测试...')
    
    const supabase = await createClient()
    
    // 检查用户认证
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 测试1: 用贝文瑾自己的真实embedding进行搜索
    console.log('🎯 测试1: 获取贝文瑾的真实embedding')
    const { data: beiwenjin, error: fetchError } = await supabase
      .from('resumes')
      .select('id, name, embedding')
      .eq('name', '贝文瑾')
      .single()

    if (fetchError || !beiwenjin) {
      return NextResponse.json({
        success: false,
        error: '无法获取贝文瑾的数据'
      })
    }

    console.log('✅ 获取到贝文瑾的数据，embedding存在:', !!beiwenjin.embedding)

    // 测试2: 生成一个新的查询向量（使用小米相关文本）
    const testQuery = "小米通讯技术有限公司机器人事业部机器人工程师"
    console.log('🎯 测试2: 生成查询向量 -', testQuery)
    
    const queryEmbedding = await generateEmbedding(testQuery)
    if (!queryEmbedding) {
      return NextResponse.json({
        success: false,
        error: '无法生成查询向量'
      })
    }

    const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`
    console.log('✅ 查询向量生成成功，维度:', queryEmbedding.length)

    // 测试3: 直接使用SQL查询，绕过RPC函数
    console.log('🎯 测试3: 直接SQL向量搜索')
    
    const { data: vectorResults, error: vectorError } = await supabase
      .from('resumes')
      .select(`
        id, 
        name, 
        current_company, 
        current_title,
        embedding
      `)
      .eq('status', 'active')
      .eq('owner_id', user.id)

    if (vectorError) {
      console.error('❌ 向量搜索失败:', vectorError)
      return NextResponse.json({
        success: false,
        error: vectorError.message
      })
    }

    console.log('✅ 获取到候选人数据:', vectorResults?.length || 0)

    // 测试4: 改进的相似度计算
    const resultsWithSimilarity = []
    
    if (vectorResults && vectorResults.length > 0) {
      for (const candidate of vectorResults) {
        if (candidate.embedding) {
          try {
            const candidateEmbedding = candidate.embedding
            
            // 检查数据类型和长度
            console.log(`🔍 检查 ${candidate.name} 的embedding:`)
            console.log('- 查询向量类型:', typeof queryEmbedding, '长度:', queryEmbedding.length)
            console.log('- 候选人向量类型:', typeof candidateEmbedding, '长度:', candidateEmbedding.length)
            console.log('- 候选人向量前3个值:', candidateEmbedding.slice(0, 3))
            
            // 处理embedding数据类型转换
            let parsedCandidateEmbedding
            if (typeof candidateEmbedding === 'string') {
              console.log('🔧 候选人embedding是字符串，正在解析...')
              try {
                // 解析字符串格式的向量，如 "[-0.004705,0.012825,...]"
                parsedCandidateEmbedding = JSON.parse(candidateEmbedding)
                console.log('✅ 字符串解析成功，长度:', parsedCandidateEmbedding.length)
                console.log('- 解析后前3个值:', parsedCandidateEmbedding.slice(0, 3))
              } catch (parseError) {
                console.error(`❌ ${candidate.name} embedding字符串解析失败:`, parseError)
                continue
              }
            } else if (Array.isArray(candidateEmbedding)) {
              console.log('✅ 候选人embedding已经是数组格式')
              parsedCandidateEmbedding = candidateEmbedding
            } else {
              console.error(`❌ ${candidate.name} embedding数据类型无法识别:`, typeof candidateEmbedding)
              continue
            }
            
            // 确保两个向量长度一致
            if (!Array.isArray(parsedCandidateEmbedding) || parsedCandidateEmbedding.length !== queryEmbedding.length) {
              console.error(`❌ ${candidate.name} 向量长度不匹配: 查询=${queryEmbedding.length}, 候选人=${parsedCandidateEmbedding?.length}`)
              continue
            }
            
            // 计算点积和模长
            let dotProduct = 0
            let queryNormSquared = 0
            let candidateNormSquared = 0
            
            for (let i = 0; i < queryEmbedding.length; i++) {
              const qVal = Number(queryEmbedding[i])
              const cVal = Number(parsedCandidateEmbedding[i])
              
              // 检查数值有效性
              if (isNaN(qVal) || isNaN(cVal)) {
                console.error(`❌ ${candidate.name} 在位置${i}发现NaN值: q=${qVal}, c=${cVal}`)
                break
              }
              
              dotProduct += qVal * cVal
              queryNormSquared += qVal * qVal
              candidateNormSquared += cVal * cVal
            }
            
            // 计算模长
            const queryNorm = Math.sqrt(queryNormSquared)
            const candidateNorm = Math.sqrt(candidateNormSquared)
            
            console.log(`📊 ${candidate.name} 计算详情:`)
            console.log('- 点积:', dotProduct)
            console.log('- 查询向量模长:', queryNorm)
            console.log('- 候选人向量模长:', candidateNorm)
            
            // 检查模长是否有效
            if (queryNorm === 0 || candidateNorm === 0 || isNaN(queryNorm) || isNaN(candidateNorm)) {
              console.error(`❌ ${candidate.name} 模长计算无效: queryNorm=${queryNorm}, candidateNorm=${candidateNorm}`)
              continue
            }
            
            // 计算余弦相似度
            const cosineSimilarity = dotProduct / (queryNorm * candidateNorm)
            
            console.log(`✅ ${candidate.name} 最终相似度:`, cosineSimilarity)
            
            // 检查结果有效性
            if (isNaN(cosineSimilarity)) {
              console.error(`❌ ${candidate.name} 相似度计算结果为NaN`)
              continue
            }
            
            resultsWithSimilarity.push({
              id: candidate.id,
              name: candidate.name,
              current_company: candidate.current_company,
              current_title: candidate.current_title,
              similarity: cosineSimilarity
            })
            
          } catch (error) {
            console.error(`❌ 计算 ${candidate.name} 相似度失败:`, error)
          }
        } else {
          console.error(`❌ ${candidate.name} 没有embedding数据`)
        }
      }
    }

    // 按相似度排序
    resultsWithSimilarity.sort((a, b) => b.similarity - a.similarity)

    console.log('🎉 测试完成!')
    console.log('- 总候选人数:', vectorResults?.length || 0)
    console.log('- 计算出相似度的候选人数:', resultsWithSimilarity.length)
    console.log('- 最高相似度:', resultsWithSimilarity[0]?.similarity || 'N/A')

    return NextResponse.json({
      success: true,
      tests: {
        data_fetch: {
          success: !fetchError,
          candidateName: beiwenjin?.name || null
        },
        vector_generation: {
          success: !!queryEmbedding,
          query: testQuery,
          dimensions: queryEmbedding?.length || 0
        },
        direct_search: {
          success: !vectorError,
          totalCandidates: vectorResults?.length || 0,
          resultsWithSimilarity: resultsWithSimilarity.length,
          topResult: resultsWithSimilarity[0] || null
        }
      },
      results: resultsWithSimilarity.slice(0, 5), // 返回前5个结果
      summary: {
        foundBeiwenjin: resultsWithSimilarity.some(r => r.name === '贝文瑾'),
        maxSimilarity: Math.max(...resultsWithSimilarity.map(r => r.similarity), 0)
      }
    })

  } catch (error) {
    console.error('🚨 直接向量搜索测试失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '测试失败' 
      },
      { status: 500 }
    )
  }
} 