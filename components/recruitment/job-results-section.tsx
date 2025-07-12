'use client'

import { JobCard } from './job-card'
import { CollapsibleMessage } from '@/components/collapsible-message'
import { JobSearchResult } from '@/lib/context/search-context'

interface JobResultsSectionProps {
  jobs: JobSearchResult[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  query?: string
  totalCount?: number
}

export function JobResultsSection({
  jobs,
  isOpen,
  onOpenChange,
  query,
  totalCount
}: JobResultsSectionProps) {
  
  const resultsContent = (
    <div className="space-y-4">
      {/* 简单的结果统计 */}
      <div className="text-sm text-muted-foreground mb-6">
        找到 {jobs.length} 个职位
        {query && (
                  <span className="ml-2">
          搜索：&ldquo;{query}&rdquo;
        </span>
        )}
      </div>

      {/* 职位列表 - 简化版 */}
      {jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              simplified={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-4">
          未找到匹配的职位，尝试调整搜索条件。
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