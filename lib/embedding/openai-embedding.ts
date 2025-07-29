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
      model: 'text-embedding-3-large',
      input: text.trim(),
      dimensions: 1536,
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

/**
 * 增强版候选人 Embedding 文本生成
 * 基于数据库结构优化，充分利用所有有价值的字段
 */
export function createCandidateEmbeddingText(candidate: any): string {
  const sections = []
  
  // =========== 1. 核心身份信息 ===========
  const identity = []
  if (candidate.name) identity.push(candidate.name)
  if (candidate.current_title) identity.push(candidate.current_title)
  if (candidate.age) identity.push(`${candidate.age}岁`)
  if (candidate.current_company) identity.push(`就职于${candidate.current_company}`)
  if (candidate.location) identity.push(`工作地点${candidate.location}`)
  
  if (identity.length > 0) {
    sections.push(identity.join('，'))
  }
  
  // =========== 2. 个人简介 (summary) - 最重要的语义信息 ===========
  if (candidate.summary) {
    sections.push(`个人简介：${candidate.summary}`)
  }
  
  // =========== 3. 核心技能与专长 ===========
  if (candidate.skills && Array.isArray(candidate.skills) && candidate.skills.length > 0) {
    sections.push(`专业技能：${candidate.skills.join('、')}`)
  }
  
  // =========== 4. 工作经验详情 ===========
  const experienceParts = []
  
  // 经验年数
  if (candidate.years_of_experience) {
    experienceParts.push(`拥有${candidate.years_of_experience}年工作经验`)
  }
  
  // 详细工作经历 (experience JSONB)
  if (candidate.experience && Array.isArray(candidate.experience)) {
    const expDescriptions = candidate.experience.map((exp: any) => {
      const expParts = []
      if (exp.company && exp.position) {
        expParts.push(`在${exp.company}担任${exp.position}`)
      }
      if (exp.description) {
        expParts.push(exp.description)
      }
      if (exp.achievements && Array.isArray(exp.achievements)) {
        expParts.push(`主要成就：${exp.achievements.join('；')}`)
      }
      if (exp.technologies && Array.isArray(exp.technologies)) {
        expParts.push(`技术栈：${exp.technologies.join('、')}`)
      }
      return expParts.join('，')
    }).filter(Boolean)
    
    if (expDescriptions.length > 0) {
      experienceParts.push(`工作经历：${expDescriptions.join('。')}`)
    }
  }
  
  if (experienceParts.length > 0) {
    sections.push(experienceParts.join('。'))
  }
  
  // =========== 5. 项目经验 (projects JSONB) ===========
  if (candidate.projects && Array.isArray(candidate.projects)) {
    const projectDescriptions = candidate.projects.map((project: any) => {
      const projParts = []
      if (project.name) {
        projParts.push(`项目名称：${project.name}`)
      }
      if (project.description) {
        projParts.push(project.description)
      }
      if (project.technologies && Array.isArray(project.technologies)) {
        projParts.push(`技术栈：${project.technologies.join('、')}`)
      }
      if (project.role) {
        projParts.push(`担任角色：${project.role}`)
      }
      if (project.highlights && Array.isArray(project.highlights)) {
        projParts.push(`项目亮点：${project.highlights.join('；')}`)
      }
      return projParts.join('，')
    }).filter(Boolean)
    
    if (projectDescriptions.length > 0) {
      sections.push(`项目经验：${projectDescriptions.join('。')}`)
    }
  }
  
  // =========== 6. 教育背景 (education JSONB) ===========
  if (candidate.education) {
    let eduText = ''
    
    if (Array.isArray(candidate.education)) {
      const eduDescriptions = candidate.education.map((edu: any) => {
        const eduParts = []
        if (edu.school) eduParts.push(edu.school)
        if (edu.degree) eduParts.push(edu.degree)
        if (edu.major) eduParts.push(edu.major)
        if (edu.graduation_year) eduParts.push(`${edu.graduation_year}年毕业`)
        return eduParts.join(' ')
      }).filter(Boolean)
      
      eduText = eduDescriptions.join('；')
    } else if (typeof candidate.education === 'string') {
      eduText = candidate.education
    } else if (typeof candidate.education === 'object') {
      eduText = JSON.stringify(candidate.education)
    }
    
    if (eduText) {
      sections.push(`教育背景：${eduText}`)
    }
  }
  
  // =========== 7. 认证证书 (certifications JSONB) ===========
  if (candidate.certifications) {
    let certText = ''
    
    if (Array.isArray(candidate.certifications)) {
      const certDescriptions = candidate.certifications.map((cert: any) => {
        if (typeof cert === 'string') return cert
        if (cert.name) {
          const certParts = [cert.name]
          if (cert.issuer) certParts.push(`颁发机构：${cert.issuer}`)
          if (cert.date) certParts.push(`获得时间：${cert.date}`)
          return certParts.join(' ')
        }
        return null
      }).filter(Boolean)
      
      certText = certDescriptions.join('；')
    } else if (typeof candidate.certifications === 'string') {
      certText = candidate.certifications
    }
    
    if (certText) {
      sections.push(`专业认证：${certText}`)
    }
  }
  
  // =========== 8. 语言能力 (languages JSONB) ===========
  if (candidate.languages) {
    let langText = ''
    
    if (Array.isArray(candidate.languages)) {
      const langDescriptions = candidate.languages.map((lang: any) => {
        if (typeof lang === 'string') return lang
        if (lang.language && lang.proficiency) {
          return `${lang.language}(${lang.proficiency})`
        }
        return null
      }).filter(Boolean)
      
      langText = langDescriptions.join('、')
    } else if (typeof candidate.languages === 'string') {
      langText = candidate.languages
    }
    
    if (langText) {
      sections.push(`语言能力：${langText}`)
    }
  }
  
  // =========== 9. 地理偏好 (relocation_preferences) ===========
  if (candidate.relocation_preferences && Array.isArray(candidate.relocation_preferences)) {
    sections.push(`工作地点偏好：${candidate.relocation_preferences.join('、')}`)
  }
  
  // =========== 10. 期望薪资与求职状态 ===========
  const expectationParts = []
  
  if (candidate.expected_salary_min || candidate.expected_salary_max) {
    const salaryRange = [
      candidate.expected_salary_min && `${candidate.expected_salary_min}`,
      candidate.expected_salary_max && `${candidate.expected_salary_max}`
    ].filter(Boolean).join('-')
    if (salaryRange) expectationParts.push(`期望薪资：${salaryRange}`)
  }
  
  if (candidate.job_search_status) {
    expectationParts.push(`求职状态：${candidate.job_search_status}`)
  }
  
  if (expectationParts.length > 0) {
    sections.push(expectationParts.join('，'))
  }
  
  // 组合所有部分，用句号分隔以保持语义完整性
  return sections.filter(Boolean).join('。')
}

