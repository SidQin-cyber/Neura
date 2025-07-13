'use client'

import { CandidateSearchResult, JobSearchResult } from '@/lib/context/search-context'
import { useState } from 'react'
import { CandidateCard } from './candidate-card'
import { JobCard } from './job-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface SearchResultsSectionProps {
  results: (CandidateSearchResult | JobSearchResult)[]
  searchType: 'candidate' | 'job'
  isLoading?: boolean
  onView?: (id: string) => void
  onMatch?: (id: string) => void
  onContact?: (id: string) => void
  onEdit?: (id: string) => void
  query?: string
  executionTime?: number
  totalResults?: number
}

export function SearchResultsSection({
  results,
  searchType,
  isLoading = false,
  onView = () => {},
  onMatch = () => {},
  onContact = () => {},
  onEdit = () => {},
  query,
  executionTime,
  totalResults
}: SearchResultsSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  const displayedResults = showAll ? results : results.slice(0, 6)
  const hasMore = results.length > 6
  const hiddenCount = results.length - 6

  const getAverageScore = () => {
    if (results.length === 0) return 0
    const sum = results.reduce((acc, result) => acc + (result.match_score || 0), 0)
    return Math.round(sum / results.length)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-6xl">🔍</div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            未找到匹配的{searchType === 'candidate' ? '候选人' : '职位'}
          </h3>
          <p className="text-gray-600">
            尝试调整搜索条件或使用不同的关键词
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 搜索结果头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {searchType === 'candidate' ? '候选人' : '职位'}搜索结果
          </h2>
          <Badge variant="secondary" className="text-sm">
            {results.length} 个结果
          </Badge>
          <Badge variant="outline" className="text-sm">
            平均匹配度 {getAverageScore()}%
          </Badge>
        </div>
        
        {/* 视图切换按钮 */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="text-xs"
          >
            网格视图
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="text-xs"
          >
            列表视图
          </Button>
        </div>
      </div>

      {/* 搜索信息 */}
      {query && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">搜索内容:</span> &ldquo;{query}&rdquo;
            {executionTime && (
              <span className="ml-4 text-blue-600">
                执行时间: {executionTime}ms
              </span>
            )}
          </p>
        </div>
      )}

      {/* 搜索结果网格 */}
      <div className={`grid gap-4 ${
        viewMode === 'grid' 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
          : 'grid-cols-1'
      }`}>
        {displayedResults.map((result) => {
          if (searchType === 'candidate') {
            const candidate = result as CandidateSearchResult
            return (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                simplified={viewMode === 'list'}
              />
            )
          } else {
            const job = result as JobSearchResult
            return (
              <JobCard
                key={job.id}
                job={job}
                simplified={viewMode === 'list'}
              />
            )
          }
        })}
      </div>

      {/* 显示更多按钮 */}
      {hasMore && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setShowAll(!showAll)}
            className="gap-2"
          >
            {showAll ? (
              <>
                <ChevronUp size={16} />
                收起部分结果
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                显示更多 ({hiddenCount} 个)
              </>
            )}
          </Button>
        </div>
      )}

      {/* 结果统计 */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span className="transform -translate-x-2">
            共找到 {results.length} 个{searchType === 'candidate' ? '候选人' : '职位'}
          </span>
          <span>
            {totalResults && totalResults > results.length && (
              <>数据库中共有 {totalResults} 个相关记录</>
            )}
          </span>
        </div>
      </div>
    </div>
  )
} 