'use client'

import { cn } from '@/lib/utils'
import { IconLogo, Logo } from '@/components/ui/icons'

interface DefaultSkeletonProps {
  variant: 'candidate' | 'job'
  count?: number
}

// 闪烁动画元素
const ShimmerElement = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "relative overflow-hidden bg-gray-200 rounded-lg",
      "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
      className
    )}
    {...props}
  />
)

// 消息骨架屏组件
export const MessageSkeleton = () => {
  return (
    <div className="flex items-start mb-6">
      <div className="relative flex flex-col items-start mr-3 -mt-7 -ml-5">
        <div className="w-16">
          <Logo className="!w-16 !h-16 transform -translate-x-2" />
        </div>
      </div>
      <div className="flex-1 rounded-2xl px-0 -ml-4">
        <div className="space-y-3">
          <ShimmerElement className="h-4 w-32 transform -translate-x-2" />
        </div>
      </div>
    </div>
  )
}

const SingleCardSkeleton = ({ variant }: { variant: 'candidate' | 'job' }) => {
  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer -ml-8">
      {/* 标题区域 - 匹配候选人卡片布局 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          {/* 主标题（姓名/职位） */}
          <ShimmerElement className="h-[1.375rem] w-20" />
          {/* 副标题（职位/公司） */}
          <ShimmerElement className="h-4 w-32" />
        </div>
        {/* 右侧匹配度徽章 */}
        <ShimmerElement className="h-7 w-14 rounded-full flex-shrink-0" />
      </div>

      {/* 基本信息行 - 位置和经验 */}
      <div className="flex flex-wrap items-center gap-4 mt-2">
        <ShimmerElement className="h-4 w-16" />
        <ShimmerElement className="h-4 w-20" />
        {variant === 'job' && (
          <ShimmerElement className="h-4 w-24" />
        )}
      </div>

      {/* 技能标签行 */}
      <div className="flex flex-wrap gap-2 mt-2">
        <ShimmerElement className="h-6 w-14 rounded-full" />
        <ShimmerElement className="h-6 w-16 rounded-full" />
        <ShimmerElement className="h-6 w-12 rounded-full" />
        {variant === 'job' && (
          <ShimmerElement className="h-6 w-14 rounded-full" />
        )}
      </div>
    </div>
  )
}

export function DefaultSkeleton({ variant, count = 3 }: DefaultSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <SingleCardSkeleton key={index} variant={variant} />
      ))}
    </div>
  )
}

// 为了保持兼容性，导出SearchSkeleton
export function SearchSkeleton() {
  return (
    <div className="flex flex-wrap gap-2 pb-0.5">
      {[...Array(4)].map((_, index) => (
        <div
          key={index}
          className="w-[calc(50%-0.5rem)] md:w-[calc(25%-0.5rem)]"
        >
          <ShimmerElement className="h-20 w-full" />
        </div>
      ))}
    </div>
  )
}

export default DefaultSkeleton