/**
 * 增强版职位 Embedding 文本生成
 * 基于数据库结构优化，充分利用所有有价值的字段
 */
export function createJobEmbeddingText(job: any): string {
  const sections = []
  
  // =========== 1. 基本职位信息 ===========
  const basic = []
  if (job.title) basic.push(`职位：${job.title}`)
  if (job.company) basic.push(`公司：${job.company}`)
  if (job.location) basic.push(`工作地点：${job.location}`)
  if (job.department) basic.push(`部门：${job.department}`)
  if (job.industry) basic.push(`行业：${job.industry}`)
  
  if (basic.length > 0) {
    sections.push(basic.join('，'))
  }
  
  // =========== 2. 职位亮点总结 (job_summary) - 核心吸引力 ===========
  if (job.job_summary) {
    sections.push(`职位亮点：${job.job_summary}`)
  }
  
  // =========== 3. 详细职位描述 ===========
  if (job.description) {
    sections.push(`职位描述：${job.description}`)
  }
  
  // =========== 4. 岗位要求 ===========
  if (job.requirements) {
    sections.push(`岗位要求：${job.requirements}`)
  }
  
  // =========== 5. 技能要求 - 关键匹配字段 ===========
  if (job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0) {
    sections.push(`技能要求：${job.skills_required.join('、')}`)
  }
  
  // =========== 6. 经验与教育要求 ===========
  const requirementParts = []
  
  if (job.experience_required) {
    requirementParts.push(`需要${job.experience_required}年以上工作经验`)
  }
  
  if (job.education_required) {
    requirementParts.push(`学历要求：${job.education_required}`)
  }
  
  if (job.employment_type) {
    const typeMap: { [key: string]: string } = {
      'full_time': '全职',
      'part_time': '兼职', 
      'contract': '合同',
      'internship': '实习',
      'remote': '远程'
    }
    requirementParts.push(`工作类型：${typeMap[job.employment_type] || job.employment_type}`)
  }
  
  if (requirementParts.length > 0) {
    sections.push(requirementParts.join('，'))
  }
  
  // =========== 7. 团队信息 (team_info JSONB) ===========
  if (job.team_info && typeof job.team_info === 'object') {
    const teamParts = []
    if (job.team_info.size) teamParts.push(`团队规模：${job.team_info.size}人`)
    if (job.team_info.structure) teamParts.push(`组织结构：${job.team_info.structure}`)
    if (job.team_info.culture) teamParts.push(`团队文化：${job.team_info.culture}`)
    if (job.team_info.lead_background) teamParts.push(`团队背景：${job.team_info.lead_background}`)
    
    if (teamParts.length > 0) {
      sections.push(`团队信息：${teamParts.join('，')}`)
    }
  }
  
  // =========== 8. 成长机会 (growth_opportunities) ===========
  if (job.growth_opportunities && Array.isArray(job.growth_opportunities)) {
    sections.push(`成长机会：${job.growth_opportunities.join('、')}`)
  }
  
  // =========== 9. 工作环境与公司文化 ===========
  if (job.work_environment) {
    sections.push(`工作环境：${job.work_environment}`)
  }
  
  if (job.company_culture) {
    sections.push(`公司文化：${job.company_culture}`)
  }
  
  // =========== 10. 远程工作政策 ===========
  if (job.remote_policy) {
    sections.push(`远程工作：${job.remote_policy}`)
  }
  
  // =========== 11. 薪资福利 ===========
  const compensationParts = []
  
  if (job.salary_min || job.salary_max) {
    const salaryRange = [
      job.salary_min && `${job.salary_min}`,
      job.salary_max && `${job.salary_max}`
    ].filter(Boolean).join('-')
    const currency = job.currency || 'CNY'
    if (salaryRange) compensationParts.push(`薪资：${salaryRange} ${currency}`)
  }
  
  if (job.benefits) {
    compensationParts.push(`福利：${job.benefits}`)
  }
  
  if (compensationParts.length > 0) {
    sections.push(compensationParts.join('，'))
  }
  
  // =========== 12. 面试流程 (interview_process JSONB) ===========
  if (job.interview_process && typeof job.interview_process === 'object') {
    const interviewParts = []
    if (job.interview_process.rounds) {
      interviewParts.push(`面试轮次：${job.interview_process.rounds}轮`)
    }
    if (job.interview_process.stages && Array.isArray(job.interview_process.stages)) {
      const stageNames = job.interview_process.stages
        .map((stage: any) => stage.stage)
        .filter(Boolean)
        .join('→')
      if (stageNames) interviewParts.push(`面试流程：${stageNames}`)
    }
    
    if (interviewParts.length > 0) {
      sections.push(`面试信息：${interviewParts.join('，')}`)
    }
  }
  
  // =========== 13. 紧急程度与入职时间 ===========
  const timingParts = []
  
  if (job.urgency_level) {
    const urgencyMap: { [key: string]: string } = {
      'urgent': '急招',
      'normal': '正常招聘', 
      'pipeline': '人才储备'
    }
    timingParts.push(`招聘紧急度：${urgencyMap[job.urgency_level] || job.urgency_level}`)
  }
  
  if (job.expected_start_date) {
    timingParts.push(`期望入职时间：${job.expected_start_date}`)
  }
  
  if (timingParts.length > 0) {
    sections.push(timingParts.join('，'))
  }
  
  // 组合所有部分，用句号分隔以保持语义完整性
  return sections.filter(Boolean).join('。')
}

