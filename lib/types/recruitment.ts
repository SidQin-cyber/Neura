// Neura AI招聘平台类型定义
export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  avatar_url: string | null
  company: string | null
  role: 'recruiter' | 'hr_manager' | 'admin' | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Resume {
  id: string
  owner_id: string
  name: string
  email: string | null
  phone: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  years_of_experience: number | null
  expected_salary_min: number | null
  expected_salary_max: number | null
  skills: string[]
  education: EducationRecord[] | null
  experience: ExperienceRecord[] | null
  certifications: CertificationRecord[] | null
  languages: LanguageRecord[] | null
  // 🔥 新增字段：AI搜索的核心数据
  summary: string | null                     // 个人简介
  relocation_preferences: string[] | null    // 可接受工作地点
  projects: ProjectRecord[] | null           // 项目经验
  //
  raw_data: Record<string, any> | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  embedding: number[] | null
  status: 'active' | 'inactive' | 'archived'
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  owner_id: string
  title: string
  company: string
  location: string | null
  employment_type: JobEmploymentType | null
  salary_min: number | null
  salary_max: number | null
  currency: string
  description: string | null
  requirements: string | null
  benefits: string | null
  skills_required: string[]
  experience_required: number | null
  education_required: string | null
  industry: string | null
  department: string | null
  // 🔥 新增字段：AI搜索的核心数据
  job_summary: string | null                  // 岗位亮点总结
  team_info: TeamInfoRecord | null           // 团队信息
  growth_opportunities: string[] | null      // 成长机会
  work_environment: string | null            // 工作环境
  company_culture: string | null             // 公司文化
  remote_policy: string | null               // 远程工作政策
  interview_process: InterviewProcessRecord | null  // 面试流程
  contact_info: ContactInfoRecord | null     // 联系人信息
  urgency_level: 'urgent' | 'normal' | 'pipeline' | null  // 紧急程度
  expected_start_date: string | null         // 期望入职时间
  //
  embedding: number[] | null
  status: 'active' | 'inactive' | 'closed'
  created_at: string
  updated_at: string
}

export interface Interaction {
  id: string
  user_id: string
  candidate_id: string | null
  job_id: string | null
  type:
    | 'contact'
    | 'interview'
    | 'note'
    | 'match'
    | 'call'
    | 'email'
    | 'meeting'
  subject: string | null
  content: string | null
  metadata: Record<string, any> | null
  scheduled_at: string | null
  completed_at: string | null
  created_at: string
}

