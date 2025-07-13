// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

interface ProcessResumeRequest {
  filePath: string
  userId: string
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { filePath, userId } = await req.json()

    if (!filePath || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing filePath or userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Processing resume:', filePath)

    // 1. 从Storage下载文件
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resumes-raw')
      .download(filePath)

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError)
      return new Response(
        JSON.stringify({ error: 'Failed to download file' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. 将文件转换为文本
    const fileText = await extractTextFromFile(fileData)

    // 3. 使用OpenAI解析简历
    const parsedData = await parseResumeWithAI(fileText)

    // 4. 生成向量嵌入 (只使用小模型)
    const embedding = await generateEmbedding(parsedData)

    // 5. 保存到数据库
    if (!embedding) {
      throw new Error('Failed to generate embedding for resume.')
    }

    // 将embedding数组格式化为PostgreSQL VECTOR类型字符串
    const embeddingStr = `[${embedding.join(',')}]`
    
    console.log('🔧 处理候选人数据:', {
      name: parsedData.name,
      embeddingType: typeof embedding,
      embeddingIsArray: Array.isArray(embedding),
      embeddingLength: Array.isArray(embedding) ? embedding.length : 0,
      embeddingStrLength: embeddingStr.length
    })

    // 使用RPC函数插入数据，确保embedding以正确的VECTOR格式存储
    const { data: newCandidateId, error: dbError } = await supabase
      .rpc('insert_candidate_with_embedding', {
        p_owner_id: userId,
        p_name: parsedData.name,
        p_email: parsedData.email,
        p_phone: parsedData.phone,
        p_current_title: parsedData.current_title,
        p_current_company: parsedData.current_company,
        p_location: parsedData.location,
        p_years_of_experience: parsedData.years_of_experience,
        p_expected_salary_min: parsedData.expected_salary_min,
        p_expected_salary_max: parsedData.expected_salary_max,
        p_skills: parsedData.skills,
        p_education: parsedData.education ? (typeof parsedData.education === 'string' ? { value: parsedData.education } : parsedData.education) : null,
        p_experience: parsedData.experience ? (typeof parsedData.experience === 'string' ? { value: parsedData.experience } : parsedData.experience) : null,
        p_certifications: parsedData.certifications ? (typeof parsedData.certifications === 'string' ? { value: parsedData.certifications } : parsedData.certifications) : null,
        p_languages: parsedData.languages ? (typeof parsedData.languages === 'string' ? { value: parsedData.languages } : parsedData.languages) : null,
        p_raw_data: parsedData,
        p_status: 'active',
        p_embedding: embeddingStr
      })

    if (dbError) {
      console.error('❌ RPC插入失败:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save resume data via RPC' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ 候选人数据插入成功，ID:', newCandidateId)

    // 获取完整的候选人数据
    const { data: resumeData, error: selectError } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', newCandidateId)
      .single()

    if (selectError) {
      console.error('❌ 获取新插入的候选人数据失败:', selectError)
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve newly inserted resume data' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 更新文件相关字段
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/resumes-raw/${filePath}`
    const fileName = filePath.split('/').pop()
    const fileType = getFileType(filePath)

    const { data: updatedResumeData, error: updateError } = await supabase
      .from('resumes')
      .update({
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType
      })
      .eq('id', newCandidateId)
      .select()
      .single()

    if (updateError) {
      console.warn('⚠️ 更新文件信息失败:', updateError)
      // 不视为致命错误，继续处理
    }

    // 返回最终的候选人数据
    const finalResumeData = updatedResumeData || resumeData

    return new Response(
      JSON.stringify({
        success: true,
        resume: finalResumeData,
        message: 'Resume processed successfully with single embedding model',
        embedding_info: {
          model: 'text-embedding-3-small',
          dimensions: embedding.length
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Process resume error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function extractTextFromFile(fileData) {
  try {
    const buffer = await fileData.arrayBuffer()
    const text = new TextDecoder().decode(buffer)
    return text
  } catch (error) {
    console.error('Text extraction error:', error)
    throw new Error('Failed to extract text from file')
  }
}

async function parseResumeWithAI(content) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional resume parser. Extract structured information from the resume text.
          Return a JSON object with the following structure:
          {
            "name": "string",
            "email": "string",
            "phone": "string",
            "current_title": "string",
            "current_company": "string",
            "location": "string",
            "years_of_experience": number,
            "expected_salary_min": number,
            "expected_salary_max": number,
            "skills": ["string"],
            "education": [{"degree": "string", "institution": "string", "field_of_study": "string", "start_date": "string", "end_date": "string"}],
            "experience": [{"title": "string", "company": "string", "location": "string", "start_date": "string", "end_date": "string", "description": "string", "achievements": ["string"]}],
            "certifications": [{"name": "string", "issuing_organization": "string", "issue_date": "string", "expiration_date": "string"}],
            "languages": [{"language": "string", "proficiency": "string"}]
          }
          
          ### Salary Parsing Instructions:
          Pay special attention to salary information. Convert all salary formats to monthly salary in CNY:
          
          **Format Examples:**
          - "30k" → expected_salary_min: 30000, expected_salary_max: 30000
          - "3w" → expected_salary_min: 30000, expected_salary_max: 30000
          - "30万" → expected_salary_min: 30000, expected_salary_max: 30000
          - "25-35k" → expected_salary_min: 25000, expected_salary_max: 35000
          - "2w-3w" → expected_salary_min: 20000, expected_salary_max: 30000
          - "年薪36万" → expected_salary_min: 30000, expected_salary_max: 30000
          - "annual salary 360000" → expected_salary_min: 30000, expected_salary_max: 30000
          - "salary range 28-32k" → expected_salary_min: 28000, expected_salary_max: 32000
          
          **Conversion Rules:**
          1. k/K/千 = multiply by 1000
          2. w/W/万 = multiply by 10000
          3. Annual salary: divide by 12 to get monthly
          4. Single value: set both min and max to same value
          5. Range: extract min and max values
          6. No salary info: set to null
          
          If a field is not found, use null or empty array as appropriate.`
        },
        {
          role: 'user',
          content: content
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${result.error?.message}`)
  }

  try {
    return JSON.parse(result.choices[0].message.content)
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    throw new Error('Failed to parse resume data')
  }
}

async function generateEmbedding(parsedData) {
  // 创建用于嵌入的文本
  const textToEmbed = [
    parsedData.name,
    parsedData.current_title,
    parsedData.current_company,
    parsedData.location,
    ...(parsedData.skills || []),
    parsedData.experience
      ?.map((exp) => `${exp.title} at ${exp.company}: ${exp.description}`)
      .join(' '),
    parsedData.education
      ?.map(
        (edu) =>
          `${edu.degree} in ${edu.field_of_study} from ${edu.institution}`
      )
      .join(' ')
  ]
    .filter(Boolean)
    .join(' ')

  console.log('🔧 生成embedding的文本:', textToEmbed.substring(0, 200) + '...')

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: textToEmbed,
      encoding_format: 'float'
    })
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${result.error?.message}`)
  }

  console.log('✅ Embedding生成成功，维度:', result.data[0].embedding.length)
  return result.data[0].embedding
}

function getFileType(filePath) {
  const extension = filePath.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'pdf':
      return 'application/pdf'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'txt':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}
