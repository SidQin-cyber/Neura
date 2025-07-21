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
  
  // 安全检查：确保candidates是有效的数组
  if (!candidates || !Array.isArray(candidates)) {
    console.error('CandidateResultsSection: candidates is not a valid array', candidates)
    return (
      <div className="text-red-500 p-4">
        错误：候选人数据格式不正确
      </div>
    )
  }
  
  console.log('🎯 CandidateResultsSection rendering:', {
    candidatesCount: candidates.length,
    firstCandidate: candidates[0] ? {
      id: candidates[0].id,
      name: candidates[0].name,
      hasRequiredFields: !!(candidates[0].name && candidates[0].id)
    } : null
  })
  
  const resultsContent = (
    <div className="">
      {/* 简单的结果统计 - 向左移动一些距离 */}
      <div className="text-sm text-muted-foreground mb-6 -ml-3">
        找到 {candidates.length} 个候选人
        {query && (
          <span className="ml-2">
            搜索：&ldquo;{query}&rdquo;
          </span>
        )}
      </div>

      {/* 候选人列表 - 简化版，与统计文字左对齐 */}
      {candidates.length > 0 ? (
        <div className="space-y-4">
          {candidates.map((candidate, index) => {
            try {
              return (
                <CandidateCard
                  key={candidate.id || `candidate-${index}`}
                  candidate={candidate}
                  simplified={true}
                />
              )
            } catch (error) {
              console.error('Error rendering candidate card:', error, candidate)
              return (
                <div key={`error-${index}`} className="text-red-500 p-2 border border-red-300 rounded">
                  候选人 #{index + 1} 渲染失败
                </div>
              )
            }
          })}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-4">
          没有找到符合条件的候选人
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