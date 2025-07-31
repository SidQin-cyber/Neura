'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

interface GlobalPageTransitionProps {
  children: ReactNode
}

// 定义不同类型页面的过渡动画
const getPageTransition = (pathname: string) => {
  // 认证相关页面 - 已有的fade效果
  if (pathname.startsWith('/auth') || pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return {
      type: 'fade',
      variants: {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 }
      },
      transition: { duration: 0.4, ease: 'easeInOut' }
    }
  }

  // 详情页面 (包含动态路由) - slide-in效果
  if (pathname.includes('/share/') || pathname.includes('/admin/') || pathname.match(/\/[^\/]+\/[^\/]+/)) {
    return {
      type: 'slide',
      variants: {
        initial: { opacity: 0, x: 60, scale: 0.95 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: -60, scale: 0.95 }
      },
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  }

  // 主页面和列表页面 - 默认fade效果
  return {
    type: 'fade',
    variants: {
      initial: { opacity: 0, y: 15 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -15 }
    },
    transition: { duration: 0.3, ease: 'easeInOut' }
  }
}

export function GlobalPageTransition({ children }: GlobalPageTransitionProps) {
  const pathname = usePathname()
  const transition = getPageTransition(pathname)
  
  // 添加调试日志
  console.log('🌐 Global Page Transition:', { 
    pathname, 
    transitionType: transition.type 
  })

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={transition.variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition.transition}
        className="h-full w-full"
        onAnimationStart={() => console.log('🎬 Page transition started:', transition.type)}
        onAnimationComplete={() => console.log('✅ Page transition completed:', transition.type)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// 页面过渡预设配置导出，供其他组件使用
export const pageTransitionPresets = {
  fade: {
    variants: {
      initial: { opacity: 0, y: 15 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -15 }
    },
    transition: { duration: 0.3, ease: 'easeInOut' as const }
  },
  
  slideIn: {
    variants: {
      initial: { opacity: 0, x: 60, scale: 0.95 },
      animate: { opacity: 1, x: 0, scale: 1 },
      exit: { opacity: 0, x: -60, scale: 0.95 }
    },
    transition: { duration: 0.5, ease: 'easeOut' as const }
  },
  
  slideUp: {
    variants: {
      initial: { opacity: 0, y: 50, scale: 0.95 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: -50, scale: 0.95 }
    },
    transition: { duration: 0.4, ease: 'easeOut' as const }
  },
  
  scale: {
    variants: {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 1.05 }
    },
    transition: { duration: 0.3, ease: 'easeInOut' as const }
  }
}

// 响应式动画设置 - 移动端减少动画复杂度
export const getResponsiveTransition = (isMobile: boolean, transitionType: keyof typeof pageTransitionPresets) => {
  const preset = pageTransitionPresets[transitionType]
  
  if (isMobile) {
    return {
      ...preset,
      transition: {
        ...preset.transition,
        duration: preset.transition.duration * 0.7 // 移动端动画更快
      }
    }
  }
  
  return preset
}