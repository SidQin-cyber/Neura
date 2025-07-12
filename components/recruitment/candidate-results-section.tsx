'use client'

import { CandidateCard } from './candidate-card'
import { CollapsibleMessage } from '@/components/collapsible-message'
import { CandidateSearchResult } from '@/lib/context/search-context'

interface CandidateResultsSectionProps {
  candidates: CandidateSearchResult[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  query?: string
  totalCount?: number
}

export function CandidateResultsSection({
  candidates,
  isOpen,
  onOpenChange,
  query,
  totalCount
}: CandidateResultsSectionProps) {
  
  const resultsContent = (
    <div className="space-y-4">
      {/* 简单的结果统计 */}
      <div className="text-sm text-muted-foreground mb-6">
        找到 {candidates.length} 位候选人
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
          未找到匹配的候选人，尝试调整搜索条件。
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