'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'

interface AuthPageTransitionProps {
  children: ReactNode
  className?: string
}

// 页面淡入淡出动画配置 - 简化版本
const pageVariants = {
  initial: {
    opacity: 0,
    y: 30
  },
  animate: {
    opacity: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    y: -30
  }
}

// 页面过渡配置 - 简化版本
const pageTransition = {
  duration: 0.6,
  ease: "easeInOut" as const
}

// 成功提示动画配置
const successVariants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    y: 10
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    scale: 0.9
  }
}

// 认证页面过渡包装器
export function AuthPageTransition({ children, className }: AuthPageTransitionProps) {
  console.log('🎭 AuthPageTransition rendering') // 调试日志
  
  return (
    <motion.div
      className={className}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      onAnimationStart={() => console.log('🎬 Animation started')}
      onAnimationComplete={() => console.log('✅ Animation completed')}
    >
      {children}
    </motion.div>
  )
}

// 成功提示组件
interface SuccessToastProps {
  show: boolean
  message: string
  onComplete?: () => void
}

export function SuccessToast({ show, message, onComplete }: SuccessToastProps) {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      {show && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/20 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-lg px-6 py-4 shadow-lg border flex items-center space-x-3"
            variants={successVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {message}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// 按钮动画增强
export const buttonVariants = {
  hover: {
    scale: 1.02
  },
  tap: {
    scale: 0.98
  }
}

// 链接动画增强
export const linkVariants = {
  hover: {
    scale: 1.05
  },
  tap: {
    scale: 0.95
  }
}