/**
 * 演示新的 Embedding 策略效果
 * 对比旧版本与新版本的差异
 */
export function demonstrateEmbeddingImprovement() {
  const sampleCandidate = {
    name: "张三",
    current_title: "高级全栈工程师",
    current_company: "腾讯科技",
    location: "深圳",
    summary: "资深全栈工程师，拥有 8 年 Web 开发经验，精通 TypeScript 和 Next.js 生态。专注于构建高性能、高可用的 SaaS 应用，并有丰富的 AI 应用集成经验。",
    skills: ["TypeScript", "React", "Next.js", "Node.js", "Supabase", "PostgreSQL"],
    years_of_experience: 8,
    experience: [
      {
        company: "腾讯科技",
        position: "高级全栈工程师",
        description: "负责公司核心产品的前后端开发",
        achievements: ["性能优化提升 40%", "带领团队完成重构项目"],
        technologies: ["TypeScript", "Next.js", "Supabase"]
      }
    ],
    projects: [
      {
        name: "AI 招聘 SaaS 平台",
        description: "基于 Next.js 和 Supabase 构建的智能招聘系统",
        technologies: ["Next.js", "Supabase", "Vercel AI SDK"],
        role: "技术负责人",
        highlights: ["实现了基于 LLM 的简历智能解析", "构建了实时匹配算法"]
      }
    ],
    education: [
      {
        school: "清华大学",
        degree: "硕士",
        major: "计算机科学与技术",
        graduation_year: 2016
      }
    ],
    certifications: [
      {
        name: "AWS Solutions Architect",
        issuer: "Amazon",
        date: "2023-05"
      }
    ],
    languages: [
      { language: "中文", proficiency: "母语" },
      { language: "英语", proficiency: "工作流利" }
    ],
    relocation_preferences: ["深圳", "上海", "北京"],
    expected_salary_min: 40000,
    expected_salary_max: 50000,
    job_search_status: "主动求职"
  }

  const newEmbeddingText = createCandidateEmbeddingText(sampleCandidate)
  
  console.log('🚀 新版 Embedding 文本（信息丰富）:')
  console.log(newEmbeddingText)
  console.log('\n📊 文本长度:', newEmbeddingText.length)
  console.log('🎯 包含的关键信息维度:', [
    '身份信息', '个人简介', '技能', '工作经验', '项目经验', 
    '教育背景', '认证', '语言', '地理偏好', '求职状态'
  ].length)
  
  return newEmbeddingText
} 

 

