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
    <div className="bg-white rounded-lg px-6 py-4 -ml-8 transition-all duration-200 hover:bg-gray-50/50">
      {/* 标题区域 */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 space-y-2">
          {/* 主标题 */}
          <ShimmerElement className="h-5 w-3/4" />
          {/* 副标题 */}
          <ShimmerElement className="h-4 w-1/2" />
        </div>
        {/* 右侧徽章位置 */}
        <ShimmerElement className="h-6 w-16 rounded-full" />
      </div>

      {/* 信息行 */}
      <div className="space-y-2 mb-3">
        <ShimmerElement className="h-3 w-2/3" />
        <ShimmerElement className="h-3 w-1/2" />
      </div>

      {/* 标签行 */}
      <div className="flex flex-wrap gap-2">
        <ShimmerElement className="h-5 w-16 rounded-full" />
        <ShimmerElement className="h-5 w-20 rounded-full" />
        <ShimmerElement className="h-5 w-12 rounded-full" />
        {variant === 'job' && (
          <ShimmerElement className="h-5 w-14 rounded-full" />
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
