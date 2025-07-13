'use client'

import { CandidateCard } from './candidate-card'
import { CollapsibleMessage } from '@/components/collapsible-message'
import { CandidateSearchResult } from '@/lib/context/search-context'
import { MessageSkeleton } from '@/components/default-skeleton'
import { useLanguage } from '@/lib/context/language-context'

interface CandidateResultsSectionProps {
  candidates: CandidateSearchResult[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  query?: string
  totalCount?: number
  isLoading?: boolean
}

export function CandidateResultsSection({
  candidates,
  isOpen,
  onOpenChange,
  query,
  totalCount,
  isLoading = false
}: CandidateResultsSectionProps) {
  const { t } = useLanguage()
  
  // 如果正在加载，显示消息骨架屏
  if (isLoading) {
    return <MessageSkeleton />
  }
  
  const resultsContent = (
    <div className="space-y-4">
      {/* 简单的结果统计 */}
      <div className="text-sm text-muted-foreground mb-6">
        {t('search.found.candidates', { count: candidates.length })}
        {query && (
                  <span className="ml-2">
          搜索：&ldquo;{query}&rdquo;
        </span>
        )}
      </div>

      {/* 候选人列表 - 简化版 */}
      {candidates.length > 0 ? (
        <div className="space-y-4">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              simplified={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-4">
          {t('search.noResults.candidates')}
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