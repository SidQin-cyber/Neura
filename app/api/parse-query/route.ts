import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

interface ParsedQueryResult {
  search_type: 'candidate' | 'job'
  role: string[]
  skills_must: string[]
  skills_related: Array<{ skill: string; confidence: number }>
  location: string[]
  industry: string[]
  company: string[]
  experience_min: number | null
  experience_max: number | null
  salary_min: number | null
  salary_max: number | null
  education: string[]
  gender: string | null
  age_min: number | null
  age_max: number | null
  rewritten_query: string
}

// 🎯 候选人搜索专用Prompt
const CANDIDATE_SEARCH_PROMPT = `你是候选人搜索专家，将用户查询转换为精确的结构化数据，专门为候选人匹配优化。

🎯 **核心原则**：
• 精确提取候选人特征
• 标准化技能和职位术语
• 专注人才画像构建
• ⚠️ **重要**：不要从公司名称推断地理位置，只有用户明确提到地点时才填写location字段

⚙️ **标准化规则**：
• 职位标准化：HRD→人力资源总监, CTO→首席技术官, CEO→首席执行官
• 技能标准化：k8s→Kubernetes, docker→Docker, ps→Photoshop, ai→Illustrator
• 薪资标准化：25k→25000(月薪), 年薪36万→30000(月薪)
• 经验处理：5+年→5年以上, 三年→3年
• 地点处理：只有明确提到"北京"、"上海"、"杭州"等具体地点时才填写，不要从公司推断

📋 **输出JSON格式**：
{
  "search_type": "candidate",
  "role": [string],              // 标准化职位名称
  "skills_must": [string],       // 明确提到的技能（标准化）
  "skills_related": [            // 仅高相关技能，最多3个
    { "skill": string, "confidence": 4-5 }
  ],
  "location": [string],          // ⚠️ 只有用户明确提到地点时才填写，不要从公司推断
  "industry": [string],
  "company": [string],
  "experience_min": int|null,
  "experience_max": int|null,
  "salary_min": int|null,        // 期望薪资，月薪，单位元
  "salary_max": int|null,
  "education": [string],
  "gender": "男"|"女"|null,
  "age_min": int|null,
  "age_max": int|null,
  "rewritten_query": string      // 针对候选人搜索优化的查询
}

🔥 **候选人搜索特点**：
• 重点关注技能匹配度和经验年限
• 公司背景和行业经验很重要
• 薪资期望是关键筛选条件
• 地理位置需要用户明确指定，不要自动推断

💡 **Rewritten_query优化（候选人视角）**：
• 突出候选人具备的能力和经验
• 添加#标签强化关键词：#技能 #公司 #经验年限
• 示例："寻找5年Java开发经验的候选人 #Java #Spring #北京 #5年经验"`

// 🎯 职位搜索专用Prompt  
const JOB_SEARCH_PROMPT = `你是职位搜索专家，将用户查询转换为精确的结构化数据，专门为职位匹配优化。

🎯 **核心原则**：
• 精确提取职位需求特征
• 标准化岗位描述和要求
• 专注岗位画像构建

⚙️ **标准化规则**：
• 职位标准化：前端→前端开发工程师, 后端→后端开发工程师, PM→产品经理
• 技能标准化：k8s→Kubernetes, docker→Docker, ps→Photoshop, ai→Illustrator
• 薪资标准化：25k→25000(月薪), 年薪36万→30000(月薪)
• 经验要求：3-5年→3年最低5年最高

📋 **输出JSON格式**：
{
  "search_type": "job",
  "role": [string],              // 标准化职位名称
  "skills_must": [string],       // 职位要求的核心技能
  "skills_related": [            // 职位相关技能，最多3个
    { "skill": string, "confidence": 4-5 }
  ],
  "location": [string],          // 工作地点
  "industry": [string],          // 行业要求
  "company": [string],           // 目标公司
  "experience_min": int|null,    // 最低经验要求
  "experience_max": int|null,    // 最高经验要求
  "salary_min": int|null,        // 职位薪资下限，月薪，单位元
  "salary_max": int|null,        // 职位薪资上限
  "education": [string],         // 学历要求
  "gender": "男"|"女"|null,
  "age_min": int|null,
  "age_max": int|null,
  "rewritten_query": string      // 针对职位搜索优化的查询
}

🔥 **职位搜索特点**：
• 重点关注岗位职责和技能要求
• 公司规模和发展阶段重要
• 薪资范围是吸引力指标

💡 **Rewritten_query优化（职位视角）**：
• 突出职位提供的机会和要求
• 添加#标签强化关键词：#岗位 #技能要求 #地点 #薪资
• 示例："寻找高级Java开发工程师职位 #Java #Spring #北京 #20-30K"`

export async function POST(request: NextRequest) {
  try {
    const { query, searchType } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    // 根据searchType选择对应的prompt，默认为候选人搜索
    const selectedPrompt = searchType === 'job' ? JOB_SEARCH_PROMPT : CANDIDATE_SEARCH_PROMPT
    
    console.log('🔍 解析类型:', searchType || 'candidate (默认)')
    console.log('🔍 原始用户输入:', query)

    // 使用对应的prompt进行解析
    console.log('🚀 开始智能解析...')
    const parseResult = await generateText({
      model: openai('gpt-4o-mini'),
      system: selectedPrompt,
      prompt: `用户查询：${query}`,
      temperature: 0.1,
      maxTokens: 400
    })

    console.log('🤖 LLM解析输出:', parseResult.text)

    // 解析JSON
    let parsedResult: ParsedQueryResult
    try {
      parsedResult = JSON.parse(parseResult.text)
    } catch (parseError) {
      console.error('❌ JSON解析失败:', parseError)
      console.log('原始输出:', parseResult.text)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to parse LLM response as JSON',
          raw_response: parseResult.text
        },
        { status: 500 }
      )
    }

    // 验证search_type字段
    if (!parsedResult.search_type) {
      parsedResult.search_type = searchType === 'job' ? 'job' : 'candidate'
    }

    console.log('✅ 结构化解析结果:', {
      search_type: parsedResult.search_type,
      role: parsedResult.role,
      skills_must: parsedResult.skills_must,
      location: parsedResult.location,
      experience_range: `${parsedResult.experience_min || 0}-${parsedResult.experience_max || '不限'}年`,
      rewritten_query: parsedResult.rewritten_query?.substring(0, 100) + '...'
    })

    return NextResponse.json({
      success: true,
      data: parsedResult,
      meta: {
        original_query: query,
        search_type: searchType || 'candidate',
        prompt_used: searchType === 'job' ? 'job_search_optimized' : 'candidate_search_optimized'
      }
    })

  } catch (error) {
    console.error('❌ 查询解析失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 