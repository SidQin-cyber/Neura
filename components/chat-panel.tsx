'use client'

import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, Square, Zap } from 'lucide-react'

import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'


import { ModeSwitcher } from './model-selector'
import { Button } from './ui/button'
import { IconLogo } from './ui/icons'
import { useSearch } from '@/lib/context/search-context'
import { universalSearch, universalSearchStreaming, parseSearchStream } from '@/lib/api/search'
import { useLanguage } from '@/lib/context/language-context'
import { getCookie } from '@/lib/utils/cookies'

// 生成唯一ID的函数
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// 定义解析结果的类型
interface ParsedQuery {
  search_type: 'candidate' | 'job'
  role: string[]
  skills_must: string[]
  skills_related: Array<{ skill: string; confidence: number }>
  industry: string[]
  location: string[]
  experience_min: number | null
  experience_max: number | null
  education: string[]
  salary_min: number | null
  salary_max: number | null
  company: string[]
  gender: string | null
  age_min: number | null
  age_max: number | null
  rewritten_query: string
}

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
  const overlayRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends

  const { searchMode, setSearchMode, setIsLoading } = useSearch()
  const { t } = useLanguage()
  
  // 语句解析相关状态
  const [isParsing, setIsParsing] = useState(false)
  const [isErasing, setIsErasing] = useState(false)
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null)

  // 添加原始用户输入保护
  const [originalUserInput, setOriginalUserInput] = useState<string>('')
  const [isProcessingParse, setIsProcessingParse] = useState(false)

  // 确保在组件挂载时立即同步cookie中的搜索模式
  useEffect(() => {
    const savedMode = getCookie('searchMode') as 'candidates' | 'jobs'
    if (savedMode && (savedMode === 'candidates' || savedMode === 'jobs') && savedMode !== searchMode) {
      console.log('🔄 ChatPanel: 同步cookie中的搜索模式:', savedMode)
      setSearchMode(savedMode)
    }
  }, [searchMode, setSearchMode])

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 50)
  }

  // 处理语句解析
  const handleParseQuery = async () => {
    if (!input.trim() || isParsing || isErasing) return

    const originalText = input.trim()
    
    // 保护原始用户输入
    setOriginalUserInput(originalText)
    setIsProcessingParse(true)
    setIsParsing(true)
    
    try {
      console.log('🔍 开始解析用户语句:', originalText)
      
      // 开始擦除动画
      setIsErasing(true)
      await eraseText()
      
      // 发送解析请求
      const response = await fetch('/api/parse-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: originalText })
      })

      if (!response.ok) {
        throw new Error('解析请求失败')
      }

      const result = await response.json()
      console.log('✅ 解析结果:', result)

      if (result.success && result.data && result.data.rewritten_query) {
        // 设置解析结果
        setParsedQuery(result.data)
        
        // 使用解析后的查询文本重写输入框
        const enhancedQuery = result.data.rewritten_query
        await typeText(enhancedQuery)
        
        console.log('📝 语句解析和重写完成')
      } else {
        // 解析失败，恢复原始文本
        await typeText(originalText)
        console.log('⚠️ 解析失败，恢复原始文本')
      }
    } catch (error) {
      console.error('解析出错:', error)
      // 发生错误时恢复原始文本
      await typeText(originalText)
    } finally {
      setIsParsing(false)
      setIsErasing(false)
      setIsProcessingParse(false)
    }
  }

  // 擦除文本动画
  const eraseText = () => {
    return new Promise<void>((resolve) => {
      const currentText = input
      let currentIndex = currentText.length
      
      const eraseInterval = setInterval(() => {
        if (currentIndex <= 0) {
          clearInterval(eraseInterval)
          resolve()
          return
        }
        
        currentIndex -= 1
        const newText = currentText.substring(0, currentIndex)
        handleInputChange({ 
          target: { value: newText } 
        } as React.ChangeEvent<HTMLTextAreaElement>)
      }, 15) // 擦除速度：15ms一个字符 (更快)
    })
  }

  // 打字机重写动画
  const typeText = (text: string) => {
    return new Promise<void>((resolve) => {
      let currentIndex = 0
      
      const typeInterval = setInterval(() => {
        if (currentIndex >= text.length) {
          clearInterval(typeInterval)
          resolve()
          return
        }
        
        currentIndex += 1
        const newText = text.substring(0, currentIndex)
        handleInputChange({ 
          target: { value: newText } 
        } as React.ChangeEvent<HTMLTextAreaElement>)
      }, 30) // 打字速度：30ms一个字符 (更快)
    })
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
    
    // 获取用户查询：优先使用原始输入（如果正在解析），否则使用当前输入
    let userQuery: string
    if (isProcessingParse && originalUserInput) {
      userQuery = originalUserInput  // 使用解析前的原始输入
      console.log('🛡️ 使用受保护的原始输入:', userQuery)
    } else {
      userQuery = input.trim()  // 使用当前输入框内容
    }
    
    if (userQuery.length === 0) return
    
    setIsLoading(true)
    
    try {
      // 1. 添加用户消息（这会触发 ChatMessages 显示骨架屏）
      const userMessage = {
        role: 'user' as const,
        content: userQuery,
        id: generateId()
      }
      append(userMessage)
      
      // 2. 清空输入框和保护状态
      handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>)
      setOriginalUserInput('')
      setIsProcessingParse(false)
      
      // 3. 执行搜索（后台处理召回/重排，不显示中间状态）
      // 从用户输入中解析 #标签
      const words = userQuery.split(/\s+/)
      const tags = words.filter(w => w.startsWith('#')).map(w => w.slice(1))
      const queryWithoutTags = words.filter(w => !w.startsWith('#')).join(' ')
      
      // 分类提取的标签（简化版，主要作为Spark的备选方案）
      const extractedData = {
        roles: [] as string[],
        skills: [] as string[],
        locations: [] as string[],
        experience: '',
        salary: ''
      }
      
      tags.forEach(tag => {
        // 经验相关（包含"年"）
        if (tag.includes('年')) {
          extractedData.experience = tag.replace(/年.*/, '')
        }
        // 薪资相关（包含"k"）
        else if (tag.includes('k')) {
          extractedData.salary = tag.replace('k+', '').replace('k', '')
        }
        // 常见城市
        else if (['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '西安', '南京', '苏州'].includes(tag)) {
          extractedData.locations.push(tag)
        }
        // 常见岗位词汇
        else if (tag.includes('工程师') || tag.includes('开发') || tag.includes('设计师') || tag.includes('分析师') || tag.includes('经理')) {
          extractedData.roles.push(tag)
        }
        // 其他作为技能
        else {
          extractedData.skills.push(tag)
        }
      })

      // 🧠 智能策略：优先使用Spark解析结果，回退到#标签解析
      let enhancedQuery = queryWithoutTags
      let searchFilters: {
        location: string[]
        experience: string
        salary: string
        skills: string[]
        education: string[]
      } = {
        location: extractedData.locations,
        experience: extractedData.experience,
        salary: extractedData.salary,
        skills: extractedData.skills,
        education: []
      }

      // 🎯 新策略：Spark结构化数据 + #标签增强
      if (parsedQuery) {
        // 方案A：使用Spark智能解析的结构化数据
        console.log('🧠 使用Spark智能解析结果')
        
        const sparkTerms = [
          ...(parsedQuery.company || []),          // 🏢 Spark解析的公司
          ...(parsedQuery.industry || []),         // 🏭 Spark解析的行业
          ...(parsedQuery.role || []),             // 👤 Spark解析的角色
          ...(parsedQuery.skills_must || []),      // 💪 Spark解析的核心技能
          // 添加高置信度的相关技能
          ...(parsedQuery.skills_related || [])
            .filter(skill => skill.confidence >= 4)
            .map(skill => skill.skill)
        ].filter(Boolean)
        
        if (sparkTerms.length > 0) {
          enhancedQuery = `${queryWithoutTags} ${sparkTerms.join(' ')}`
          console.log('🎯 Spark智能增强模式')
          console.log('  - 基础查询:', queryWithoutTags)
          console.log('  - Spark公司:', parsedQuery.company?.join(' ') || '无')
          console.log('  - Spark行业:', parsedQuery.industry?.join(' ') || '无')
          console.log('  - Spark角色:', parsedQuery.role?.join(' ') || '无')
          console.log('  - Spark技能:', parsedQuery.skills_must?.join(' ') || '无')
          console.log('  - 高质量相关技能:', parsedQuery.skills_related?.filter(s => s.confidence >= 4).map(s => s.skill).join(' ') || '无')
          console.log('  - 最终查询:', enhancedQuery)
        } else {
          console.log('🔄 Spark解析无有效结果，回退到基础查询')
        }
        
        // 更新搜索过滤器使用Spark数据
        searchFilters = {
          location: parsedQuery.location || extractedData.locations,
          experience: parsedQuery.experience_min?.toString() || extractedData.experience,
          salary: parsedQuery.salary_min?.toString() || extractedData.salary,
          skills: parsedQuery.skills_must || extractedData.skills,
          education: parsedQuery.education || []
        }
        
      } else if (tags.length > 0) {
        // 方案B：回退到#标签解析（用于非Spark查询）
        console.log('📋 回退到#标签解析模式')
        
        const embeddingTerms = [
          ...extractedData.roles,      // 角色关键词
          ...extractedData.skills,     // 技能关键词  
          ...extractedData.locations   // 地点关键词
        ].filter(Boolean)
        
        if (embeddingTerms.length > 0) {
          enhancedQuery = `${queryWithoutTags} ${embeddingTerms.join(' ')}`
          console.log('🎯 标签增强模式：完整句子+标签boost')
          console.log('  - 基础查询:', queryWithoutTags)
          console.log('  - 标签增强:', embeddingTerms.join(' '))
          console.log('  - 最终查询:', enhancedQuery)
        } else {
          console.log('🔄 回退到完整句子模式')
        }
      } else {
        console.log('📝 无增强数据，使用原始查询')
      }

      // 添加调试信息
      console.log('🚀 ChatPanel搜索参数:')
      console.log('- 当前searchMode:', searchMode)
      console.log('- Cookie中的searchMode:', getCookie('searchMode'))
      console.log('- 原始查询:', userQuery)
      console.log('- 增强查询:', enhancedQuery)
      console.log('- 解析结果:', parsedQuery)
      console.log('- 过滤器:', searchFilters)

      // Use statically imported functions instead of dynamic import
      
      const response = await universalSearchStreaming({
        query: enhancedQuery,
        mode: searchMode,
        filters: searchFilters
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
      console.log('🔽 滚动到底部:', {
        scrollHeight: scrollContainer.scrollHeight,
        clientHeight: scrollContainer.clientHeight,
        scrollTop: scrollContainer.scrollTop
      })
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    } else {
      console.log('❌ 滚动容器未找到')
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
    <>
      {/* 欢迎屏幕 - 当没有消息时显示，考虑固定底部输入框的布局 */}
      {messages.length === 0 && (
        <div className="fixed inset-0 flex flex-col items-center text-center px-4 pointer-events-none" style={{ justifyContent: 'center', transform: 'translateY(-10vh)' }}>
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

      {/* 底部固定的输入区域 */}
      <div className={cn(
        'fixed inset-x-0 bottom-0 z-[100]',
        'pointer-events-none' // 容器本身不拦截点击事件
      )}>
        {/* 白色背景层 - 只覆盖输入框区域，不延伸到sidebar */}
        <div 
          className="absolute bg-white pointer-events-none w-full max-w-3xl left-1/2 transform -translate-x-1/2"
          style={{ 
            top: 'calc(100% - 80px)', 
            height: '280px'
          }}
        />
        
        <div className={cn(
          'w-full max-w-3xl mx-auto relative',
          'px-4', // 统一的水平padding，确保完全居中
          'pb-12', // 固定的底部间距，永不改变
          'pointer-events-auto' // 恢复交互能力
        )}>
          <form
            onSubmit={handleSearchSubmit}
            className="relative w-full"
          >
        {/* Subtle fade effect - lighter overlay */}
        {messages.length > 0 && (
          <div 
            className="absolute -top-16 left-0 right-0 h-16 pointer-events-none z-10"
            style={{
              background: 'linear-gradient(to top, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.5) 25%, rgba(255, 255, 255, 0.3) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 100%)'
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

        {/* 使用 flex-col-reverse 让输入框向上扩展，按钮区域保持在底部 */}
        <div className="relative flex flex-col-reverse w-full bg-white rounded-3xl border border-gray-300/60 shadow-lg shadow-gray-200/50 overflow-hidden backdrop-blur-sm input-container-expand">
          {/* 整体底部过渡阴影，增强统一感 */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/70 via-white/20 to-transparent pointer-events-none z-5"></div>
          
          {/* 按钮区域 - 因为 flex-col-reverse，这会显示在最下方 */}
          <div className="relative flex items-center justify-between p-2 z-20">
            <div className="flex items-center gap-2">
              <ModeSwitcher onModeChange={setSearchMode} />
              {/* Neura Spark 按钮 */}
              <Button
                type="button"
                variant="ghost"
                disabled={!input.trim() || isParsing || isErasing || isLoading}
                onClick={handleParseQuery}
                title="Neura Spark - 智能解析语句"
                className={cn(
                  "h-auto px-3 py-1.5 bg-transparent border-none rounded-full font-medium",
                  "relative overflow-hidden group",
                  "transition-all duration-300 ease-out",
                  "hover:bg-gradient-to-r hover:from-purple-50/80 hover:to-violet-50/80",
                  "hover:border hover:border-purple-200/60",
                  "focus:outline-none focus:ring-2 focus:ring-purple-300/50",
                  "active:scale-95",
                  "disabled:opacity-50 disabled:pointer-events-none",
                  // 处理中状态的特殊样式
                  (isParsing || isErasing) && [
                    "bg-gradient-to-r from-purple-100 to-violet-100",
                    "border border-purple-300/60",
                    "shadow-lg shadow-purple-200/50",
                    "animate-pulse"
                  ]
                )}
              >
                {/* 背景炫光效果 - 仅在处理中显示 */}
                {(isParsing || isErasing) && (
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-300/30 to-transparent"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(147, 51, 234, 0.15) 25%, rgba(168, 85, 247, 0.3) 50%, rgba(147, 51, 234, 0.15) 75%, transparent 100%)',
                        width: '150%',
                        height: '100%',
                        animation: (isParsing || isErasing) ? 'sparkle-shimmer 2s ease-in-out infinite' : 'none',
                        transform: 'translateX(-50%)'
                      }}
                    />
                  </div>
                )}
                
                {/* 呼吸光环效果 - 仅在处理中显示 */}
                {(isParsing || isErasing) && (
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-purple-400/40"
                    style={{
                      animation: 'sparkle-breathing 1.5s ease-in-out infinite alternate'
                    }}
                  />
                )}

                <div className={cn(
                  "flex items-center space-x-2 relative z-10",
                  (isParsing || isErasing) && "text-purple-700"
                )}>
                  <Zap className={cn(
                    "h-4 w-4 transition-all duration-300",
                    (isParsing || isErasing) && "text-purple-600 animate-pulse"
                  )} />
                  <span className="text-sm font-medium">
                    {isParsing ? "正在解析..." : isErasing ? "处理中..." : "Neura Spark"}
                  </span>
                </div>

                {/* 处理成功的微光效果 */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/0 via-purple-400/10 to-purple-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type={isLoading ? 'button' : 'submit'}
                size={'sm'}
                variant={'outline'}
                className={cn(
                  isLoading && 'animate-pulse',
                  'rounded-full h-9 w-9 p-0',
                  input.trim().length > 0 && !isLoading ? 'bg-gray-700 text-white border-gray-700 hover:bg-gray-600' : ''
                )}
                disabled={
                  (input.length === 0 && !isLoading) ||
                  isToolInvocationInProgress()
                }
                onClick={isLoading ? stop : undefined}
              >
                {isLoading ? <Square size={16} /> : <ArrowUp size={16} />}
              </Button>
            </div>
          </div>

          {/* 输入框区域 - 因为 flex-col-reverse，这会显示在按钮区域上方，并向上扩展 */}
          <div className="relative">
            {/* 模糊涂层 - 位于文字底部，营造文字渐隐效果 */}
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white/60 via-white/25 to-transparent backdrop-blur-[0.3px] pointer-events-none z-10"></div>
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-t from-gray-50/40 to-transparent blur-[0.8px] pointer-events-none z-10"></div>
          <Textarea
            ref={inputRef}
            name="input"
            rows={1} // 初始状态为单行
            maxRows={6} // 最大6行，超过后出现滚动条
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={getPlaceholder()}
            spellCheck={false}
            value={input}
            disabled={isLoading || isToolInvocationInProgress()}
            className="resize-none w-full bg-transparent border-0 px-4 py-3 text-base placeholder:text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 enhanced-cursor overflow-y-auto max-h-36 min-h-11 bottom-fixed-textarea"
            style={{
              color: 'transparent',
              caretColor: '#374151' // 明显的灰色光标
            }}
            onChange={e => {
              handleInputChange(e)
              // 用户手动修改输入时，清除解析保护状态
              if (isProcessingParse && e.target.value !== originalUserInput) {
                setIsProcessingParse(false)
                setOriginalUserInput('')
              }
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
            onScroll={e => {
              if (overlayRef.current) {
                overlayRef.current.scrollTop = e.currentTarget.scrollTop
              }
            }}
          />

          {/* 文本叠加层用于显示彩色 #标签 */}
          <div 
            ref={overlayRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none px-4 py-3 text-base whitespace-pre-wrap overflow-hidden"
            style={{
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit',
              letterSpacing: 'inherit'
            }}
          >
            {input.split(/(\s+)/).map((part, index) => (
              <span key={index}>
                {part.startsWith('#') ? (
                  <span className="text-gray-600 bg-gray-100 px-1 rounded border border-gray-200">
                    {part}
                  </span>
                ) : (
                  <span className="text-gray-900">{part}</span>
                )}
              </span>
            ))}
          </div>
          </div>
        </div>

      </form>
        </div>
      </div>
    </>
  )
}
