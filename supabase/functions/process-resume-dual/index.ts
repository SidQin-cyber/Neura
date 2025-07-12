// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

interface ResumeProcessRequest {
  file_url: string
  file_name: string
  file_type: string
  resume_id?: string
}

interface ParsedResumeData {
  name: string
  email: string
  phone: string
  current_title: string
  current_company: string
  location: string
  years_of_experience: number
  expected_salary_min: number
  expected_salary_max: number
  skills: string[]
  education: any[]
  experience: any[]
  certifications: any[]
  languages: any[]
}

async function parseResumeWithAI(fileContent) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  const prompt = `
请分析以下简历内容，并提取出结构化信息。请严格按照以下JSON格式返回：

{
  "name": "姓名",
  "email": "邮箱",
  "phone": "电话",
  "current_title": "当前职位",
  "current_company": "当前公司",
  "location": "所在地",
  "years_of_experience": 工作年限(数字),
  "expected_salary_min": 期望薪资最小值(数字),
  "expected_salary_max": 期望薪资最大值(数字),
  "skills": ["技能1", "技能2"],
  "education": [{"degree": "学位", "school": "学校", "year": "年份"}],
  "experience": [{"title": "职位", "company": "公司", "duration": "时间", "description": "描述"}],
  "certifications": [{"name": "证书名", "issuer": "颁发机构", "year": "年份"}],
  "languages": [{"language": "语言", "level": "水平"}]
}

### 薪资解析特别说明：
期望薪资字段需要特别注意格式转换，请将各种薪资格式统一转换为月薪（元）：

**常见格式示例：**
- "30k" → expected_salary_min: 30000, expected_salary_max: 30000
- "3w" → expected_salary_min: 30000, expected_salary_max: 30000
- "30万" → expected_salary_min: 30000, expected_salary_max: 30000
- "25-35k" → expected_salary_min: 25000, expected_salary_max: 35000
- "2w-3w" → expected_salary_min: 20000, expected_salary_max: 30000
- "年薪36万" → expected_salary_min: 30000, expected_salary_max: 30000
- "月薪30000" → expected_salary_min: 30000, expected_salary_max: 30000
- "期望薪资28k-32k" → expected_salary_min: 28000, expected_salary_max: 32000

**转换规则：**
1. k/K/千 = 乘以1000
2. w/W/万 = 乘以10000
3. 年薪需要除以12转换为月薪
4. 如果只有单个数值，min和max设为相同值
5. 如果是范围，提取最小值和最大值
6. 如果没有明确薪资信息，设为null

简历内容：
${fileContent}

请确保返回的是有效的JSON格式，如果某些信息不存在，请使用null或空数组。
`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的简历分析助手，专门用于解析和提取简历信息。请始终返回有效的JSON格式。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content
  
  try {
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to parse AI response:', content)
    throw new Error('Failed to parse AI response')
  }
}

async function generateDualEmbeddings(text) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  // 并行请求两个模型的embeddings
  const [smallEmbeddingResponse, largeEmbeddingResponse] = await Promise.all([
    // text-embedding-3-small (1536 dimensions)
    fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-small',
        encoding_format: 'float'
      })
    }),
    // text-embedding-3-large (3072 dimensions)
    fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-large',
        encoding_format: 'float'
      })
    })
  ])

  if (!smallEmbeddingResponse.ok || !largeEmbeddingResponse.ok) {
    throw new Error('Failed to get embeddings from OpenAI')
  }

  const smallData = await smallEmbeddingResponse.json()
  const largeData = await largeEmbeddingResponse.json()

  return {
    embedding_small: smallData.data[0].embedding,
    embedding_large: largeData.data[0].embedding
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? ''
          }
        }
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { file_url, file_name, file_type, resume_id } = await req.json()

    if (!file_url || !file_name || !file_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 从Supabase Storage下载文件
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resumes')
      .download(file_url.replace('/storage/v1/object/public/resumes/', ''))

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: 'Failed to download file' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 将文件转换为文本
    const fileContent = await fileData.text()

    // 使用AI解析简历
    const parsedData = await parseResumeWithAI(fileContent)

    // 生成用于向量搜索的文本
    const embeddingText = `
      ${parsedData.name} ${parsedData.current_title} ${parsedData.current_company}
      ${parsedData.location} ${parsedData.years_of_experience}年经验
      技能: ${parsedData.skills.join(', ')}
      教育: ${parsedData.education.map(e => `${e.degree} ${e.school}`).join(', ')}
      工作经历: ${parsedData.experience.map(e => `${e.title} ${e.company} ${e.description}`).join(', ')}
    `.trim()

    // 生成双模型embeddings
    const { embedding_small, embedding_large } = await generateDualEmbeddings(embeddingText)

    // 准备数据库数据
    const resumeData = {
      owner_id: user.id,
      name: parsedData.name,
      email: parsedData.email,
      phone: parsedData.phone,
      current_title: parsedData.current_title,
      current_company: parsedData.current_company,
      location: parsedData.location,
      years_of_experience: parsedData.years_of_experience,
      expected_salary_min: parsedData.expected_salary_min,
      expected_salary_max: parsedData.expected_salary_max,
      skills: parsedData.skills,
      education: parsedData.education,
      experience: parsedData.experience,
      certifications: parsedData.certifications,
      languages: parsedData.languages,
      raw_data: parsedData,
      file_url,
      file_name,
      file_type,
      embedding: embedding_small,
      embedding_large: embedding_large,
      status: 'active'
    }

    let result
    if (resume_id) {
      // 更新现有简历
      const { data, error } = await supabase
        .from('resumes')
        .update(resumeData)
        .eq('id', resume_id)
        .eq('owner_id', user.id)
        .select()
        .single()

      if (error) {
        throw error
      }
      result = data
    } else {
      // 创建新简历
      const { data, error } = await supabase
        .from('resumes')
        .insert(resumeData)
        .select()
        .single()

      if (error) {
        throw error
      }
      result = data
    }

    // 更新双模型embedding状态
    await supabase.rpc('update_dual_embedding_status', {
      table_name_param: 'resumes',
      record_id_param: result.id,
      status_param: 'completed'
    })

    return new Response(
      JSON.stringify({
        success: true,
        resume: result,
        embeddings_info: {
          small_dimensions: embedding_small.length,
          large_dimensions: embedding_large.length
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in process-resume-dual:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
 