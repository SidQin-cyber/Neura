'use client'

import { IconLogo, Logo } from '@/components/ui/icons'
import { MessageSquare, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { UploadModal } from '@/components/upload-modal'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import UserMenu from '@/components/user-menu'
import { useLanguage } from '@/lib/context/language-context'

export function SimpleSidebar() {
  const router = useRouter()
  const { t } = useLanguage()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  // 获取用户信息
  useEffect(() => {
    const supabase = createClient()
    
    // 获取当前用户
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null)
      }
    )
    
    getUser()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleNewChat = () => {
    // 触发新建对话事件
    window.dispatchEvent(new CustomEvent('new-chat'))
    // 导航到首页
    router.push('/')
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="w-16 h-screen bg-sidebar-bg border-r-[0.5px] border-border/30 flex flex-col items-center py-4 fixed left-0 top-0 z-50">
        {/* 顶部按钮区域 */}
        <div className="flex flex-col items-center gap-3">
          {/* Logo */}
          <button 
            onClick={handleNewChat}
            className="flex items-center justify-center w-12 h-12 hover:bg-white/50 hover:shadow-sm rounded-lg transition-all duration-200 group"
          >
            <Logo className="!w-11 !h-11 group-hover:scale-110 transition-transform" />
          </button>
          
          {/* 新建对话按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleNewChat}
                className="flex items-center justify-center w-12 h-12 hover:bg-white/50 hover:shadow-sm rounded-lg transition-all duration-200 group"
              >
                <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </TooltipTrigger>
            <TooltipContent 
              side="right" 
              sideOffset={12}
              className="bg-text-primary text-white px-2.5 py-1.5 rounded-md text-xs font-medium shadow-lg"
            >
              {t('nav.newChat')}
            </TooltipContent>
          </Tooltip>

          {/* 上传按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center justify-center w-12 h-12 hover:bg-white/50 hover:shadow-sm rounded-lg transition-all duration-200 group"
              >
                <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </TooltipTrigger>
            <TooltipContent 
              side="right" 
              sideOffset={12}
              className="bg-text-primary text-white px-2.5 py-1.5 rounded-md text-xs font-medium shadow-lg"
            >
              {t('nav.upload')}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 占位符，使用flex-1让用户菜单在底部 */}
        <div className="flex-1"></div>

        {/* 底部用户菜单 - 调整位置与ChatPanel的底部按钮对齐 */}
        {user && (
          <div className="flex flex-col items-center pb-[46px]">
            <UserMenu user={user} variant="sidebar" />
          </div>
        )}
      </div>

      {/* 上传模态框 */}
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />
    </TooltipProvider>
  )
} 