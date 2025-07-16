'use client'

import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, Square } from 'lucide-react'

import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { useArtifact } from './artifact/artifact-context'

import { ModeSwitcher } from './model-selector'
import { CompactFilterPanel } from './compact-filter-panel'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { useSearch } from '@/lib/context/search-context'
import { universalSearch } from '@/lib/api/search'
import { useLanguage } from '@/lib/context/language-context'

// 生成唯一ID的函数
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// 打字机效果组件
function TypewriterText({ text, delay = 100, startDelay = 1000 }: { text: string, delay?: number, startDelay?: number }) {
  const [displayedText, setDisplayedText] = useState('')
  const [showCursor, setShowCursor] = useState(false)
  const animationRef = useRef<number>()
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    let startTime: number
    let charIndex = 0

    const startTimer = setTimeout(() => {
      setShowCursor(true)
      
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime

        const elapsed = currentTime - startTime
        const targetIndex = Math.floor(elapsed / delay)

        if (targetIndex > charIndex && charIndex < text.length) {
          charIndex = Math.min(targetIndex, text.length)
          setDisplayedText(text.slice(0, charIndex))
        }

        if (charIndex < text.length) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          // 动画完成，3秒后隐藏光标
          setTimeout(() => setShowCursor(false), 3000)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }, startDelay)

    timeoutRef.current = startTimer

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [text, delay, startDelay])

  return (
    <span className="text-lg font-normal text-text-secondary typewriter-container">
      {displayedText}
      {showCursor && (
        <span className="cursor-blink text-text-secondary">|</span>
      )}
    </span>
  )
}

interface ChatPanelProps {
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
}

export function ChatPanel({
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
  scrollContainerRef
}: ChatPanelProps) {


  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const { close: closeArtifact } = useArtifact()
  const { searchMode, setSearchMode, filters, setFilters, setIsLoading } = useSearch()
  const { t } = useLanguage()

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 50)
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

  // 处理搜索提交 - 简化版本：骨架图 -> 一次性显示结果
  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (input.trim().length === 0) return
    
    const userQuery = input.trim()
    setIsLoading(true)
    
    try {
      // 1. 添加用户消息（这会触发 ChatMessages 显示骨架屏）
      const userMessage = {
        role: 'user' as const,
        content: userQuery,
        id: generateId()
      }
      append(userMessage)
      
      // 2. 清空输入框
      handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>)
      
      // 3. 执行搜索（后台处理召回/重排，不显示中间状态）
      const enhancedQuery = filters.specialReq 
        ? `${userQuery} ${filters.specialReq}` 
        : userQuery

      const { universalSearchStreaming, parseSearchStream } = await import('@/lib/api/search')
      
      const response = await universalSearchStreaming({
        query: enhancedQuery,
        mode: searchMode,
        filters: {
          location: filters.location,
          experience: '',
          salary: filters.salaryMin && filters.salaryMax 
            ? `${filters.salaryMin}-${filters.salaryMax}` 
            : filters.salaryMin || filters.salaryMax || '',
          skills: [],
          education: filters.education
        }
      })
      
      if (response.success && response.stream) {
        // 4. 静默处理流式数据，只在完成时显示结果
        await parseSearchStream(
          response.stream,
          // onChunk: 只打印日志，不更新UI
          (chunk) => {
            console.log('📡 流式更新:', chunk.type, chunk.data?.length || '')
          },
          // onComplete: 一次性显示所有结果
          (finalResults) => {
            console.log('✅ 搜索完成, 总结果数:', finalResults.length)
            
            const assistantMessage = {
              role: 'assistant' as const,
              content: finalResults.length > 0 
                ? finalResults as any 
                : '抱歉，没有找到符合您要求的结果。请尝试调整搜索条件或使用其他关键词。',
              id: generateId()
            }
            append(assistantMessage)
            setIsLoading(false) // 隐藏骨架屏，显示结果
          },
          // onError: 显示错误信息
          (error) => {
            console.error('搜索失败:', error)
            const errorMessage = {
              role: 'assistant' as const,
              content: `❌ 搜索失败：${error}`,
              id: generateId()
            }
            append(errorMessage)
            setIsLoading(false)
          }
        )
      } else {
        throw new Error(response.error || '搜索请求失败')
      }
    } catch (error: any) {
      console.error('搜索错误:', error)
      const errorMessage = {
        role: 'assistant' as const,
        content: `❌ 搜索过程中出现错误：${error.message}`,
        id: generateId()
      }
      append(errorMessage)
      setIsLoading(false)
    }
  }

  // if query is not empty, submit the query
  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      append({
        role: 'user',
        content: query,
        id: generateId()
      })
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Scroll to the bottom of the container
  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  // 动态placeholder
  const getPlaceholder = () => {
    switch (searchMode) {
      case 'candidates':
        return t('chat.placeholder.candidates')
      case 'jobs':
        return t('chat.placeholder.jobs')
      default:
        return 'Ask a question...'
    }
  }

  return (
    <div
      className={cn(
        'w-full group/form-container shrink-0',
        messages.length > 0 ? 'sticky bottom-0 px-2 pb-12' : 'px-6 pb-12'
      )}
    >
      {messages.length === 0 && (
        <div className="mb-10 flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
          <div className="max-w-3xl w-full mx-auto flex flex-col items-center">
            <h1 className="text-2xl font-heading text-text-primary leading-relaxed animate-fade-in-up">
              Hi, I&apos;m <span className="text-[#8a5cf6] dark:text-[#a78bfa]">N</span>eura.
            </h1>
            <div className="mt-6 min-h-[1.75rem] flex items-center justify-center">
              <TypewriterText 
                text="Always here when you need me." 
                delay={80} 
                startDelay={1500}
              />
            </div>
          </div>
        </div>
      )}
      <form
        onSubmit={handleSearchSubmit}
        className={cn('max-w-3xl w-full mx-auto relative')}
      >
        {/* Top edge blur fade effect - similar to Gemini */}
        {messages.length > 0 && (
          <div 
            className="absolute -top-8 left-0 right-0 h-8 pointer-events-none z-10"
            style={{
              background: 'linear-gradient(to top, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)'
            }}
          />
        )}

        {/* Scroll to bottom button - only shown when showScrollToBottomButton is true */}
        {showScrollToBottomButton && messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md"
            onClick={handleScrollToBottom}
            title="Scroll to bottom"
          >
            <ChevronDown size={16} />
          </Button>
        )}

        <div className="relative flex flex-col w-full gap-2 bg-white rounded-3xl border border-gray-200 overflow-hidden">
          <Textarea
            ref={inputRef}
            name="input"
            rows={2}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={getPlaceholder()}
            spellCheck={false}
            value={input}
            disabled={isLoading || isToolInvocationInProgress()}
            className="resize-none w-full min-h-12 bg-transparent border-0 px-4 pt-5 pb-3 text-base placeholder:text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <ModeSwitcher onModeChange={setSearchMode} />
              <CompactFilterPanel 
                filters={filters}
                onFiltersChange={setFilters}
                searchMode={searchMode}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type={isLoading ? 'button' : 'submit'}
                size={'icon'}
                variant={'outline'}
                className={cn(
                  isLoading && 'animate-pulse',
                  'rounded-full',
                  input.trim().length > 0 && !isLoading ? 'bg-gray-700 text-white border-gray-700 hover:bg-gray-600' : ''
                )}
                disabled={
                  (input.length === 0 && !isLoading) ||
                  isToolInvocationInProgress()
                }
                onClick={isLoading ? stop : undefined}
              >
                {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
              </Button>
            </div>
          </div>
        </div>


      </form>
    </div>
  )
}
