import { SearchMode } from '@/components/model-selector'
import { CandidateSearchResult, JobSearchResult } from '@/lib/types/recruitment'

interface SearchParams {
  query: string
  mode: SearchMode
  filters?: {
    location?: string
    experience?: string
    salary?: string
    skills?: string[]
    education?: string
  }
}

interface SearchResponse {
  success: boolean
  data?: CandidateSearchResult[] | JobSearchResult[]
  error?: string
}

export async function universalSearch(params: SearchParams): Promise<SearchResponse> {
  try {
    const { query, mode, filters } = params

    // 调用服务器端搜索API
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        query,
        mode,
        filters
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { success: false, error: errorData.error || 'Search request failed' }
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('搜索API错误:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '搜索请求失败' 
    }
  }
}

// 模拟的搜索函数，用于开发阶段
export async function mockUniversalSearch(params: SearchParams): Promise<SearchResponse> {
  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const { mode, query, filters } = params
  
  // 模拟数据库无数据的情况：如果查询包含特定关键词，返回空结果
  if (query.includes('无数据') || query.includes('测试空结果')) {
    return { success: true, data: [] }
  }
  
  if (mode === 'candidates') {
    let mockCandidates: CandidateSearchResult[] = [
      {
        id: '1',
        data: {} as any,
        similarity: 0.95,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name: '张三',
        email: 'zhangsan@example.com',
        phone: '13800138000',
        current_title: '高级前端开发工程师',
        current_company: '科技公司',
        location: '北京',
        years_of_experience: 5,
        expected_salary_min: 20000,
        expected_salary_max: 35000,
        skills: ['React', 'TypeScript', 'Node.js'],
        file_url: null
      },
      {
        id: '2',
        data: {} as any,
        similarity: 0.88,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name: '李四',
        email: 'lisi@example.com',
        phone: '13800138001',
        current_title: '全栈开发工程师',
        current_company: '互联网公司',
        location: '上海',
        years_of_experience: 3,
        expected_salary_min: 18000,
        expected_salary_max: 30000,
        skills: ['Vue', 'Python', 'MySQL'],
        file_url: null
      },
      {
        id: '3',
        data: {} as any,
        similarity: 0.82,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name: '王五',
        email: 'wangwu@example.com',
        phone: '13800138002',
        current_title: '后端开发工程师',
        current_company: '金融公司',
        location: '深圳',
        years_of_experience: 4,
        expected_salary_min: 22000,
        expected_salary_max: 38000,
        skills: ['Java', 'Spring', 'Redis'],
        file_url: null
      },
      {
        id: '4',
        data: {} as any,
        similarity: 0.91,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name: '赵六',
        email: 'zhaoliu@example.com',
        phone: '13800138003',
        current_title: 'AI工程师',
        current_company: 'AI公司',
        location: '北京',
        years_of_experience: 6,
        expected_salary_min: 30000,
        expected_salary_max: 50000,
        skills: ['Python', 'TensorFlow', 'PyTorch'],
        file_url: null
      },
      {
        id: '5',
        data: {} as any,
        similarity: 0.85,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name: '钱七',
        email: 'qianqi@example.com',
        phone: '13800138004',
        current_title: '产品经理',
        current_company: '电商公司',
        location: '上海',
        years_of_experience: 4,
        expected_salary_min: 18000,
        expected_salary_max: 30000,
        skills: ['产品设计', '用户研究', 'SQL'],
        file_url: null
      }
    ]
    
    // 应用筛选条件
    if (filters?.location) {
      mockCandidates = mockCandidates.filter(candidate => 
        candidate.location?.includes(filters.location!)
      )
    }
    
    if (filters?.salary) {
      const [minSalary, maxSalary] = filters.salary.split('-').map(s => parseInt(s))
      // 模拟薪资筛选逻辑（这里简化处理）
      if (minSalary || maxSalary) {
        mockCandidates = mockCandidates.filter(candidate => {
          // 模拟候选人期望薪资，实际应该从数据库字段获取
          const expectedSalary = candidate.similarity * 30 + 15 // 简化的薪资计算
          if (minSalary && expectedSalary < minSalary) return false
          if (maxSalary && expectedSalary > maxSalary) return false
          return true
        })
      }
    }
    
    return { success: true, data: mockCandidates }
  } else {
    let mockJobs: JobSearchResult[] = [
      {
        id: '1',
        data: {} as any,
        similarity: 0.92,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        title: '高级前端开发工程师',
        company: '科技创新公司',
        location: '北京',
        employment_type: 'full-time',
        salary_min: 20000,
        salary_max: 35000,
        currency: 'CNY',
        description: '负责前端架构设计和开发，要求有丰富的React经验',
        skills_required: ['React', 'TypeScript', 'Webpack'],
        experience_required: 3
      },
      {
        id: '2',
        data: {} as any,
        similarity: 0.87,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        title: '全栈开发工程师',
        company: '互联网公司',
        location: '上海',
        employment_type: 'full-time',
        salary_min: 25000,
        salary_max: 40000,
        currency: 'CNY',
        description: '负责全栈开发，前后端技术栈都要熟悉',
        skills_required: ['Vue', 'Node.js', 'MongoDB'],
        experience_required: 3
      },
      {
        id: '3',
        data: {} as any,
        similarity: 0.85,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        title: '后端开发工程师',
        company: '金融科技公司',
        location: '深圳',
        employment_type: 'full-time',
        salary_min: 22000,
        salary_max: 38000,
        currency: 'CNY',
        description: '负责后端系统架构和开发，金融行业经验优先',
        skills_required: ['Java', 'Spring Boot', 'MySQL'],
        experience_required: 3
      },
      {
        id: '4',
        data: {} as any,
        similarity: 0.89,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        title: 'AI算法工程师',
        company: '人工智能公司',
        location: '北京',
        employment_type: 'full-time',
        salary_min: 30000,
        salary_max: 50000,
        currency: 'CNY',
        description: '负责AI算法研发和优化，要求深度学习经验',
        skills_required: ['Python', 'TensorFlow', 'PyTorch'],
        experience_required: 5
      },
      {
        id: '5',
        data: {} as any,
        similarity: 0.83,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        title: '产品经理',
        company: '电商公司',
        location: '上海',
        employment_type: 'full-time',
        salary_min: 18000,
        salary_max: 30000,
        currency: 'CNY',
        description: '负责产品策略制定和功能规划',
        skills_required: ['产品规划', '数据分析', '用户体验'],
        experience_required: 3
      }
    ]
    
    // 应用筛选条件
    if (filters?.location) {
      mockJobs = mockJobs.filter(job => 
        job.location?.includes(filters.location!)
      )
    }
    
    if (filters?.salary) {
      const [minSalary, maxSalary] = filters.salary.split('-').map(s => parseInt(s))
      if (minSalary || maxSalary) {
        mockJobs = mockJobs.filter(job => {
          if (minSalary && job.salary_max && job.salary_max < minSalary) return false
          if (maxSalary && job.salary_min && job.salary_min > maxSalary) return false
          return true
        })
      }
    }
    
    return { success: true, data: mockJobs }
  }
} 