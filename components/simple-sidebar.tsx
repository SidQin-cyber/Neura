'use client'

import { IconLogo } from '@/components/ui/icons'
import { MessageSquare, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { UploadModal } from '@/components/upload-modal'

export function SimpleSidebar() {
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const handleNewChat = () => {
    // 触发新建对话事件
    window.dispatchEvent(new CustomEvent('new-chat'))
    // 导航到首页
    router.push('/')
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="w-12 h-screen bg-background border-r-[0.5px] border-border/40 flex flex-col items-center py-3 fixed left-0 top-0 z-50">
        {/* Logo */}
        <button 
          onClick={handleNewChat}
          className="flex items-center justify-center w-10 h-10 hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors group"
        >
          <IconLogo className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
        
        {/* 新建对话按钮 */}
        <div className="flex flex-col items-center gap-2 mt-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleNewChat}
                className="flex items-center justify-center w-10 h-10 hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors group"
              >
                <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </TooltipTrigger>
            <TooltipContent 
              side="right" 
              sideOffset={12}
              className="bg-gray-900 text-white px-2.5 py-1.5 rounded-md text-xs font-medium shadow-lg"
            >
              New chat
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 上传按钮 */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center justify-center w-10 h-10 hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors group"
              >
                <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </TooltipTrigger>
            <TooltipContent 
              side="right" 
              sideOffset={12}
              className="bg-gray-900 text-white px-2.5 py-1.5 rounded-md text-xs font-medium shadow-lg"
            >
              上传
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 上传模态框 */}
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />
    </TooltipProvider>
  )
} 