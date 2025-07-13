import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateEmbedding, createCandidateEmbeddingText } from '@/lib/embedding/openai-embedding'

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
    const requiredFields = ['name', 'title']
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
        years_of_experience: item.experience || item.years_of_experience || null,
        expected_salary_min: item.salary_min || item.expected_salary_min || null,
        expected_salary_max: item.salary_max || item.expected_salary_max || null,
        skills: Array.isArray(item.skills) ? item.skills : [],
        education: item.education || null,
        experience: item.experience_records || item.experience || null,
        certifications: item.certifications || null,
        languages: item.languages || null,
        raw_data: item,
        status: 'active'
      }
      
      // 生成向量化文本
      const embeddingText = createCandidateEmbeddingText(candidateData)
      console.log(`生成候选人 ${candidateData.name} 的向量化文本:`, embeddingText)
      
      // 生成向量化
      const embedding = await generateEmbedding(embeddingText)
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

      // ✅ 使用RPC函数插入，确保embedding正确转换
      const { data, error } = await supabase.rpc('insert_candidate_with_embedding', {
        p_owner_id: item.owner_id,
        p_name: item.name,
        p_email: item.email,
        p_phone: item.phone,
        p_current_title: item.current_title,
        p_current_company: item.current_company,
        p_location: item.location,
        p_years_of_experience: item.years_of_experience,
        p_expected_salary_min: item.expected_salary_min,
        p_expected_salary_max: item.expected_salary_max,
        p_skills: item.skills,
        p_education: item.education ? (typeof item.education === 'string' ? { value: item.education } : item.education) : null,
        p_experience: item.experience ? (typeof item.experience === 'string' ? { value: item.experience } : item.experience) : null,
        p_certifications: item.certifications ? (typeof item.certifications === 'string' ? { value: item.certifications } : item.certifications) : null,
        p_languages: item.languages ? (typeof item.languages === 'string' ? { value: item.languages } : item.languages) : null,
        p_raw_data: item.raw_data,
        p_status: item.status,
        p_embedding: JSON.stringify(item.embedding) // RPC函数会处理转换
      })

      if (error) {
        console.error(`❌ 插入 ${item.name} 失败:`, error)
        throw error
      }
      
      console.log(`✅ 候选人 ${item.name} 插入成功，ID:`, data)
      return { id: data, name: item.name }
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