/**
 * ⭐️ 【关键函数】根据Spark解析出的结构化查询，构建一个"虚拟理想候选人档案"文本
 * 🎯 核心理念：生成与实际candidate JSON格式完全对称的结构化文本
 * 严格按照 createCandidateEmbeddingText 的逻辑和字段顺序进行构建
 * @param parsedData - 从 /api/parse-query 返回的结构化数据
 * @returns {string} - 一个用于生成查询向量的结构化文本，与候选人文档格式完全对称
 */
export function createQueryEmbeddingText(parsedData: any): string {
  if (!parsedData) return ''

  const sections = []

  // =========== 1. 核心身份信息 (完全对应 candidate 的 identity 字段) ===========
  const identity = []
  
  // name 字段 (虚拟姓名)
  identity.push('理想候选人')
  
  // current_title 字段
  if (parsedData.role?.length > 0) {
    identity.push(parsedData.role[0])
  }
  
  // age 字段  
  if (parsedData.age_min || parsedData.age_max) {
    const ageRange = parsedData.age_min && parsedData.age_max 
      ? `${parsedData.age_min}-${parsedData.age_max}岁`
      : parsedData.age_min 
        ? `${parsedData.age_min}岁以上`
        : `${parsedData.age_max}岁以下`
    identity.push(ageRange)
  }
  
  // current_company 字段
  if (parsedData.company?.length > 0) {
    identity.push(`就职于${parsedData.company[0]}`)
  }
  
  // location 字段
  if (parsedData.location?.length > 0) {
    identity.push(`工作地点${parsedData.location[0]}`)
  }
  
  if (identity.length > 0) {
    sections.push(identity.join('，'))
  }

  // =========== 2. 个人简介 (对应 candidate.summary 字段) ===========
  const summaryParts = []
  
  if (parsedData.role?.length > 0) {
    summaryParts.push(`资深${parsedData.role[0]}`)
  }
  
  if (parsedData.experience_min) {
    summaryParts.push(`拥有 ${parsedData.experience_min} 年工作经验`)
  }
  
  if (parsedData.skills_must?.length > 0) {
    summaryParts.push(`精通 ${parsedData.skills_must.join(' 和 ')} 技术`)
  }
  
  if (parsedData.industry?.length > 0) {
    summaryParts.push(`专注于${parsedData.industry[0]}领域`)
  }
  
  if (parsedData.skills_related?.length > 0) {
    const relatedSkills = parsedData.skills_related
      .filter((s: any) => s.confidence >= 4)
      .map((s: any) => s.skill || s)
      .slice(0, 3)
    
    if (relatedSkills.length > 0) {
      summaryParts.push(`并有丰富的 ${relatedSkills.join('、')} 应用经验`)
    }
  }
  
  if (summaryParts.length > 0) {
    sections.push(`个人简介：${summaryParts.join('，')}。`)
  }

  // =========== 3. 核心技能与专长 (对应 candidate.skills 数组字段) ===========
  const allSkills = [
    ...(parsedData.skills_must || []),
    ...(parsedData.skills_related?.filter((s: any) => s.confidence >= 3).map((s: any) => s.skill || s) || [])
  ].slice(0, 10)
  
  if (allSkills.length > 0) {
    sections.push(`专业技能：${allSkills.join('、')}`)
  }

  // =========== 4. 工作经验详情 (对应 candidate.experience 数组字段) ===========
  const experienceParts = []
  
  // years_of_experience 字段
  if (parsedData.experience_min) {
    experienceParts.push(`拥有${parsedData.experience_min}年工作经验`)
  }
  
  // 模拟 experience 数组结构
  if (parsedData.role?.length > 0 && parsedData.company?.length > 0) {
    const expDescriptions = []
    expDescriptions.push(`在${parsedData.company[0]}担任${parsedData.role[0]}`)
    expDescriptions.push('负责核心产品的设计与开发')
    
    if (parsedData.skills_must?.length > 0) {
      expDescriptions.push(`主要成就：运用${parsedData.skills_must.slice(0, 3).join('、')}技术提升产品性能`)
      expDescriptions.push(`技术栈：${parsedData.skills_must.join('、')}`)
    }
    
    experienceParts.push(`工作经历：${expDescriptions.join('，')}`)
  }
  
  if (experienceParts.length > 0) {
    sections.push(experienceParts.join('。'))
  }

  // =========== 5. 项目经验 (对应 candidate.projects 数组字段) ===========
  if (parsedData.skills_must?.length > 0 || parsedData.role?.length > 0) {
    const projectDescriptions = []
    
    if (parsedData.role?.length > 0) {
      const projParts = []
      projParts.push(`项目名称：${parsedData.role[0]}相关核心项目`)
      projParts.push(`基于现代技术栈构建的高性能应用系统`)
      
      if (parsedData.skills_must?.length > 0) {
        projParts.push(`技术栈：${parsedData.skills_must.join('、')}`)
      }
      
      projParts.push('担任角色：技术负责人')
      projParts.push('项目亮点：实现了高性能架构设计；构建了可扩展的技术方案')
      
      projectDescriptions.push(projParts.join('，'))
    }
    
    if (projectDescriptions.length > 0) {
      sections.push(`项目经验：${projectDescriptions.join('。')}`)
    }
  }

  // =========== 6. 教育背景 (对应 candidate.education 数组字段) ===========
  if (parsedData.education?.length > 0) {
    const eduDescriptions = parsedData.education.map((edu: string) => {
      return `学校：知名大学，学历：${edu}，专业：计算机相关专业，毕业年份：近年毕业`
    })
    sections.push(`教育背景：${eduDescriptions.join('。')}`)
  }

  // =========== 7. 认证资质 (对应 candidate.certifications 数组字段) ===========
  if (parsedData.skills_must?.some((skill: string) => 
    skill.toLowerCase().includes('aws') || 
    skill.toLowerCase().includes('azure') || 
    skill.toLowerCase().includes('gcp')
  )) {
    sections.push('认证资质：持有云计算相关专业认证，认证机构：知名厂商，获取时间：近期')
  }

  // =========== 8. 语言能力 (对应 candidate.languages 数组字段) ===========
  const languageParts = ['语言：中文，熟练程度：母语']
  if (parsedData.skills_related?.some((s: any) => 
    s.skill?.toLowerCase().includes('english') || s.skill?.includes('英语')
  )) {
    languageParts.push('语言：英语，熟练程度：工作流利')
  }
  sections.push(`语言能力：${languageParts.join('；')}`)

  // =========== 9. 地理偏好 (对应 candidate.relocation_preferences 字段) ===========
  if (parsedData.location?.length > 0) {
    sections.push(`地理偏好：${parsedData.location.join('、')}`)
  }

  // =========== 10. 期望薪资与求职状态 (对应 candidate.expected_salary_* 和 job_search_status 字段) ===========
  const expectationParts = []
  
  if (parsedData.salary_min || parsedData.salary_max) {
    const salaryMin = parsedData.salary_min || '面议'
    const salaryMax = parsedData.salary_max || '面议'
    expectationParts.push(`期望薪资最低：${salaryMin}`)
    expectationParts.push(`期望薪资最高：${salaryMax}`)
  }
  
  expectationParts.push('求职状态：主动求职')
  
  if (expectationParts.length > 0) {
    sections.push(expectationParts.join('，'))
  }

  // 如果没有解析到任何有效信息，返回一个基础的结构化档案
  if (sections.length === 0) {
    return '理想候选人，经验丰富的专业人士。个人简介：具备相关工作经验和技能，能够胜任岗位要求并为团队带来价值。专业技能：掌握主流技术栈。工作经验：拥有多年实际项目经验。求职状态：主动求职'
  }

  // 组合所有部分，用句号分隔以保持与 createCandidateEmbeddingText 完全一致的格式
  return sections.filter(Boolean).join('。')
}

