import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateEmbedding, createJobEmbeddingText } from '@/lib/embedding/openai-embedding'
import { normalizeTextWithCache, validateNormalizedText } from '@/lib/embedding/text-normalizer'

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json()
    
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: '数据必须是数组格式' }, { status: 400 })
    }

    if (data.length === 0) {
      return NextResponse.json({ error: '数据数组不能为空' }, { status: 400 })
    }

    const supabase = await createClient()

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('用户认证状态:', { user: user?.id, authError })
    if (authError || !user) {
      console.error('用户认证失败:', authError)
      return NextResponse.json({ error: '用户未登录' }, { status: 401 })
    }
    console.log('✅ 用户认证成功:', user.id)

    // 验证数据格式
    const requiredFields = ['title', 'company']
    for (const item of data) {
      for (const field of requiredFields) {
        if (!item[field]) {
          return NextResponse.json({ 
            error: `缺少必要字段: ${field}` 
          }, { status: 400 })
        }
      }
    }

    // 转换数据格式并生成向量化文本
    const jobData = []
    
    for (const item of data) {
      const jobItem: any = {
        owner_id: user.id,
        title: item.title,
        company: item.company,
        location: item.location || null,
        employment_type: item.employment_type || item.type || 'full-time',
        salary_min: item.salary_min || null,
        salary_max: item.salary_max || null,
        currency: item.currency || 'CNY',
        description: item.description || null,
        requirements: item.requirements || null,
        benefits: item.benefits || null,
        skills_required: Array.isArray(item.skills_required) ? item.skills_required : (Array.isArray(item.skills) ? item.skills : []),
        job_summary: item.job_summary || null,
        experience_required: item.experience_required || item.experience || null,
        education_required: item.education_required || item.education || null,
        industry: item.industry || null,
        department: item.department || null,
        team_info: item.team_info || null,
        growth_opportunities: Array.isArray(item.growth_opportunities) ? item.growth_opportunities : null,
        work_environment: item.work_environment || null,
        company_culture: item.company_culture || null,
        remote_policy: item.remote_policy || null,
        interview_process: item.interview_process || null,
        contact_info: item.contact_info || null,
        urgency_level: item.urgency_level || 'normal',
        expected_start_date: item.expected_start_date || null,
        status: 'active'
      }
      
      // 生成向量化文本
      const rawEmbeddingText = createJobEmbeddingText(jobItem)
      console.log(`生成职位 ${jobItem.title} 的原始向量化文本:`, rawEmbeddingText)
      
      // 标准化文本（词典 + LLM）
      const normalizedText = await normalizeTextWithCache(rawEmbeddingText)
      console.log(`职位 ${jobItem.title} 标准化后文本:`, normalizedText)
      
      // 验证标准化结果
      const validation = validateNormalizedText(normalizedText)
      if (!validation.isValid) {
        console.error(`❌ 职位 ${jobItem.title} 文本标准化验证失败:`, validation.errors)
        return NextResponse.json({ 
          error: `职位 ${jobItem.title} 数据标准化失败: ${validation.errors.join(', ')}` 
        }, { status: 400 })
      }
      
      // 生成向量化
      const embedding = await generateEmbedding(normalizedText)
      if (embedding) {
        // 添加详细的调试信息
        console.log(`🔍 ${jobItem.title} embedding原始格式:`, {
          type: typeof embedding,
          isArray: Array.isArray(embedding),
          length: embedding.length,
          firstFew: embedding.slice(0, 3)
        })
        
        jobItem.embedding = embedding
        console.log(`✅ 职位 ${jobItem.title} 向量化完成，维度: ${embedding.length}`)
      } else {
        console.warn(`⚠️ 职位 ${jobItem.title} 向量化失败`)
      }
      
      jobData.push(jobItem)
    }

    if (jobData.length === 0) {
      return NextResponse.json({ error: '没有有效的职位数据' }, { status: 400 })
    }

    // 🔧 使用RPC函数进行插入，确保embedding以正确的VECTOR格式存储
    console.log('📊 准备通过RPC函数插入数据，记录数:', jobData.length)

    const insertPromises = jobData.map(async (item) => {
      // 🔧 处理职位数据并插入
      console.log(`🔧 处理职位 ${item.title}:`, {
        embeddingType: typeof item.embedding,
        embeddingIsArray: Array.isArray(item.embedding),
        embeddingLength: item.embedding?.length,
        embeddingStrLength: JSON.stringify(item.embedding).length
      })
      
      // ✅ 使用直接插入，支持所有字段包括增强字段
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          owner_id: item.owner_id,
          title: item.title,
          company: item.company,
          location: item.location || null,
          employment_type: item.employment_type || 'full-time',
          salary_min: item.salary_min || null,
          salary_max: item.salary_max || null,
          currency: item.currency || 'CNY',
          description: item.description || null,
          requirements: item.requirements || null,
          benefits: item.benefits || null,
          skills_required: item.skills_required || [],
          job_summary: item.job_summary || null,
          experience_required: item.experience_required || null,
          education_required: item.education_required || null,
          industry: item.industry || null,
          department: item.department || null,
          team_info: item.team_info || null,
          growth_opportunities: item.growth_opportunities || null,
          work_environment: item.work_environment || null,
          company_culture: item.company_culture || null,
          remote_policy: item.remote_policy || null,
          interview_process: item.interview_process || null,
          contact_info: item.contact_info || null,
          urgency_level: item.urgency_level || 'normal',
          expected_start_date: item.expected_start_date || null,
          status: item.status || 'active',
          embedding: `[${item.embedding.join(',')}]`
        })
        .select('id, title')
        .single()
      
      if (error) {
        console.error(`❌ 插入 ${item.title} 失败:`, error)
        throw error
      }
      
      console.log(`✅ 职位 ${item.title} 插入成功，ID:`, data)
      return data
    })

    try {
      const insertResults = await Promise.all(insertPromises)
      console.log(`✅ 数据库RPC插入成功，记录数: ${insertResults.length}`)
      console.log('🎯 插入的数据ID:', insertResults)
      
      return NextResponse.json({ 
        success: true, 
        count: insertResults.length,
        message: `成功上传 ${insertResults.length} 条职位数据`,
        ids: insertResults
      })
    } catch (e) {
      const error = e as Error
      console.error('❌ 批量插入失败:', error)
      return NextResponse.json({ 
        error: '数据库批量插入失败: ' + error.message
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Upload jobs error:', error)
    return NextResponse.json({ 
      error: '服务器错误: ' + (error instanceof Error ? error.message : '未知错误')
    }, { status: 500 })
  }
} 