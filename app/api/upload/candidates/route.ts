import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateEmbedding, createCandidateEmbeddingText } from '@/lib/embedding/openai-embedding'
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
    const requiredFields = ['name']
    for (const item of data) {
      // 检查必须字段
      for (const field of requiredFields) {
        if (!item[field]) {
          return NextResponse.json({ 
            error: `缺少必要字段: ${field}` 
          }, { status: 400 })
        }
      }
      
      // 检查职位信息（支持 title 或 current_title）
      if (!item.title && !item.current_title) {
        return NextResponse.json({ 
          error: `缺少必要字段: title 或 current_title` 
        }, { status: 400 })
      }
    }

    // 转换数据格式并生成向量化文本
    const resumeData = []
    
    for (const item of data) {
      const candidateData: any = {
        owner_id: user.id,
        name: item.name,
        email: item.email || null,
        phone: item.phone || null,
        current_title: item.title || item.current_title,
        current_company: item.company || item.current_company || null,
        location: item.location || null,
        age: item.age ? parseInt(item.age.toString()) : null,
        years_of_experience: item.years_of_experience || null,
        expected_salary_min: item.expected_salary_min || item.salary_min || null,
        expected_salary_max: item.expected_salary_max || item.salary_max || null,
        skills: Array.isArray(item.skills) ? item.skills : [],
        education: item.education || null,
        experience: item.experience || null,
        certifications: item.certifications || null,
        languages: item.languages || null,
        summary: item.summary || null,
        projects: item.projects || null,
        relocation_preferences: Array.isArray(item.relocation_preferences) ? item.relocation_preferences : null,
        raw_data: item,
        status: 'active'
      }
      
      // 生成向量化文本
      const rawEmbeddingText = createCandidateEmbeddingText(candidateData)
      console.log(`生成候选人 ${candidateData.name} 的原始向量化文本:`, rawEmbeddingText)
      
      // 标准化文本（词典 + LLM）
      const normalizedText = await normalizeTextWithCache(rawEmbeddingText)
      console.log(`候选人 ${candidateData.name} 标准化后文本:`, normalizedText)
      
      // 验证标准化结果
      const validation = validateNormalizedText(normalizedText)
      if (!validation.isValid) {
        console.error(`❌ 候选人 ${candidateData.name} 文本标准化验证失败:`, validation.errors)
        return NextResponse.json({ 
          error: `候选人 ${candidateData.name} 数据标准化失败: ${validation.errors.join(', ')}` 
        }, { status: 400 })
      }
      
      // 生成向量化
      const embedding = await generateEmbedding(normalizedText)
      if (embedding) {
        // 添加详细的调试信息
        console.log(`🔍 ${candidateData.name} embedding原始格式:`, {
          type: typeof embedding,
          isArray: Array.isArray(embedding),
          length: embedding.length,
          firstFew: embedding.slice(0, 3)
        })
        
        candidateData.embedding = embedding
        console.log(`✅ 候选人 ${candidateData.name} 向量化完成，维度: ${embedding.length}`)
      } else {
        console.warn(`⚠️ 候选人 ${candidateData.name} 向量化失败`)
        // 如果向量化失败，跳过这个候选人
        continue
      }
      
      resumeData.push(candidateData)
    }

    if (resumeData.length === 0) {
      return NextResponse.json({ error: '没有有效的候选人数据' }, { status: 400 })
    }

    // 🔧 使用RPC函数进行插入，确保embedding以正确的VECTOR格式存储
    console.log('📊 准备通过RPC函数插入数据，记录数:', resumeData.length)

    const insertPromises = resumeData.map(async (item) => {
      // 🔧 处理候选人数据并插入
      console.log(`🔧 处理候选人 ${item.name}:`, {
        embeddingType: typeof item.embedding,
        embeddingIsArray: Array.isArray(item.embedding),
        embeddingLength: item.embedding?.length,
        embeddingStrLength: JSON.stringify(item.embedding).length
      })

      // ✅ 使用直接插入方式，支持所有字段包括 age, summary, projects, relocation_preferences
      const { data, error } = await supabase
        .from('resumes')
        .insert({
          owner_id: item.owner_id,
          name: item.name,
          email: item.email,
          phone: item.phone,
          current_title: item.current_title,
          current_company: item.current_company,
          location: item.location,
          age: item.age,
          years_of_experience: item.years_of_experience ? parseInt(item.years_of_experience.toString()) : null,
          expected_salary_min: item.expected_salary_min ? parseInt(item.expected_salary_min.toString()) : null,
          expected_salary_max: item.expected_salary_max ? parseInt(item.expected_salary_max.toString()) : null,
          skills: item.skills,
          education: item.education ? (typeof item.education === 'string' ? { value: item.education } : item.education) : null,
          experience: item.experience ? (typeof item.experience === 'string' ? { value: item.experience } : item.experience) : null,
          certifications: item.certifications ? (typeof item.certifications === 'string' ? { value: item.certifications } : item.certifications) : null,
          languages: item.languages ? (typeof item.languages === 'string' ? { value: item.languages } : item.languages) : null,
          summary: item.summary,
          projects: item.projects ? (typeof item.projects === 'string' ? { value: item.projects } : item.projects) : null,
          relocation_preferences: item.relocation_preferences,
          raw_data: item.raw_data,
          status: item.status,
          embedding: `[${item.embedding.join(',')}]`
        })
        .select('id, name')
        .single()

      if (error) {
        console.error(`❌ 插入 ${item.name} 失败:`, error)
        throw error
      }
      
      console.log(`✅ 候选人 ${item.name} 插入成功，ID:`, data.id)
      return { id: data.id, name: data.name }
    })

    try {
      const insertResults = await Promise.all(insertPromises)
      console.log(`✅ 数据库插入成功，记录数: ${insertResults.length}`)
      console.log('🎯 插入的数据ID:', insertResults)
      
      return NextResponse.json({ 
        success: true, 
        count: insertResults.length,
        message: `成功上传 ${insertResults.length} 条候选人数据`,
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
    console.error('Upload candidates error:', error)
    return NextResponse.json({ 
      error: '服务器错误: ' + (error instanceof Error ? error.message : '未知错误')
    }, { status: 500 })
  }
}