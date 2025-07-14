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
    // 使用更短的延迟时间，只是为了避免输入法结束时的意外触发
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 50) // 进一步减少到50ms，几乎不影响用户体验
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

  // 处理搜索提交
  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (input.trim().length === 0) return
    
    setIsLoading(true)
    
    try {
      // 1. 添加用户消息
      const userMessage = {
        role: 'user' as const,
        content: input.trim(),
        id: generateId()
      }
      append(userMessage)
      
      // 清空输入框
      handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>)
      
      // 2. 执行搜索
      const enhancedQuery = filters.specialReq 
        ? `${input} ${filters.specialReq}` 
        : input

      const response = await universalSearch({
        query: enhancedQuery,
        mode: searchMode,
        filters: {
          location: filters.location,
          experience: '', // 可以后续添加
          salary: filters.salaryMin && filters.salaryMax 
            ? `${filters.salaryMin}-${filters.salaryMax}` 
            : filters.salaryMin || filters.salaryMax || '',
          skills: [], // 可以后续添加
          education: filters.education
        }
      })
      
      // 3. 添加助手消息（包含搜索结果）
      if (response.success && response.data) {
        const assistantMessage = {
          role: 'assistant' as const,
          content: response.data, // 直接将搜索结果作为 content
          id: generateId()
        }
        append(assistantMessage)
      } else {
        const errorMessage = {
          role: 'assistant' as const,
          content: '搜索过程中出现错误，请重试。',
          id: generateId()
        }
        append(errorMessage)
        console.error('搜索失败:', response.error)
      }
    } catch (error) {
      const errorMessage = {
        role: 'assistant' as const,
        content: '搜索过程中出现错误，请重试。',
        id: generateId()
      }
      append(errorMessage)
      console.error('搜索错误:', error)
    } finally {
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
            <h1 className="text-2xl font-semibold text-gray-300 leading-relaxed">
              Hi, I&apos;m Neura.
            </h1>
            <p className="text-lg font-normal text-gray-300 mt-3">
              Let&apos;s find your perfect candidate.
            </p>
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
              background: 'linear-gradient(to top, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%)'
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
