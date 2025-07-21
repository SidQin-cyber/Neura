import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from './ui/collapsible'
import { IconLogo, Logo } from './ui/icons'
import { Separator } from './ui/separator'

interface CollapsibleMessageProps {
  children: React.ReactNode
  role: 'user' | 'assistant'
  isCollapsible?: boolean
  isOpen?: boolean
  header?: React.ReactNode
  onOpenChange?: (open: boolean) => void
  showBorder?: boolean
  showIcon?: boolean
}

export function CollapsibleMessage({
  children,
  role,
  isCollapsible = false,
  isOpen = true,
  header,
  onOpenChange,
  showBorder = true,
  showIcon = true
}: CollapsibleMessageProps) {
  const content = <div className="flex-1">{children}</div>

  // 用户消息和助手消息的不同布局
  if (role === 'user') {
    // 用户消息：右对齐，去掉头像，使用较浅的灰色背景，减少宽度并向左平移
    return (
      <div className="flex justify-end mb-6 mr-12">
        <div className="max-w-[65%]">
          <div className="bg-gray-100 text-gray-900 rounded-2xl px-4 py-2 break-words text-base">
            {content}
          </div>
        </div>
      </div>
    )
  }

  // 助手消息：左对齐
  return (
    <div className="flex items-start mb-6">
      {showIcon && (
        <div className="relative flex flex-col items-start mr-3 -mt-7 -ml-5">
          <div className="w-16">
            <Logo className="!w-16 !h-16 transform -translate-x-2" />
          </div>
        </div>
      )}

      {isCollapsible ? (
        <div
          className={cn(
            'flex-1 rounded-2xl p-4 break-words overflow-wrap-anywhere',
            showBorder && 'border border-border/50'
          )}
          style={{ maxWidth: '645px' }}
        >
          <Collapsible
            open={isOpen}
            onOpenChange={onOpenChange}
            className="w-full"
          >
            <div className="flex items-center justify-between w-full gap-2">
              {header && <div className="text-sm w-full">{header}</div>}
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="rounded-md p-1 hover:bg-accent group"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down text-base break-words overflow-wrap-anywhere">
              <Separator className="my-4 border-border/50" />
              {content}
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : (
        <div className="flex-1 rounded-2xl px-0 text-base break-words overflow-wrap-anywhere" style={{ maxWidth: '645px' }}>
          {content}
        </div>
      )}
    </div>
  )
}
