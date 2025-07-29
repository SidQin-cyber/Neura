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
    
    // 🔧 添加employment_type验证和转换函数
    const normalizeEmploymentType = (inputType: string): string => {
      if (!inputType) return 'full-time'  // 匹配数据库约束格式
      
      const type = inputType.toLowerCase().trim()
      
      // 直接匹配数据库允许的值（连字符格式）
      if (['full-time', 'part-time', 'contract', 'internship', 'remote'].includes(type)) {
        return type
      }
      
      // 中文到英文映射（输出连字符格式）
      const chineseMapping: { [key: string]: string } = {
        '全职': 'full-time',
        '兼职': 'part-time', 
        '合同工': 'contract',
        '实习': 'internship',
        '实习生': 'internship',
        '远程': 'remote'
      }
      
      if (chineseMapping[type]) {
        return chineseMapping[type]
      }
      
      // 英文别名映射（输出连字符格式）
      const aliasMapping: { [key: string]: string } = {
        'fulltime': 'full-time',
        'full time': 'full-time', 
        'full_time': 'full-time',  // 下划线转连字符
        'parttime': 'part-time',
        'part time': 'part-time',
        'part_time': 'part-time',  // 下划线转连字符
        'contractor': 'contract',
        'freelance': 'contract',
        'intern': 'internship',
        'student': 'internship',
        'remote work': 'remote',
        'work from home': 'remote',
        'wfh': 'remote'
      }
      
      if (aliasMapping[type]) {
        return aliasMapping[type]
      }
      
      console.warn(`⚠️ 未识别的employment_type: ${inputType}，使用默认值: full-time`)
      return 'full-time'  // 匹配数据库约束格式
    }
    
    // 🔧 添加status验证和转换函数
    const normalizeStatus = (inputStatus: string): string => {
      if (!inputStatus) return 'active'
      
      const status = inputStatus.toLowerCase().trim()
      
      // 直接匹配数据库允许的值
      if (['active', 'inactive', 'closed', 'filled', 'archived', 'draft'].includes(status)) {
        return status
      }
      
      // 中文到英文映射
      const chineseMapping: { [key: string]: string } = {
        '招聘中': 'active',
        '活跃': 'active',
        '开放': 'active',
        '草稿': 'draft',
        '暂停': 'inactive',
        '已关闭': 'closed',
        '已填补': 'filled',
        '已归档': 'archived'
      }
      
      if (chineseMapping[status]) {
        return chineseMapping[status]
      }
      
      // 英文别名映射
      const aliasMapping: { [key: string]: string } = {
        'open': 'active',
        'recruiting': 'active',
        'hiring': 'active',
        'published': 'active',
        'paused': 'inactive',
        'suspended': 'inactive',
        'completed': 'filled',
        'finished': 'filled'
      }
      
      if (aliasMapping[status]) {
        return aliasMapping[status]
      }
      
      console.warn(`⚠️ 未识别的status: ${inputStatus}，使用默认值: active`)
      return 'active'
    }
    
    // 🔧 添加urgency_level验证和转换函数
    const normalizeUrgencyLevel = (inputLevel: string): string => {
      if (!inputLevel) return 'normal'
      
      const level = inputLevel.toLowerCase().trim()
      
      // 直接匹配数据库允许的值
      if (['urgent', 'normal', 'pipeline', 'low'].includes(level)) {
        return level
      }
      
      // 中文到英文映射
      const chineseMapping: { [key: string]: string } = {
        '紧急': 'urgent',
        '急招': 'urgent',
        '正常': 'normal',
        '一般': 'normal',
        '储备': 'pipeline',
        '人才库': 'pipeline',
        '低优先级': 'low',
        '不急': 'low'
      }
      
      if (chineseMapping[level]) {
        return chineseMapping[level]
      }
      
      // 英文别名映射
      const aliasMapping: { [key: string]: string } = {
        'high': 'urgent',
        'asap': 'urgent',
        'medium': 'normal',
        'standard': 'normal',
        'future': 'pipeline',
        'bench': 'pipeline'
      }
      
      if (aliasMapping[level]) {
        return aliasMapping[level]
      }
      
      console.warn(`⚠️ 未识别的urgency_level: ${inputLevel}，使用默认值: normal`)
      return 'normal'
    }
    
    for (const item of data) {
      const jobItem: any = {
        owner_id: user.id,
        title: item.title,
        company: item.company,
        location: item.location || null,
          employment_type: normalizeEmploymentType(item.employment_type || item.type || 'full-time'), // 🔧 使用验证函数
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
        expected_start_date: item.expected_start_date || null,
        status: normalizeStatus(item.status), // 🔧 使用验证函数
        urgency_level: normalizeUrgencyLevel(item.urgency_level || item.urgency), // 🔧 使用验证函数
        fts_document: item.fts_document || null  // 🔧 添加fts_document字段
      }
      
      // 🔍 添加字段验证日志
      console.log(`🔧 职位 ${jobItem.title} 字段标准化处理:`, {
        employment_type: {
          原始值: item.employment_type || item.type,
          标准化后: jobItem.employment_type
        },
        status: {
          原始值: item.status,
          标准化后: jobItem.status
        },
        urgency_level: {
          原始值: item.urgency_level || item.urgency,
          标准化后: jobItem.urgency_level
        }
      })
      
      // 🎯 优先使用用户提供的embedding_text，否则生成（与人选逻辑一致）
      let embeddingText
      if (item.embedding_text && typeof item.embedding_text === 'string' && item.embedding_text.trim()) {
        embeddingText = item.embedding_text.trim()
        console.log(`📋 使用用户提供的embedding文本 for ${jobItem.title}:`, embeddingText.substring(0, 100) + '...')
      } else {
        // 生成向量化文本
        const rawEmbeddingText = createJobEmbeddingText(jobItem)
        console.log(`🔄 生成职位 ${jobItem.title} 的原始向量化文本:`, rawEmbeddingText.substring(0, 100) + '...')
        
        // 标准化文本（词典 + LLM）
        embeddingText = await normalizeTextWithCache(rawEmbeddingText)
        console.log(`✅ 职位 ${jobItem.title} 标准化后文本:`, embeddingText.substring(0, 100) + '...')
      }
      
      // 🔍 添加FTS数据调试（与人选逻辑一致）
      console.log(`🔍 ${jobItem.title} FTS数据检查:`, {
        hasFtsDocument: !!item.fts_document,
        ftsDocumentType: typeof item.fts_document,
        ftsDocumentLength: item.fts_document ? item.fts_document.length : 0,
        ftsDocumentPreview: item.fts_document ? item.fts_document.substring(0, 50) + '...' : 'NULL'
      })
      
      // 🎯 验证文本结果（如果是用户提供的embedding_text，跳过严格验证）
      if (!item.embedding_text) {
        const validation = validateNormalizedText(embeddingText)
        if (!validation.isValid) {
          console.error(`❌ 职位 ${jobItem.title} 文本验证失败:`, validation.errors)
          return NextResponse.json({ 
            error: `职位 ${jobItem.title} 数据验证失败: ${validation.errors.join(', ')}` 
          }, { status: 400 })
        }
      } else {
        // 用户提供的文本只做基础检查
        if (embeddingText.trim().length < 10) {
          console.error(`❌ 职位 ${jobItem.title} 用户提供的embedding文本过短`)
          return NextResponse.json({ 
            error: `职位 ${jobItem.title} embedding文本内容过少` 
          }, { status: 400 })
        }
        console.log(`✅ 用户提供的embedding文本通过基础验证`)
      }
      
      // 生成向量化
      const embedding = await generateEmbedding(embeddingText)
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
        // 如果向量化失败，跳过这个职位
        continue
      }
      
      jobData.push(jobItem)
    }

    if (jobData.length === 0) {
      return NextResponse.json({ error: '没有有效的职位数据' }, { status: 400 })
    }

    // 🔧 使用直接插入方式，支持所有字段包括 fts_document_text
    console.log('📊 准备插入数据，记录数:', jobData.length)

    const insertPromises = jobData.map(async (item) => {
      // 🔧 处理职位数据并插入
      console.log(`🔧 处理职位 ${item.title}:`, {
        embeddingType: typeof item.embedding,
        embeddingIsArray: Array.isArray(item.embedding),
        embeddingLength: item.embedding?.length,
        embeddingStrLength: JSON.stringify(item.embedding).length
      })
      
      // ✅ 使用直接插入，支持所有字段包括增强字段和 fts_document_text
      console.log(`🔧 准备插入 ${item.title}，FTS文档长度:`, item.fts_document ? item.fts_document.length : 'NULL')
      
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
          embedding: `[${item.embedding.join(',')}]`,
          fts_document_text: item.fts_document || null  // 🔧 添加fts_document_text字段支持
        })
        .select('id, title')
        .single()
      
      if (error) {
        console.error(`❌ 插入 ${item.title} 失败:`, error)
        throw error
      }
      
      console.log(`✅ 职位 ${item.title} 插入成功，ID:`, data.id)
      return { id: data.id, title: data.title }
    })

    try {
      const insertResults = await Promise.all(insertPromises)
      console.log(`✅ 数据库插入成功，记录数: ${insertResults.length}`)
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