'use client'

import { cn } from '@/lib/utils'
import { ChatRequestOptions, JSONValue, Message } from 'ai'
import { useEffect, useMemo, useState } from 'react'
import { RenderMessage } from './render-message'
import { ToolSection } from './tool-section'
import { Spinner } from './ui/spinner'
import { DefaultSkeleton, MessageSkeleton } from './default-skeleton'
import { useSearch } from '@/lib/context/search-context'

// Import section structure interface
interface ChatSection {
  id: string
  userMessage: Message
  assistantMessages: Message[]
}

interface ChatMessagesProps {
  sections: ChatSection[] // Changed from messages to sections
  data: JSONValue[] | undefined
  onQuerySelect: (query: string) => void
  isLoading: boolean
  chatId?: string
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  /** Ref for the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement>
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (
    messageId: string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>
}

export function ChatMessages({
  sections,
  data,
  onQuerySelect,
  isLoading,
  chatId,
  addToolResult,
  scrollContainerRef,
  onUpdateMessage,
  reload
}: ChatMessagesProps) {
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})
  const manualToolCallId = 'manual-tool-call'
  const { searchMode, isLoading: searchLoading } = useSearch()

  useEffect(() => {
    // Open manual tool call when the last section is a user message
    if (sections.length > 0) {
      const lastSection = sections[sections.length - 1]
      if (lastSection.userMessage.role === 'user') {
        setOpenStates({ [manualToolCallId]: true })
      }
    }
  }, [sections])

  // get last tool data for manual tool call
  const lastToolData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return null

    const lastItem = data[data.length - 1] as {
      type: 'tool_call'
      data: {
        toolCallId: string
        state: 'call' | 'result'
        toolName: string
        args: string
      }
    }

    if (lastItem.type !== 'tool_call') return null

    const toolData = lastItem.data
    return {
      state: 'call' as const,
      toolCallId: toolData.toolCallId,
      toolName: toolData.toolName,
      args: toolData.args ? JSON.parse(toolData.args) : undefined
    }
  }, [data])

  // Always render the container to maintain layout consistency
  if (!sections.length) {
    return (
      <div
        role="list"
        aria-roledescription="chat messages"
        className="relative w-full min-h-full pt-14"
      >
        <div className="relative mx-auto w-full max-w-3xl px-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {/* Empty state - maintain layout */}
        </div>
      </div>
    )
  }

  // Get all messages as a flattened array
  const allMessages = sections.flatMap(section => [
    section.userMessage,
    ...section.assistantMessages
  ])

  const lastUserIndex =
    allMessages.length -
    1 -
    [...allMessages].reverse().findIndex(msg => msg.role === 'user')

  // Check if loading indicator should be shown
  // 统一两个加载状态：AI对话的isLoading 和 搜索的searchLoading
  const combinedLoading = isLoading || searchLoading
  const showLoading =
    combinedLoading &&
    sections.length > 0 &&
    sections[sections.length - 1].assistantMessages.length === 0

  const getIsOpen = (id: string) => {
    if (id.includes('call')) {
      return openStates[id] ?? true
    }
    const baseId = id.endsWith('-related') ? id.slice(0, -8) : id
    const index = allMessages.findIndex(msg => msg.id === baseId)
    return openStates[id] ?? index >= lastUserIndex
  }

  const handleOpenChange = (id: string, open: boolean) => {
    setOpenStates(prev => ({
      ...prev,
      [id]: open
    }))
  }

  return (
    <div
      role="list"
      aria-roledescription="chat messages"
      className="relative w-full min-h-full pt-14"
    >
      <div className="relative mx-auto w-full max-w-3xl px-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className="chat-section mb-6"
          >
            {/* User message */}
            <div className="flex flex-col gap-4">
              <RenderMessage
                message={section.userMessage}
                messageId={section.userMessage.id}
                getIsOpen={getIsOpen}
                onOpenChange={handleOpenChange}
                onQuerySelect={onQuerySelect}
                chatId={chatId}
                addToolResult={addToolResult}
                onUpdateMessage={onUpdateMessage}
                reload={reload}
              />
            </div>

            {/* Assistant messages */}
            {section.assistantMessages.map(assistantMessage => (
              <div key={assistantMessage.id} className="flex flex-col gap-4 mt-6">
                <RenderMessage
                  message={assistantMessage}
                  messageId={assistantMessage.id}
                  getIsOpen={getIsOpen}
                  onOpenChange={handleOpenChange}
                  onQuerySelect={onQuerySelect}
                  chatId={chatId}
                  addToolResult={addToolResult}
                  onUpdateMessage={onUpdateMessage}
                  reload={reload}
                />
              </div>
            ))}
            
            {/* 🎯 优化的骨架屏 - 平滑过渡动画 */}
            {showLoading && sectionIndex === sections.length - 1 && (
              <div className={cn(
                "flex flex-col gap-2 mt-6 transition-all duration-400 ease-out",
                "animate-assistant-slide-in"
              )}>
                {/* 消息骨架屏 - 带淡入动画 */}
                <div className="animate-summary-slide-in">
                  <MessageSkeleton />
                </div>
                {/* 卡片骨架屏 - 优化的错开出现 */}
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div 
                      key={i}
                      className="opacity-0 animate-card-smooth-enter"
                      style={{ 
                        animationDelay: `${300 + i * 150}ms`,
                        animationFillMode: 'forwards'
                      }}
                    >
                      <DefaultSkeleton 
                        variant={searchMode === 'candidates' ? 'candidate' : 'job'}
                        count={1}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {showLoading && lastToolData && (
          <ToolSection
            key={manualToolCallId}
            tool={lastToolData}
            isOpen={getIsOpen(manualToolCallId)}
            onOpenChange={open => handleOpenChange(manualToolCallId, open)}
            addToolResult={addToolResult}
          />
        )}
      </div>
    </div>
  )
}
