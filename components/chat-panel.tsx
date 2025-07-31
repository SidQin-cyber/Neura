'use client'

import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { ArrowUp, ChevronDown, Square, Zap, Layers } from 'lucide-react'

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

  // ✨ 新增：Rerank 状态管理
  const [rerankEnabled, setRerankEnabled] = useState(false)

  // 滚动按钮动画状态
  const [isScrollButtonAnimating, setIsScrollButtonAnimating] = useState(false)


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
        body: JSON.stringify({ 
          query: originalText,
          searchType: searchMode  // 传递当前搜索类型
        })
      })

      if (!response.ok) {
        throw new Error('解析请求失败')
      }

      const result = await response.json()
      console.log('✅ 解析结果:', result)

      if (result.success && result.data) {
        // 设置解析结果
        setParsedQuery(result.data)
        
        // 🎯 新策略：调用专门的API生成结构化文本
        const formatResponse = await fetch('/api/format-spark-result', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ parsedData: result.data })
        })
        
        if (formatResponse.ok) {
          const formatResult = await formatResponse.json()
          
                  // 在输入框显示处理结果（用户可以看到和编辑）
        const displayText = `【Spark Info.】
结构化描述：${formatResult.embeddingText.substring(0, 150)}...
关键词：${formatResult.ftsKeywords}
原始查询：${result.data.rewritten_query || originalText}`
          
          await typeText(displayText)
          
                     console.log('✅ Spark解析完成:')
           console.log('- Embedding文本:', formatResult.embeddingText)
           console.log('- FTS关键词:', formatResult.ftsKeywords)
           console.log('- 重写查询:', result.data.rewritten_query)
         } else {
           // 格式化失败，使用原始查询
           await typeText(result.data.rewritten_query || originalText)
           console.log('⚠️ 格式化失败，使用原始查询')
         }
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

  // 处理搜索提交 - 简化版本：用户消息 -> 搜索进度（通过loading状态） -> 结果
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
      // 1. 添加用户消息（带动画）
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
        // 🆕 添加Spark处理标识
        _sparkMode?: boolean
        _ftsQuery?: string
        _embeddingQuery?: string
      } = {
        location: extractedData.locations,
        experience: extractedData.experience,
        salary: extractedData.salary,
        skills: extractedData.skills,
        education: []
      }

      // 🎯 新策略：Spark结构化embedding + FTS双路搜索
      if (parsedQuery) {
        console.log('🧠 使用Spark智能解析结果进行高质量搜索')
        
        // 调用API生成结构化文本
        const formatResponse = await fetch('/api/format-spark-result', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ parsedData: parsedQuery })
        })
        
        if (formatResponse.ok) {
          const formatResult = await formatResponse.json()
          
          // 使用新的双路搜索策略
          enhancedQuery = formatResult.embeddingText  // 用于生成向量的结构化文本
          
          console.log('🎯 Spark双路搜索模式:')
          console.log('  - Embedding文本:', formatResult.embeddingText.substring(0, 100) + '...')
          console.log('  - FTS关键词:', formatResult.ftsKeywords)
          console.log('  - 原始查询:', userQuery)
          
          // 更新搜索过滤器使用Spark数据
          searchFilters = {
            location: parsedQuery.location || extractedData.locations,
            experience: parsedQuery.experience_min?.toString() || extractedData.experience,
            salary: parsedQuery.salary_min?.toString() || extractedData.salary,
            skills: parsedQuery.skills_must || extractedData.skills,
            education: parsedQuery.education || [],
            // 🆕 添加特殊标记，告诉后端使用Spark模式
            _sparkMode: true,
            _ftsQuery: formatResult.ftsKeywords,
            _embeddingQuery: formatResult.embeddingText
          }
        } else {
          console.log('🔄 格式化失败，回退到基础查询')
        }
      } else {
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
      }

      // 添加调试信息
      console.log('🚀 ChatPanel搜索参数:')
      console.log('- 当前searchMode:', searchMode)
      console.log('- Cookie中的searchMode:', getCookie('searchMode'))
      console.log('- 原始查询:', userQuery)
      console.log('- 增强查询:', enhancedQuery)
      console.log('- 解析结果:', parsedQuery)
      console.log('- 过滤器:', searchFilters)
      console.log('- 是否使用Spark:', searchFilters._sparkMode || false)

      // Use statically imported functions instead of dynamic import
      
      const response = await universalSearchStreaming({
        query: enhancedQuery,
        mode: searchMode,
        filters: searchFilters,
        rerank: rerankEnabled  // ✨ 传递 rerank 参数
      })
      
      if (response.success && response.stream) {
        // 4. 静默处理流式数据，收集结果
        await parseSearchStream(
          response.stream,
          // onChunk: 只打印日志，不更新UI
          (chunk) => {
            console.log('📡 流式更新:', chunk.type, chunk.data?.length || '')
          },
          // onComplete: 添加搜索结果到聊天中
          (finalResults) => {
            console.log('✅ 搜索完成, 总结果数:', finalResults.length)
            
            // 直接添加assistant消息，会使用动画结果组件展示
            const assistantMessage = {
              role: 'assistant' as const,
              content: finalResults.length > 0 
                ? finalResults as any 
                : '抱歉，没有找到符合您要求的结果。请尝试调整搜索条件或使用其他关键词。',
              id: generateId()
            }
            append(assistantMessage)
            setIsLoading(false)
          },
          // onError: 显示错误信息
          (error) => {
            console.error('搜索失败:', error)
            setIsLoading(false)
            
            const errorMessage = {
              role: 'assistant' as const,
              content: `❌ 搜索失败：${error}`,
              id: generateId()
            }
            append(errorMessage)
          }
        )
      } else {
        throw new Error(response.error || '搜索请求失败')
      }
    } catch (error: any) {
      console.error('搜索错误:', error)
      setIsLoading(false)
      
      const errorMessage = {
        role: 'assistant' as const,
        content: `❌ 搜索过程中出现错误：${error.message}`,
        id: generateId()
      }
      append(errorMessage)
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

  // Scroll to the bottom of the container with button animation
  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      console.log('🔽 滚动到底部:', {
        scrollHeight: scrollContainer.scrollHeight,
        clientHeight: scrollContainer.clientHeight,
        scrollTop: scrollContainer.scrollTop
      })
      
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
    } else {
      console.log('❌ 滚动容器未找到')
    }
  }

  // 动态placeholder
  const getPlaceholder = () => {
    // 当Spark在处理中时，显示特殊的提示文本
    if (isParsing || isErasing || isProcessingParse) {
      return 'Spark Info 生成中...'
    }
    
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
        'fixed inset-x-0 bottom-[10px] z-[100]',
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
            className={`absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md transition-transform duration-300 ease-out ${
              isScrollButtonAnimating ? 'animate-scale-out' : ''
            }`}
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
              {/* N-Spark 按钮 */}
              <Button
                type="button"
                variant="ghost"
                disabled={!input.trim() || isParsing || isErasing || isLoading}
                onClick={handleParseQuery}
                title="N-Spark - 智能解析语句"
                className={cn(
                  "h-auto px-3 py-1.5 bg-transparent border-none rounded-full text-base font-medium",
                  "relative overflow-hidden group w-[110px]",  // 固定宽度防止位移
                  "transition-all duration-500 cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  "hover:bg-gradient-to-r hover:from-indigo-50/90 hover:to-purple-50/90",
                  "hover:border hover:border-indigo-200/70",
                  "hover:shadow-sm hover:shadow-indigo-100/50",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-300/40 focus:ring-offset-1",
                  "active:scale-96 active:transition-transform active:duration-150",
                  "disabled:opacity-50 disabled:pointer-events-none",
                  // 处理中状态的特殊样式 - 更成熟的蓝紫渐变效果
                  (isParsing || isErasing) && [
                    "bg-gradient-to-r from-indigo-50/95 via-purple-50/90 to-indigo-50/95",
                    "border border-indigo-300/50",
                    "shadow-lg shadow-indigo-200/40",
                    "backdrop-blur-sm",
                    "scale-105"
                  ]
                )}
              >
                {/* 高性能流光效果 - 仅在处理中显示 */}
                {(isParsing || isErasing) && (
                  <>
                    {/* 主流光 - 使用硬件加速 */}
                    <div 
                      className="absolute inset-0 overflow-hidden rounded-full"
                      style={{
                        willChange: 'transform'
                      }}
                    >
                      <div 
                        className="absolute inset-0 h-full"
                        style={{
                          background: 'linear-gradient(120deg, transparent 0%, rgba(99, 102, 241, 0.1) 20%, rgba(129, 140, 248, 0.3) 40%, rgba(99, 102, 241, 0.1) 60%, transparent 80%)',
                          width: '150%',
                          height: '100%',
                          animation: 'sparkle-flow 2.8s linear infinite',
                          transform: 'translate3d(-100%, 0, 0)',
                          willChange: 'transform'
                        }}
                      />
                    </div>
                    
                    {/* 次流光 - 简化版本 */}
                    <div 
                      className="absolute inset-0 overflow-hidden rounded-full"
                      style={{
                        willChange: 'transform'
                      }}
                    >
                      <div 
                        className="absolute inset-0 h-full"
                        style={{
                          background: 'linear-gradient(100deg, transparent 30%, rgba(129, 140, 248, 0.15) 50%, transparent 70%)',
                          width: '120%',
                          height: '100%',
                          animation: 'sparkle-shimmer 3.5s linear infinite',
                          animationDelay: '0.8s',
                          transform: 'translate3d(-50%, 0, 0)',
                          willChange: 'transform'
                        }}
                      />
                    </div>
                  </>
                )}
                
                {/* 高性能呼吸光环 - 仅在处理中显示 */}
                {(isParsing || isErasing) && (
                  <div 
                    className="absolute inset-0 rounded-full border border-indigo-400/30"
                    style={{
                      animation: 'sparkle-breathing 3s ease-in-out infinite',
                      willChange: 'transform, box-shadow'
                    }}
                  />
                )}

                <div className={cn(
                  "flex items-center space-x-2 relative z-10 transition-colors duration-500",
                  (isParsing || isErasing) && "text-indigo-700"
                )}>
                  <Zap className={cn(
                    "h-4 w-4 transition-all duration-300 ease-out",
                    (isParsing || isErasing) && "text-indigo-600 drop-shadow-sm",
                    !(isParsing || isErasing) && "hover:scale-105"
                  )} 
                  style={{
                    animation: (isParsing || isErasing) ? 'sparkle-pulse 2.4s ease-in-out infinite' : 'none',
                    willChange: (isParsing || isErasing) ? 'transform' : 'auto'
                  }}
                  />
                  <span className="text-sm font-medium transition-all duration-400 ease-out">
                    {isParsing ? "sparking..." : isErasing ? "处理中..." : "N-Spark"}
                  </span>
                </div>

                {/* 处理成功的微光效果 */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400/0 via-indigo-400/10 to-indigo-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>

              {/* ✨ 新增：Rerank 按钮 */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRerankEnabled(!rerankEnabled)}
                title={rerankEnabled ? "Rerank 已开启 - 二阶段智能重排" : "Rerank 已关闭 - 一阶段向量召回"}
                className={cn(
                  "h-auto px-3 py-1.5 bg-transparent border-none rounded-full text-base font-medium",
                  "relative overflow-hidden group",
                  "transition-all duration-500 cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  "focus:outline-none focus:ring-0 focus:ring-offset-0",  // 完全移除 focus ring
                  "active:scale-96 active:transition-transform active:duration-150",
                  // 激活状态样式 - 蓝色主题
                  rerankEnabled ? [
                    "bg-gradient-to-r from-blue-50/95 via-sky-50/90 to-blue-50/95",
                    "border border-blue-300/50",
                    "shadow-lg shadow-blue-200/40",
                    "backdrop-blur-sm",
                    "text-blue-700",
                    "hover:from-blue-100/95 hover:via-sky-100/90 hover:to-blue-100/95"
                  ] : [
                    "hover:bg-gradient-to-r hover:from-blue-50/90 hover:to-sky-50/90",
                    "hover:border hover:border-blue-200/70",
                    "hover:shadow-sm hover:shadow-blue-100/50"
                  ]
                )}
              >
                {/* 激活状态的流光效果 */}
                {rerankEnabled && (
                  <>
                    {/* 主流光 - 蓝色主题 */}
                    <div 
                      className="absolute inset-0 overflow-hidden rounded-full"
                      style={{
                        willChange: 'transform'
                      }}
                    >
                      <div 
                        className="absolute inset-0 h-full"
                        style={{
                          background: 'linear-gradient(120deg, transparent 0%, rgba(59, 130, 246, 0.1) 20%, rgba(14, 165, 233, 0.3) 40%, rgba(59, 130, 246, 0.1) 60%, transparent 80%)',
                          width: '150%',
                          height: '100%',
                          animation: 'rerank-flow 3.2s linear infinite',
                          transform: 'translate3d(-100%, 0, 0)',
                          willChange: 'transform'
                        }}
                      />
                    </div>

                    {/* 呼吸光环 */}
                    <div 
                      className="absolute inset-0 rounded-full border border-blue-400/30"
                      style={{
                        animation: 'rerank-breathing 3.5s ease-in-out infinite',
                        willChange: 'transform, box-shadow'
                      }}
                    />
                  </>
                )}

                <div className={cn(
                  "flex items-center space-x-2 relative z-10 transition-colors duration-500",
                  rerankEnabled && "text-blue-700"
                )}>
                  <Layers className={cn(
                    "h-4 w-4 transition-all duration-300 ease-out",
                    rerankEnabled && "text-blue-600 drop-shadow-sm",
                    !rerankEnabled && "hover:scale-105"
                  )} 
                  style={{
                    animation: rerankEnabled ? 'rerank-pulse 2.8s ease-in-out infinite' : 'none',
                    willChange: rerankEnabled ? 'transform' : 'auto'
                  }}
                  />
                  <span className="text-sm font-medium transition-all duration-400 ease-out">
                    {rerankEnabled ? "Rerank On" : "Rerank"}
                  </span>
                </div>

                {/* 悬停微光效果 */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/0 via-blue-400/10 to-blue-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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
