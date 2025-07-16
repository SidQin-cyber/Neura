import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  showValue?: boolean
  indeterminate?: boolean
  gradient?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, showValue = false, indeterminate = false, gradient = false, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
    
    // 渐变色样式
    const getProgressStyle = () => {
      if (indeterminate) {
        return {
          width: '100%',
          background: 'linear-gradient(90deg, transparent, var(--primary), transparent)'
        }
      }
      
      if (gradient) {
        return {
          width: `${percentage}%`,
          background: `linear-gradient(90deg, 
            rgba(167, 139, 250, 0.15) 0%,
            rgba(167, 139, 250, 0.4) 25%,
            rgba(147, 114, 246, 0.65) 50%,
            rgba(109, 88, 235, 0.85) 75%,
            rgba(79, 70, 229, 1) 100%
          )`,
          position: 'relative' as const,
          overflow: 'hidden' as const
        }
      }
      
      return {
        width: `${percentage}%`
      }
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          'relative h-1.5 w-full overflow-hidden rounded-full',
          gradient ? 'bg-slate-50/80 backdrop-blur-sm' : 'bg-secondary',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out rounded-full relative overflow-hidden',
            indeterminate && 'animate-pulse',
            !gradient && !indeterminate && 'bg-primary',
            gradient && 'shadow-sm'
          )}
          style={getProgressStyle()}
        >
          {/* Shimmer流动效果 - 仅在gradient模式下显示 */}
          {gradient && percentage > 8 && (
            <div 
              className="absolute inset-0 overflow-hidden"
            >
              <div
                className="absolute h-full"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 25%, rgba(255, 255, 255, 0.7) 50%, rgba(255, 255, 255, 0.3) 75%, transparent 100%)',
                  width: '40%',
                  height: '100%',
                  opacity: 0.8,
                  animation: 'shimmer 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
                  animationDelay: '0.5s',
                  borderRadius: 'inherit'
                }}
              />
            </div>
          )}
        </div>
        {showValue && !indeterminate && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-primary-foreground">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress } 