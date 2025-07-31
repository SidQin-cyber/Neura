'use client'

import { Model } from '@/lib/types/models'
import { SearchFilters } from '@/lib/types/recruitment'
import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, RefreshCw, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { ModeSwitcher } from '../model-selector'
import { Button } from '../ui/button'
import { SearchFilterToggle } from './search-filter-toggle'

interface RecruitmentChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  query?: string
  stop: () => void
  append: (message: any) => void
  models?: Model[]
  /** Whether to show the scroll to bottom button */
  showScrollToBottomButton: boolean
  /** Reference to the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  /** Current search type */
  searchType: 'candidate' | 'job'
  /** Search type change handler */
  onSearchTypeChange: (type: 'candidate' | 'job') => void
  /** Search filters */
  searchFilters: SearchFilters
  /** Filter change handler */
  onFiltersChange: (filters: SearchFilters) => void
  /** Whether to show empty state */
  showEmptyState: boolean
}

export function RecruitmentChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  setMessages,
  query,
  stop,
  append,
  models,
  showScrollToBottomButton,
  scrollContainerRef,
  searchType,
  onSearchTypeChange,
  searchFilters,
  onFiltersChange,
  showEmptyState
}: RecruitmentChatPanelProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  
  // 滚动按钮动画状态
  const [isScrollButtonAnimating, setIsScrollButtonAnimating] = useState(false)

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    // 使用更短的延迟时间，只是为了避免输入法结束时的意外触发
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 50) // 进一步减少到50ms，几乎不影响用户体验
  }

  const handleNewSearch = () => {
    setMessages([])
    onFiltersChange({}) // 清空筛选条件
    router.push('/')
  }

  const isToolInvocationInProgress = () => {
    if (!messages.length) return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return false

    const parts = lastMessage.parts
    const lastPart = parts[parts.length - 1]

    return (
      lastPart?.type === 'tool-invocation' &&
      lastPart?.toolInvocation?.state === 'call'
    )
  }

  // if query is not empty, submit the query
  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      append({
        role: 'user',
        content: query
      })
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Scroll to the bottom of the container with button animation
  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      // 开始缩放动画
      setIsScrollButtonAnimating(true)
      
      // 滚动到底部
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
      
      // 在动画完成后重置状态（滚动动画大约需要500ms，我们给600ms）
      setTimeout(() => {
        setIsScrollButtonAnimating(false)
      }, 600)
    }
  }

  const getPlaceholderText = () => {
    if (searchType === 'candidate') {
      return '描述你要找的候选人，例如：5年Java开发经验，熟悉Spring框架，在北京...'
    } else {
      return '描述你要匹配的职位，例如：高级前端工程师，React开发，15-25K...'
    }
  }

  return (
    <div className="w-full">
      <div className="relative">
        {/* Scroll to bottom button */}
        {showScrollToBottomButton && messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`absolute -top-12 right-4 z-20 size-8 rounded-full shadow-md transition-transform duration-300 ease-out ${
              isScrollButtonAnimating ? 'animate-scale-out' : ''
            }`}
            onClick={handleScrollToBottom}
            title="滚动到底部"
          >
            <ChevronDown size={16} />
          </Button>
        )}

        <form onSubmit={handleSubmit} className="w-full relative">
          {/* Top edge blur fade effect - similar to Gemini */}
          {messages.length > 0 && (
            <div 
              className="absolute -top-8 left-0 right-0 h-8 pointer-events-none z-10"
              style={{
                background: 'linear-gradient(to top, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)'
              }}
            />
          )}

          <div className="relative flex flex-col w-full gap-3 bg-background rounded-3xl border border-input shadow-lg">
            <Textarea
              ref={inputRef}
              name="input"
              rows={1}
              maxRows={6}
              tabIndex={0}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={getPlaceholderText()}
              spellCheck={false}
              value={input}
              disabled={isLoading || isToolInvocationInProgress()}
              className="resize-none w-full min-h-14 bg-transparent border-0 px-6 py-4 text-base placeholder:text-gray-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              onChange={e => {
                handleInputChange(e)
              }}
              onKeyDown={e => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !isComposing &&
                  !enterDisabled
                ) {
                  if (input.trim().length === 0) {
                    e.preventDefault()
                    return
                  }
                  e.preventDefault()
                  const textarea = e.target as HTMLTextAreaElement
                  textarea.form?.requestSubmit()
                }
              }}
            />

            {/* Bottom menu area */}
            <div className="flex items-center justify-between px-6 pb-4">
              <div className="flex items-center gap-3">
                <ModeSwitcher onModeChange={(mode) => onSearchTypeChange(mode === 'candidates' ? 'candidate' : 'job')} />
                <SearchFilterToggle
                  searchType={searchType}
                  filters={searchFilters}
                  onFiltersChange={onFiltersChange}
                />
              </div>
              <div className="flex items-center gap-3">
                {messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNewSearch}
                    className="shrink-0 rounded-full group size-10"
                    type="button"
                    disabled={isLoading || isToolInvocationInProgress()}
                    title="新搜索"
                  >
                    <RefreshCw className="size-4 group-hover:rotate-180 transition-all duration-300" />
                  </Button>
                )}
                <Button
                  type={isLoading ? 'button' : 'submit'}
                  size={'icon'}
                  variant={'default'}
                  className={cn(
                    isLoading && 'animate-pulse', 
                    'rounded-full bg-primary hover:bg-primary/90 size-10'
                  )}
                  disabled={
                    (input.length === 0 && !isLoading) ||
                    isToolInvocationInProgress()
                  }
                  onClick={isLoading ? stop : undefined}
                  title={isLoading ? '停止搜索' : '开始搜索'}
                >
                  {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
} 