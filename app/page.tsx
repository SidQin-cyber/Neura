'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { Message } from 'ai'
import { SearchProvider, useSearch } from '@/lib/context/search-context'
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
      {/* 主内容区域 - 可滚动 */}
      <div className="flex-1 overflow-y-auto">
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

      {/* 固定底部输入框 */}
      <div className="w-full">
        <ChatPanel
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          messages={messages}
          setMessages={setMessages}
          stop={stop}
          append={append}
          showScrollToBottomButton={false}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <SearchProvider>
      <HomePageContent />
    </SearchProvider>
  )
}