/**
 * ⭐️ 【关键函数】根据Spark解析出的结构化查询，构建FTS搜索关键词
 * 提取最重要的关键词用于PGroonga全文搜索
 * @param parsedData - 从 /api/parse-query 返回的结构化数据
 * @returns {string} - 用于FTS搜索的关键词字符串
 */
export function createFTSQueryText(parsedData: any): string {
  if (!parsedData) return ''

  const ftsKeywords = []
  
  // 核心关键词优先级排序 (按重要性)
  if (parsedData.role?.length > 0) {
    ftsKeywords.push(...parsedData.role)
  }
  
  if (parsedData.skills_must?.length > 0) {
    ftsKeywords.push(...parsedData.skills_must)
  }
  
  if (parsedData.company?.length > 0) {
    ftsKeywords.push(...parsedData.company)
  }
  
  if (parsedData.location?.length > 0) {
    ftsKeywords.push(...parsedData.location)
  }
  
  if (parsedData.industry?.length > 0) {
    ftsKeywords.push(...parsedData.industry)
  }
  
  if (parsedData.experience_min) {
    ftsKeywords.push(`${parsedData.experience_min}年`)
  }
  
  // 添加高置信度的相关技能 (只取前5个)
  if (parsedData.skills_related?.length > 0) {
    const relatedSkills = parsedData.skills_related
      .filter((s: any) => s.confidence >= 4)
      .map((s: any) => s.skill || s)
      .slice(0, 5)
    ftsKeywords.push(...relatedSkills)
  }

  // 使用原始的rewritten_query作为兜底
  if (ftsKeywords.length === 0 && parsedData.rewritten_query) {
    return parsedData.rewritten_query
  }

  return ftsKeywords.filter(Boolean).join(' ')
} 