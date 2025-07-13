'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Briefcase, Users } from 'lucide-react'
import { useLanguage } from '@/lib/context/language-context'

interface SearchSuggestion {
  heading: string
  message: string
  type: 'candidate' | 'job'
}

const candidateSuggestions: SearchSuggestion[] = [
  {
    heading: '5年Java开发经验，熟悉Spring框架',
    message: '寻找有5年Java开发经验的高级工程师，熟悉Spring框架，有微服务架构经验',
    type: 'candidate'
  },
  {
    heading: '前端React专家，3年以上经验',
    message: '需要前端开发工程师，精通React和TypeScript，有移动端开发经验',
    type: 'candidate'
  },
  {
    heading: '产品经理，有B端产品设计经验',
    message: '寻找产品经理，有B端SaaS产品设计经验，懂用户研究和数据分析',
    type: 'candidate'
  },
  {
    heading: '数据分析师，精通Python和SQL',
    message: '需要数据分析师，精通Python、SQL和机器学习，有电商或金融行业经验',
    type: 'candidate'
  }
]

const jobSuggestions: SearchSuggestion[] = [
  {
    heading: '全栈开发工程师，创业公司机会',
    message: '全栈开发工程师职位，Node.js + React技术栈，创业公司，股权激励',
    type: 'job'
  },
  {
    heading: '高级UI设计师，电商行业',
    message: '高级UI/UX设计师，电商行业，负责移动端产品设计，15-25K',
    type: 'job'
  },
  {
    heading: '技术总监，带团队管理经验',
    message: '技术总监职位，需要5年以上管理经验，负责技术团队建设和架构设计',
    type: 'job'
  },
  {
    heading: '运营专员，社交媒体运营',
    message: '运营专员，负责社交媒体运营和内容营销，有成功案例优先',
    type: 'job'
  }
]

interface RecruitmentEmptyScreenProps {
  submitMessage: (message: string) => void
  searchType: 'candidate' | 'job'
  onSearchTypeChange: (type: 'candidate' | 'job') => void
  className?: string
}

export function RecruitmentEmptyScreen({
  submitMessage,
  searchType,
  onSearchTypeChange,
  className
}: RecruitmentEmptyScreenProps) {
  const { t } = useLanguage()
  const suggestions = searchType === 'candidate' ? candidateSuggestions : jobSuggestions
  const oppositeType = searchType === 'candidate' ? 'job' : 'candidate'
  
  return (
    <div className={`mx-auto w-full transition-all ${className}`}>
      <div className="bg-background p-2">
        {/* 搜索类型切换提示 */}
        <div className="mb-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            {t('mode.currentMode')}: {searchType === 'candidate' ? t('mode.candidates') : t('mode.jobs')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSearchTypeChange(oppositeType)}
            className="text-xs"
          >
            {oppositeType === 'candidate' ? (
              <>
                <Users className="h-3 w-3 mr-1" />
                切换到候选人搜索
              </>
            ) : (
              <>
                <Briefcase className="h-3 w-3 mr-1" />
                切换到职位搜索
              </>
            )}
          </Button>
        </div>

        {/* 搜索建议 */}
        <div className="mt-2 flex flex-col items-start space-y-2 mb-4">
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-base text-left"
              onClick={() => submitMessage(suggestion.message)}
            >
              <ArrowRight size={16} className="mr-2 text-muted-foreground flex-shrink-0" />
              <span className="text-left">{suggestion.heading}</span>
            </Button>
          ))}
        </div>

        {/* 使用提示 */}
        <div className="text-center text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
          <p>💡 提示：描述你的具体需求，我们的AI会帮你找到最匹配的{searchType === 'candidate' ? '候选人' : '职位'}</p>
        </div>
      </div>
    </div>
  )
} 