import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    if (!text || text.trim().length === 0) {
      console.warn('Empty text provided for embedding')
      return null
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(),
      encoding_format: 'float',
    })

    if (response.data && response.data.length > 0) {
      return response.data[0].embedding
    }

    return null
  } catch (error) {
    console.error('OpenAI embedding error:', error)
    return null
  }
}

export function createCandidateEmbeddingText(candidate: any): string {
  const parts = []
  
  // 基本信息
  if (candidate.name) parts.push(`姓名: ${candidate.name}`)
  if (candidate.current_title) parts.push(`职位: ${candidate.current_title}`)
  if (candidate.current_company) parts.push(`公司: ${candidate.current_company}`)
  if (candidate.location) parts.push(`位置: ${candidate.location}`)
  
  // 技能
  if (candidate.skills && Array.isArray(candidate.skills)) {
    parts.push(`技能: ${candidate.skills.join(', ')}`)
  }
  
  // 经验
  if (candidate.years_of_experience) {
    parts.push(`工作经验: ${candidate.years_of_experience}年`)
  }
  
  // 教育背景
  if (candidate.education) {
    const edu = typeof candidate.education === 'string' 
      ? candidate.education 
      : JSON.stringify(candidate.education)
    parts.push(`教育背景: ${edu}`)
  }
  
  // 期望薪资
  if (candidate.expected_salary_min || candidate.expected_salary_max) {
    const salaryRange = [
      candidate.expected_salary_min && `${candidate.expected_salary_min}`,
      candidate.expected_salary_max && `${candidate.expected_salary_max}`
    ].filter(Boolean).join('-')
    if (salaryRange) parts.push(`期望薪资: ${salaryRange}`)
  }
  
  return parts.join('. ')
}

export function createJobEmbeddingText(job: any): string {
  const parts = []
  
  // 基本信息
  if (job.title) parts.push(`职位: ${job.title}`)
  if (job.company) parts.push(`公司: ${job.company}`)
  if (job.location) parts.push(`位置: ${job.location}`)
  
  // 职位描述
  if (job.description) parts.push(`描述: ${job.description}`)
  
  // 技能要求
  if (job.skills_required && Array.isArray(job.skills_required)) {
    parts.push(`技能要求: ${job.skills_required.join(', ')}`)
  }
  
  // 要求
  if (job.requirements) parts.push(`要求: ${job.requirements}`)
  
  // 工作类型
  if (job.employment_type) parts.push(`工作类型: ${job.employment_type}`)
  
  // 经验要求
  if (job.experience_required) {
    parts.push(`经验要求: ${job.experience_required}年`)
  }
  
  // 教育要求
  if (job.education_required) {
    parts.push(`教育要求: ${job.education_required}`)
  }
  
  // 薪资
  if (job.salary_min || job.salary_max) {
    const salaryRange = [
      job.salary_min && `${job.salary_min}`,
      job.salary_max && `${job.salary_max}`
    ].filter(Boolean).join('-')
    if (salaryRange) parts.push(`薪资: ${salaryRange}`)
  }
  
  // 福利
  if (job.benefits) parts.push(`福利: ${job.benefits}`)
  
  return parts.join('. ')
} 