export interface CandidateJobMatch {
  id: string
  candidate_id: string
  job_id: string
  ai_score: number | null
  manual_score: number | null
  status: 'pending' | 'interested' | 'rejected' | 'interviewed' | 'hired'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SearchHistory {
  id: string
  user_id: string
  query: string
  search_type: 'candidate' | 'job'
  filters: SearchFilters | null
  results_count: number | null
  created_at: string
}

// 嵌套类型定义
export interface EducationRecord {
  degree: string
  institution: string
  field_of_study: string
  start_date: string
  end_date: string | null
  grade: string | null
  description: string | null
}

export interface ExperienceRecord {
  title: string
  company: string
  location: string | null
  start_date: string
  end_date: string | null
  description: string | null
  achievements: string[]
}

export interface CertificationRecord {
  name: string
  issuing_organization: string
  issue_date: string
  expiration_date: string | null
  credential_id: string | null
  credential_url: string | null
}

export interface LanguageRecord {
  language: string
  proficiency:
    | 'beginner'
    | 'elementary'
    | 'intermediate'
    | 'advanced'
    | 'native'
  certification: string | null
}

export interface ProjectRecord {
  name: string
  description: string
  tech_stack: string[]
  start_date?: string
  end_date?: string
  project_url?: string
  github_url?: string
}

export interface TeamInfoRecord {
  size?: string                    // 团队规模，如"10-15人"
  lead_background?: string         // 团队Leader背景
  team_culture?: string           // 团队文化
  tech_stack?: string[]           // 团队使用的技术栈
  work_style?: string             // 工作方式
  collaboration_tools?: string[]   // 协作工具
}

export interface InterviewProcessRecord {
  rounds?: string                 // 面试轮次，如"3轮"
  duration?: string               // 预计时长，如"2-3周"
  format?: string                 // 面试形式，如"线上+线下"
  preparation?: string            // 准备建议
  stages?: string[]               // 具体阶段，如["技术面试", "HR面试", "总监面试"]
}

export interface ContactInfoRecord {
  hr_name?: string               // HR姓名
  hr_email?: string              // HR邮箱
  hr_phone?: string              // HR电话
  hiring_manager_name?: string   // 招聘经理姓名
  hiring_manager_email?: string  // 招聘经理邮箱
  wechat?: string                // 微信号
  department_head?: string       // 部门负责人
}

// 搜索相关类型
export interface SearchFilters {
  location?: string
  experience_min?: number
  experience_max?: number
  salary_min?: number
  salary_max?: number
  skills?: string[]
  employment_type?: string
  status?: string
}

export interface SearchResult<T> {
  id: string
  data: T
  similarity: number
  created_at: string
  updated_at: string
}

export interface CandidateSearchResult extends SearchResult<Resume> {
  name: string
  email: string | null
  phone: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  years_of_experience: number | null
  expected_salary_min: number | null
  expected_salary_max: number | null
  skills: string[]
  // 🔥 新增字段：AI搜索增强
  summary: string | null
  relocation_preferences: string[] | null
  projects: ProjectRecord[] | null
  //
  file_url: string | null
  // 🔥 Rerank专用的丰富文本内容
  full_text_content?: string
}

export interface JobSearchResult extends SearchResult<Job> {
  title: string
  company: string
  location: string | null
  employment_type: string | null
  salary_min: number | null
  salary_max: number | null
  currency: string
  description: string | null
  skills_required: string[]
  experience_required: number | null
  // 🔥 新增字段：AI搜索增强
  job_summary: string | null
  team_info: TeamInfoRecord | null
  growth_opportunities: string[] | null
  work_environment: string | null
  company_culture: string | null
  remote_policy: string | null
  interview_process: InterviewProcessRecord | null
  contact_info: ContactInfoRecord | null
  urgency_level: 'urgent' | 'normal' | 'pipeline' | null
  expected_start_date: string | null
  // 🔥 Rerank专用的丰富文本内容
  full_text_content?: string
}

export interface MatchResult {
  id: string
  candidate_id: string
  job_id: string
  candidate_name: string
  candidate_title: string | null
  job_title: string
  job_company: string
  ai_score: number | null
  manual_score: number | null
  status: string
  created_at: string
}

export interface CandidateDetails extends Resume {
  total_matches: number
  total_interactions: number
  last_interaction_date: string | null
}

export interface SearchStats {
  total_searches: number
  candidate_searches: number
  job_searches: number
  avg_results_per_search: number
  most_common_location: string | null
  search_trends: Array<{
    date: string
    searches: number
  }>
}

// API请求/响应类型
export interface SearchRequest {
  query: string
  filters?: SearchFilters
  similarity_threshold?: number
  match_count?: number
}

export interface SearchResponse<T> {
  results: T[]
  total: number
  query: string
  filters: SearchFilters | null
  execution_time: number
}

export interface UploadResumeRequest {
  file: File
  candidate_id?: string
}

export interface UploadResumeResponse {
  success: boolean
  candidate_id: string
  file_url: string
  parsed_data: Resume
  message: string
}

export interface GenerateMatchesRequest {
  candidate_ids?: string[]
  job_ids?: string[]
  min_score?: number
}

export interface GenerateMatchesResponse {
  matches: Array<{
    candidate_id: string
    job_id: string
    score: number
    created: boolean
  }>
  total_generated: number
  execution_time: number
}

// 组件Props类型
export interface CandidateCardProps {
  candidate: CandidateSearchResult
  onView: (id: string) => void
  onMatch: (id: string) => void
  onContact: (id: string) => void
  showActions?: boolean
  compact?: boolean
}

export interface JobCardProps {
  job: JobSearchResult
  onView: (id: string) => void
  onMatch: (id: string) => void
  onEdit: (id: string) => void
  showActions?: boolean
  compact?: boolean
}

export interface SearchPanelProps {
  onSearch: (query: string, filters?: SearchFilters) => void
  searchType: 'candidate' | 'job'
  onSearchTypeChange: (type: 'candidate' | 'job') => void
  isLoading?: boolean
  placeholder?: string
}

export interface FilterPanelProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  searchType: 'candidate' | 'job'
  onReset: () => void
}

export interface InteractionLogProps {
  candidateId?: string
  jobId?: string
  interactions: Interaction[]
  onAddInteraction: (interaction: Partial<Interaction>) => void
  onUpdateInteraction: (id: string, updates: Partial<Interaction>) => void
  onDeleteInteraction: (id: string) => void
}

export interface MatchScoreProps {
  score: number
  type: 'ai' | 'manual'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export interface CopilotWidgetProps {
  context: {
    candidate?: Resume
    job?: Job
    interaction?: Interaction
  }
  onQuestion: (question: string) => void
  isLoading?: boolean
  suggestions?: string[]
}

// 表单类型
export interface CandidateFormData {
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
  education: EducationRecord[]
  experience: ExperienceRecord[]
  certifications: CertificationRecord[]
  languages: LanguageRecord[]
}

export interface JobFormData {
  title: string
  company: string
  location: string
  employment_type: string
  salary_min: number
  salary_max: number
  currency: string
  description: string
  requirements: string
  benefits: string
  skills_required: string[]
  experience_required: number
  education_required: string
  industry: string
  department: string
}

export interface InteractionFormData {
  type: string
  subject: string
  content: string
  scheduled_at: string
  candidate_id?: string
  job_id?: string
}

// 错误类型
export interface APIError {
  message: string
  code: string
  details?: Record<string, any>
}

// 分页类型
export interface PaginationParams {
  page: number
  limit: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}
 
export type JobEmploymentType = 
  | 'full-time'
  | 'part-time'
  | 'contract'
  | 'internship'
  | 'remote'
 