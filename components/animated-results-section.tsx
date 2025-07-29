'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CandidateCard } from './recruitment/candidate-card'
import { JobCardOptimized } from './recruitment/job-card-optimized'
import { CollapsibleMessage } from './collapsible-message'
import { CandidateSearchResult, JobSearchResult } from '@/lib/context/search-context'

interface AnimatedResultsSectionProps {
  results: (CandidateSearchResult | JobSearchResult)[]
  searchType: 'candidates' | 'jobs'
  query?: string
  isReady: boolean // 控制何时开始显示结果
}

export function AnimatedResultsSection({
  results,
  searchType,
  query,
  isReady
}: AnimatedResultsSectionProps) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // ✨ 过滤掉匹配度为 0% 的结果
  const filteredResults = results.filter(result => {
    // 获取匹配分数 - 检查实际可用的属性
    const score = (result as any).match_score ?? 
                  ((result as any).similarity ? Math.round((result as any).similarity * 100) : 0)
    
    // 只显示匹配度大于 0% 的结果
    return score > 0
  })

  // 🎯 智能检测：是否为精确匹配或少量结果
  const isExactMatch = filteredResults.length === 1 && 
    filteredResults.some(result => (result as any).match_score === 100)
  const isFewResults = filteredResults.length <= 2
  const shouldUseFastAnimation = isExactMatch || isFewResults

  useEffect(() => {
    if (!isReady || filteredResults.length === 0) {
      setVisibleCount(0)
      setShowSummary(false)
      setIsTransitioning(false)
      return
    }

    // 🚀 优化的动画流程：更短的延迟，更连贯的过渡
    setIsTransitioning(true)
    
    // 第一步：显示总结信息（提前显示，减少等待感）
    const summaryTimer = setTimeout(() => {
      setShowSummary(true)
    }, shouldUseFastAnimation ? 30 : 60)

    // 第二步：开始显示卡片（与总结信息几乎同时）
    const cardsTimer = setTimeout(() => {
      if (shouldUseFastAnimation) {
        // 快速模式：直接显示所有结果
        setVisibleCount(filteredResults.length)
        setIsTransitioning(false)
      } else {
        // 标准模式：优化的逐个显示
        let currentCount = 0
        
        const showNextCard = () => {
          if (currentCount < filteredResults.length) {
            setVisibleCount(currentCount + 1)
            currentCount++
            
            // 更紧密的时间间隔
            const delay = currentCount <= 3 ? 120 : 150
            setTimeout(showNextCard, delay)
          } else {
            setIsTransitioning(false)
          }
        }

        showNextCard()
      }
    }, shouldUseFastAnimation ? 100 : 200)

    return () => {
      clearTimeout(summaryTimer)
      clearTimeout(cardsTimer)
    }
  }, [isReady, filteredResults.length, shouldUseFastAnimation])

  // 如果没有任何结果（包括过滤后），显示空状态
  if (filteredResults.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <div className="text-5xl opacity-50">🔍</div>
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-gray-800">
            未找到匹配的{searchType === 'candidates' ? '候选人' : '职位'}
          </h3>
          <p className="text-sm text-gray-600">
            {results.length > 0 ? 
              '所有结果的匹配度都为 0%，请尝试调整搜索条件' : 
              '尝试使用不同的关键词或调整筛选条件'
            }
          </p>
        </div>
      </div>
    )
  }

  const averageScore = filteredResults.length > 0 
    ? Math.round(filteredResults.reduce((sum, result) => {
        const score = (result as any).match_score ?? 
                      ((result as any).similarity ? Math.round((result as any).similarity * 100) : 0)
        return sum + score
      }, 0) / filteredResults.length)
    : 0

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={false}
      isOpen={true}
      showBorder={false}
      showIcon={true}
    >
      {/* 🎯 优化的整体容器 - 带平滑淡入动画 */}
      <div className={cn(
        "space-y-4 opacity-0 animate-results-fade-in",
        isReady && "animate-results-fade-in"
      )}>
        {/* 总结信息 - 带独立的滑入动画 */}
        <div className={cn(
          "text-sm text-gray-600 mb-6 -ml-3 opacity-0",
          showSummary && "animate-summary-slide-in"
        )}>
          找到 <span className="font-medium text-gray-900">{filteredResults.length}</span> 个匹配的{searchType === 'candidates' ? '候选人' : '职位'}
          {results.length !== filteredResults.length && (
            <span className="text-gray-500 ml-2">
              (已过滤 {results.length - filteredResults.length} 个低匹配结果)
            </span>
          )}
          {isExactMatch && (
            <span className="inline-flex items-center px-2 py-0.5 ml-2 text-xs font-medium text-green-700 bg-green-50 rounded-full border border-green-200">
              精确匹配
            </span>
          )}
        </div>

        {/* 结果列表 - 优化的卡片动画 */}
        {filteredResults.length > 0 && (
          <div className="space-y-4">
            {filteredResults.map((result, index) => {
              const isVisible = index < visibleCount
              // 🎯 优化的动画延迟计算
              const baseDelay = shouldUseFastAnimation ? 80 : 150
              const animationDelay = Math.min(index * baseDelay, shouldUseFastAnimation ? 200 : 600)

              return (
                <div
                  key={result.id || `result-${index}`}
                  className={cn(
                    "opacity-0 transition-all ease-out",
                    shouldUseFastAnimation ? "duration-500" : "duration-700",
                    isVisible && "animate-card-smooth-enter"
                  )}
                  style={{
                    animationDelay: isVisible ? `${animationDelay}ms` : '0ms'
                  }}
                >
                  {searchType === 'candidates' ? (
                    <CandidateCard
                      candidate={result as CandidateSearchResult}
                      simplified={true}
                    />
                  ) : (
                    <JobCardOptimized
                      job={result as JobSearchResult}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 🎯 优化：精确匹配或少量结果时，不显示占位符 */}
        {!shouldUseFastAnimation && visibleCount < filteredResults.length && (
          <div className="space-y-4">
            {Array.from({ length: Math.min(2, filteredResults.length - visibleCount) }).map((_, i) => (
              <div
                key={`loading-${i}`}
                className="animate-pulse bg-gray-100 rounded-2xl h-64 opacity-50"
              />
            ))}
          </div>
        )}
      </div>
    </CollapsibleMessage>
  )
} 