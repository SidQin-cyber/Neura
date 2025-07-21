'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { Message } from 'ai'
import { SearchProvider, useSearch } from '@/lib/context/search-context'
import { ArtifactProvider } from '@/components/artifact/artifact-context'
import { ChatPanel } from '@/components/chat-panel'
import { ChatMessages } from '@/components/chat-messages'

// 生成唯一ID的函数
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

interface ChatSection {
  id: string // User message ID
  userMessage: Message
  assistantMessages: Message[]
}

function HomePageContent() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { resetSearchState } = useSearch()

  // 监听新建对话事件
  useEffect(() => {
    const handleNewChat = () => {
      setMessages([])
      setInput('')
      setIsLoading(false)
      resetSearchState()
    }

    window.addEventListener('new-chat', handleNewChat)
    return () => {
      window.removeEventListener('new-chat', handleNewChat)
    }
  }, [resetSearchState])

  // 监听滚动，更新 isAtBottom 状态
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = 50
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        setIsAtBottom(true)
      } else {
        setIsAtBottom(false)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // 初始化状态
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // 当有新消息时自动滚动到对应区域
  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    // 只在用户发送消息或收到助手回复时滚动
    if (lastMessage.role === 'user' || lastMessage.role === 'assistant') {
      const sectionId = lastMessage.id
      requestAnimationFrame(() => {
        const scrollContainer = scrollContainerRef.current
        const sectionElement = document.getElementById(`section-${sectionId}`)
        
        if (scrollContainer && sectionElement) {
          // 获取section在滚动容器中的位置
          const containerRect = scrollContainer.getBoundingClientRect()
          const sectionRect = sectionElement.getBoundingClientRect()
          const scrollTop = scrollContainer.scrollTop
          
          // 计算section相对于滚动容器内容的位置
          const sectionOffsetTop = sectionRect.top - containerRect.top + scrollTop
          
          console.log('📍 滚动到消息:', {
            sectionId,
            sectionOffsetTop,
            scrollTop,
            containerHeight: scrollContainer.clientHeight,
            scrollHeight: scrollContainer.scrollHeight
          })
          
          // 滚动到section位置
          scrollContainer.scrollTo({
            top: sectionOffsetTop - 20, // 留一些顶部间距
            behavior: 'smooth'
          })
        } else {
          console.log('❌ 元素未找到:', { scrollContainer: !!scrollContainer, sectionElement: !!sectionElement })
        }
      })
    }
  }, [messages])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // 这个函数现在由ChatPanel内部处理
  }

  const stop = () => {
    setIsLoading(false)
  }

  const append = (message: Message) => {
    setMessages(prev => [...prev, message])
  }

  // Convert messages array to sections array
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = []
    let currentSection: ChatSection | null = null

    for (const message of messages) {
      if (message.role === 'user') {
        // Start a new section when a user message is found
        if (currentSection) {
          result.push(currentSection)
        }
        currentSection = {
          id: message.id,
          userMessage: message,
          assistantMessages: []
        }
      } else if (currentSection && message.role === 'assistant') {
        // Add assistant message to the current section
        currentSection.assistantMessages.push(message)
      }
      // Ignore other role types like 'system' for now
    }

    // Add the last section if exists
    if (currentSection) {
      result.push(currentSection)
    }

    return result
  }, [messages])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query,
      id: generateId()
    })
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* 主内容区域 - 确保滚动容器有正确的高度和边界 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto pb-48"
        style={{ height: '100%' }}
      >
        <ChatMessages
          sections={sections}
          data={undefined}
          onQuerySelect={onQuerySelect}
          isLoading={isLoading}
          chatId="recruitment-chat"
          addToolResult={() => {}}
          scrollContainerRef={scrollContainerRef}
          onUpdateMessage={async () => {}}
          reload={async () => null}
        />
      </div>

      {/* ChatPanel 现在是固定在底部的，不再需要在这里包装 */}
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        append={append}
        showScrollToBottomButton={!isAtBottom}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  )
}

export default function HomePage() {
  return (
    <SearchProvider>
      <ArtifactProvider>
        <HomePageContent />
      </ArtifactProvider>
    </SearchProvider>
  )
}
