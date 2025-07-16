import { ChatRequestOptions, JSONValue, Message, ToolInvocation } from 'ai'
import { useMemo } from 'react'
import { AnswerSection } from './answer-section'
import { ReasoningSection } from './reasoning-section'
import RelatedQuestions from './related-questions'
import { ToolSection } from './tool-section'
import { UserMessage } from './user-message'
import { CandidateResultsSection } from './recruitment/candidate-results-section'
import { JobResultsSection } from './recruitment/job-results-section'
import { CandidateSearchResult, JobSearchResult } from '@/lib/context/search-context'

interface RenderMessageProps {
  message: Message
  messageId: string
  getIsOpen: (id: string) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  chatId?: string
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (
    messageId: string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  chatId,
  addToolResult,
  onUpdateMessage,
  reload
}: RenderMessageProps) {
  const relatedQuestions = useMemo(
    () =>
      message.annotations?.filter(
        annotation => (annotation as any)?.type === 'related-questions'
      ),
    [message.annotations]
  )

  // Render for manual tool call
  const toolData = useMemo(() => {
    const toolAnnotations =
      (message.annotations?.filter(
        annotation =>
          (annotation as unknown as { type: string }).type === 'tool_call'
      ) as unknown as Array<{
        data: {
          args: string
          toolCallId: string
          toolName: string
          result?: string
          state: 'call' | 'result'
        }
      }>) || []

    const toolDataMap = toolAnnotations.reduce((acc, annotation) => {
      const existing = acc.get(annotation.data.toolCallId)
      if (!existing || annotation.data.state === 'result') {
        acc.set(annotation.data.toolCallId, {
          ...annotation.data,
          args: annotation.data.args ? JSON.parse(annotation.data.args) : {},
          result:
            annotation.data.result && annotation.data.result !== 'undefined'
              ? JSON.parse(annotation.data.result)
              : undefined
        } as ToolInvocation)
      }
      return acc
    }, new Map<string, ToolInvocation>())

    return Array.from(toolDataMap.values())
  }, [message.annotations])

  // Extract the unified reasoning annotation directly.
  const reasoningAnnotation = useMemo(() => {
    const annotations = message.annotations as any[] | undefined
    if (!annotations) return null
    return (
      annotations.find(a => a.type === 'reasoning' && a.data !== undefined) ||
      null
    )
  }, [message.annotations])

  // Extract the reasoning time and reasoning content from the annotation.
  // If annotation.data is an object, use its fields. Otherwise, default to a time of 0.
  const reasoningTime = useMemo(() => {
    if (!reasoningAnnotation) return 0
    if (
      typeof reasoningAnnotation.data === 'object' &&
      reasoningAnnotation.data !== null
    ) {
      return reasoningAnnotation.data.time ?? 0
    }
    return 0
  }, [reasoningAnnotation])

  if (message.role === 'user') {
    return (
      <UserMessage
        message={message.content}
        messageId={messageId}
        onUpdateMessage={onUpdateMessage}
      />
    )
  }

  // New way: Use parts instead of toolInvocations
  return (
    <>
      {toolData.map(tool => (
        <ToolSection
          key={tool.toolCallId}
          tool={tool}
          isOpen={getIsOpen(tool.toolCallId)}
          onOpenChange={open => onOpenChange(tool.toolCallId, open)}
          addToolResult={addToolResult}
        />
      ))}
      {message.parts?.map((part, index) => {
        // Check if this is the last part in the array
        const isLastPart = index === (message.parts?.length ?? 0) - 1

        switch (part.type) {
          case 'tool-invocation':
            return (
              <ToolSection
                key={`${messageId}-tool-${index}`}
                tool={part.toolInvocation}
                isOpen={getIsOpen(part.toolInvocation.toolCallId)}
                onOpenChange={open =>
                  onOpenChange(part.toolInvocation.toolCallId, open)
                }
                addToolResult={addToolResult}
              />
            )
          case 'text':
            // Only show actions if this is the last part and it's a text part
            return (
              <AnswerSection
                key={`${messageId}-text-${index}`}
                content={part.text}
                isOpen={getIsOpen(messageId)}
                onOpenChange={open => onOpenChange(messageId, open)}
                chatId={chatId}
                showActions={isLastPart}
                messageId={messageId}
                reload={reload}
              />
            )
          case 'reasoning':
            return (
              <ReasoningSection
                key={`${messageId}-reasoning-${index}`}
                content={{
                  reasoning: part.reasoning,
                  time: reasoningTime
                }}
                isOpen={getIsOpen(messageId)}
                onOpenChange={open => onOpenChange(messageId, open)}
              />
            )
          // Add other part types as needed
          default:
            return null
        }
      })}
      
      {/* Handle recruitment search results */}
      {(() => {
        // Check if message contains candidate results
        // More robust detection using name AND (match_score OR final_score)
        if (
          message.role === 'assistant' &&
          Array.isArray(message.content) &&
          message.content.length > 0 &&
          message.content[0] &&
          typeof message.content[0] === 'object' &&
          'name' in message.content[0] &&
          ('match_score' in message.content[0] || 'final_score' in message.content[0])
        ) {
          try {
            return (
              <CandidateResultsSection
                candidates={message.content as any[]}
                isOpen={getIsOpen(`${messageId}-candidates`)}
                onOpenChange={open => onOpenChange(`${messageId}-candidates`, open)}
                query=""
                totalCount={message.content.length}
              />
            )
          } catch (error) {
            console.error('Error rendering candidate results:', error)
            return (
              <AnswerSection
                content="候选人结果渲染时出现错误，请重试。"
                isOpen={getIsOpen(messageId)}
                onOpenChange={open => onOpenChange(messageId, open)}
                chatId={chatId}
                showActions={true}
                messageId={messageId}
                reload={reload}
              />
            )
          }
        }
        
        // Check if message contains job results
        if (
          message.role === 'assistant' &&
          Array.isArray(message.content) &&
          message.content.length > 0 &&
          message.content[0] &&
          typeof message.content[0] === 'object' &&
          'title' in message.content[0] &&
          'company' in message.content[0] &&
          'skills_required' in message.content[0]
        ) {
          return (
            <JobResultsSection
              jobs={message.content as JobSearchResult[]}
              isOpen={getIsOpen(`${messageId}-jobs`)}
              onOpenChange={open => onOpenChange(`${messageId}-jobs`, open)}
              query=""
              totalCount={message.content.length}
            />
          )
        }
        
        // Check if message contains empty search results
        if (
          message.role === 'assistant' &&
          Array.isArray(message.content) &&
          message.content.length === 0
        ) {
          return (
            <AnswerSection
              content="抱歉，没有找到符合您要求的结果。请尝试调整搜索条件或使用其他关键词。"
              isOpen={getIsOpen(messageId)}
              onOpenChange={open => onOpenChange(messageId, open)}
              chatId={chatId}
              showActions={true}
              messageId={messageId}
              reload={reload}
            />
          )
        }
        
        // If message is a string, treat it as a regular assistant message
        if (
          message.role === 'assistant' &&
          typeof message.content === 'string'
        ) {
          return (
            <AnswerSection
              content={message.content}
              isOpen={getIsOpen(messageId)}
              onOpenChange={open => onOpenChange(messageId, open)}
              chatId={chatId}
              showActions={true}
              messageId={messageId}
              reload={reload}
            />
          )
        }
        
        return null
      })()}
      
      {relatedQuestions && relatedQuestions.length > 0 && (
        <RelatedQuestions
          annotations={relatedQuestions as JSONValue[]}
          onQuerySelect={onQuerySelect}
          isOpen={getIsOpen(`${messageId}-related`)}
          onOpenChange={open => onOpenChange(`${messageId}-related`, open)}
        />
      )}
    </>
  )
}
