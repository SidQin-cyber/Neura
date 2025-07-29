'use client'

import { JobCardOptimized } from './job-card-optimized'
import { CollapsibleMessage } from '@/components/collapsible-message'
import { JobSearchResult } from '@/lib/context/search-context'
import { MessageSkeleton } from '@/components/default-skeleton'
import { useLanguage } from '@/lib/context/language-context'

interface JobResultsSectionProps {
  jobs: JobSearchResult[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  query?: string
  totalCount?: number
  isLoading?: boolean
}

export function JobResultsSection({
  jobs,
  isOpen,
  onOpenChange,
  query,
  totalCount,
  isLoading = false
}: JobResultsSectionProps) {
  const { t } = useLanguage()
  
  // 如果正在加载，显示消息骨架屏
  if (isLoading) {
    return <MessageSkeleton />
  }
  
  const resultsContent = (
    <div className="">
      {/* 简单的结果统计 - 向左移动一些距离 */}
      <div className="text-sm text-muted-foreground mb-6 -ml-3">
        {t('search.found.jobs', { count: jobs.length })}
        {query && (
                  <span className="ml-2">
          搜索：&ldquo;{query}&rdquo;
        </span>
        )}
      </div>

      {/* 职位列表 - 简化版，与统计文字左对齐 */}
      {jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCardOptimized
              key={job.id}
              job={job}
            />
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-4">
          {t('search.noResults.jobs')}
        </div>
      )}
    </div>
  )

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={false}
      isOpen={true}
      showBorder={false}
      showIcon={true}
    >
      {resultsContent}
    </CollapsibleMessage>
  )
} 