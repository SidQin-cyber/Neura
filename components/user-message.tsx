'use client'

import React from 'react'
import { CollapsibleMessage } from './collapsible-message'

type UserMessageProps = {
  message: string
  messageId?: string
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
}

export const UserMessage: React.FC<UserMessageProps> = ({
  message
}) => {

  return (
    <div className="animate-message-send">
      <CollapsibleMessage role="user">
        <div className="flex-1 break-words w-full">
          {message}
        </div>
      </CollapsibleMessage>
    </div>
  )
}
