import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embedding/openai-embedding'

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

    // 移除用户数据检查，实现数据共享模式

    // 1. 生成查询向量
    console.log('生成查询向量:', query)
    const queryEmbedding = await generateEmbedding(query)
    
    if (!queryEmbedding) {
      return NextResponse.json(
        { success: false, error: '无法生成查询向量' },
        { status: 500 }
      )
    }
    
    console.log('查询向量生成成功，维度:', queryEmbedding.length)
    
    // 将查询向量转换为字符串格式，供RPC函数使用
    const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`
    console.log('🔧 查询向量格式化完成，长度:', queryEmbeddingStr.length)
    console.log('🔧 向量预览:', queryEmbeddingStr.substring(0, 100) + '...')
    console.log('🔧 向量数组长度:', queryEmbedding.length)
    console.log('🔧 向量前5个值:', queryEmbedding.slice(0, 5))
    
    // 2. 解析筛选条件
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
    
    if (mode === 'candidates') {
      // 使用简化的向量搜索函数（移除用户ID过滤）
      const searchParams = {
        query_embedding: queryEmbeddingStr,
        query_text: query, // 添加原始搜索文本
        similarity_threshold: 0.10, // 降低阈值以获得更多结果
        match_count: 20,
        location_filter: filters?.location || null,
        experience_min: experienceFilter,
        experience_max: experienceFilter ? experienceFilter + 2 : null,
        salary_min: salary.min,
        salary_max: salary.max,
        skills_filter: filters?.skills || [],
        status_filter: 'active',
        user_id_param: user.id, // 添加用户ID参数
        fts_weight: 0.3,
        vector_weight: 0.7
      }
      
      console.log('候选人搜索参数:', {
        similarity_threshold: searchParams.similarity_threshold,
        location_filter: searchParams.location_filter,
        experience_min: searchParams.experience_min,
        experience_max: searchParams.experience_max,
        salary_min: searchParams.salary_min,
        salary_max: searchParams.salary_max,
        skills_filter: searchParams.skills_filter,
        status_filter: searchParams.status_filter
      })
      
      const { data, error } = await supabase.rpc('search_candidates_rpc', searchParams)
      
      console.log('🔍 RPC调用结果:')
      console.log('- 错误:', error)
      console.log('- 数据:', data)
      console.log('- 数据类型:', typeof data)
      console.log('- 数据长度:', data?.length)
      
      if (error) {
        console.error('候选人搜索错误:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
      
      console.log('候选人搜索结果:', data?.length || 0, '条')
      if (data && data.length > 0) {
        console.log('搜索结果详情:', data.map((item: any) => ({
          name: item.name,
          location: item.location,
          similarity: item.similarity,
          current_title: item.current_title
        })))
      }
      
      // 转换为前端需要的格式
      const results = (data || []).map((item: any) => ({
        id: item.id,
        data: item, // 原始数据
        similarity: item.similarity,
        created_at: item.created_at,
        updated_at: item.updated_at,
        name: item.name,
        email: item.email,
        phone: item.phone,
        title: item.current_title, // 添加title字段以兼容前端组件
        current_title: item.current_title,
        current_company: item.current_company,
        location: item.location,
        years_of_experience: item.years_of_experience,
        expected_salary_min: item.expected_salary_min,
        expected_salary_max: item.expected_salary_max,
        skills: item.skills || [],
        file_url: item.file_url,
        match_score: Math.round(item.similarity * 100), // 使用向量相似度分数
        experience: item.years_of_experience ? `${item.years_of_experience}年经验` : null
      }))
      
      return NextResponse.json({ success: true, data: results })
    } else {
      // 使用简化的向量搜索函数（移除用户ID过滤）
      const { data, error } = await supabase.rpc('search_jobs_rpc', {
        query_embedding: queryEmbeddingStr,
        query_text: query, // 添加原始搜索文本
        similarity_threshold: 0.10, // 降低阈值，确保能看到结果
        match_count: 20,
        location_filter: filters?.location || null,
        experience_min: experienceFilter,
        experience_max: experienceFilter ? experienceFilter + 2 : null,
        salary_min_filter: salary.min,
        salary_max_filter: salary.max,
        skills_filter: filters?.skills || [],
        status_filter: 'active',
        // 移除用户ID传递: user_id_param: user.id,
        fts_weight: 0.3,
        vector_weight: 0.7
      })
      
      if (error) {
        console.error('职位搜索错误:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
      
      console.log('职位搜索结果:', data?.length || 0, '条')
      if (data && data.length > 0) {
        console.log('职位搜索结果详情:', data.map((item: any) => ({
          title: item.title,
          company: item.company,
          location: item.location,
          similarity: item.similarity
        })))
      }
      
      // 转换为前端需要的格式
      const results = (data || []).map((item: any) => ({
        id: item.id,
        data: item, // 原始数据
        similarity: item.similarity,
        created_at: item.created_at,
        updated_at: item.updated_at,
        title: item.title,
        company: item.company,
        location: item.location,
        employment_type: item.employment_type,
        salary_min: item.salary_min,
        salary_max: item.salary_max,
        currency: item.currency,
        description: item.description,
        skills_required: item.skills_required || [],
        experience_required: item.experience_required,
        match_score: Math.round(item.similarity * 100) // 使用向量相似度分数
      }))
      
      return NextResponse.json({ success: true, data: results })
    }
  } catch (error) {
    console.error('搜索API错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '搜索请求失败' 
      },
      { status: 500 }
    )
  }
} 