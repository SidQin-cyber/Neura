'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { AuthPageTransition, SuccessToast, buttonVariants, linkVariants } from '@/components/auth-page-transition'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

// 本地存储的键名
const REMEMBER_ME_KEY = 'neura_remember_me'
const SAVED_CREDENTIALS_KEY = 'neura_saved_credentials'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const router = useRouter()

  // 页面加载时检查是否有保存的登录信息
  useEffect(() => {
    const savedRememberMe = localStorage.getItem(REMEMBER_ME_KEY)
    const savedCredentials = localStorage.getItem(SAVED_CREDENTIALS_KEY)
    
    if (savedRememberMe === 'true' && savedCredentials) {
      try {
        const credentials = JSON.parse(savedCredentials)
        setUsername(credentials.username || '')
        setPassword(credentials.password || '')
        setRememberMe(true)
      } catch (error) {
        console.error('Error parsing saved credentials:', error)
        // 清除损坏的数据
        localStorage.removeItem(REMEMBER_ME_KEY)
        localStorage.removeItem(SAVED_CREDENTIALS_KEY)
      }
    } else {
      // 如果没有保存的登录信息，确保表单为空
      setUsername('')
      setPassword('')
      setRememberMe(false)
      
      // 清除可能存在的旧数据
      localStorage.removeItem(REMEMBER_ME_KEY)
      localStorage.removeItem(SAVED_CREDENTIALS_KEY)
    }

    // 清理函数：在页面卸载时，如果没有勾选"记住我"，清除所有数据
    return () => {
      const currentRememberMe = localStorage.getItem(REMEMBER_ME_KEY)
      if (currentRememberMe !== 'true') {
        localStorage.removeItem(REMEMBER_ME_KEY)
        localStorage.removeItem(SAVED_CREDENTIALS_KEY)
      }
    }
  }, [])

  // 处理"记住我"状态变化
  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked)
    
    // 如果取消勾选，立即清除保存的登录信息和当前表单
    if (!checked) {
      localStorage.removeItem(REMEMBER_ME_KEY)
      localStorage.removeItem(SAVED_CREDENTIALS_KEY)
      // 清空当前表单
      setUsername('')
      setPassword('')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username || !password) {
      toast.error('请输入用户名和密码')
      return
    }

    const supabase = createClient()
    setIsLoading(true)

    try {
      // 构造虚拟邮箱（统一使用小写）
      const virtualEmail = `${username.toLowerCase()}@neura.app`
      
      const { error } = await supabase.auth.signInWithPassword({
        email: virtualEmail,
        password
      })
      
      if (error) {
        console.error('Login error:', error)
        toast.error('登录失败：用户名或密码错误')
        return
      }

      // 登录成功后根据"记住我"状态保存登录信息
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true')
        localStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify({
          username,
          password
        }))
      } else {
        // 如果没有勾选"记住我"，确保清除之前可能保存的信息
        localStorage.removeItem(REMEMBER_ME_KEY)
        localStorage.removeItem(SAVED_CREDENTIALS_KEY)
      }

      // 显示成功提示动画
      setShowSuccessToast(true)
      
      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        router.replace('/')
        router.refresh()
      }, 1500) // 1.5秒后跳转
      
    } catch (error) {
      console.error('Login error:', error)
      toast.error('登录失败，请重试')
      setIsLoading(false)
    }
    // 注意：成功时不立即设置 isLoading 为 false，保持按钮状态直到跳转
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* 左侧登录表单 - 微微加宽 */}
      <div className="flex flex-col justify-start px-4 pt-12 pb-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24" style={{ flexBasis: '42%' }}>
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="text-center">
            <div className="flex items-center justify-center mb-[-40px]">
              <img 
                src="/providers/logos/logo1.svg" 
                alt="Neura Logo" 
                className="w-96 h-96"
              />
            </div>
          </div>

          <div className="mt-0 pt-0">
            <form onSubmit={handleLogin} className="space-y-6" autoComplete={rememberMe ? "on" : "off"}>
              <div>
                <Label htmlFor="username" className="block text-sm/6 font-medium text-gray-900">
                  用户名
                </Label>
                <div className="mt-2">
                  <Input
                    key={rememberMe ? "username-remember" : "username-no-remember"}
                    id="username"
                    name="username"
                    type="text"
                    required
                    autoComplete={rememberMe ? "username" : "off"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    className="block w-full rounded-lg bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 transition-all duration-200"
                    placeholder="请输入您的用户名"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="block text-sm/6 font-medium text-gray-900">
                  密码
                </Label>
                <div className="mt-2">
                  <Input
                    key={rememberMe ? "password-remember" : "password-no-remember"}
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete={rememberMe ? "current-password" : "off"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="block w-full rounded-lg bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 transition-all duration-200"
                    placeholder="请输入您的密码"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => handleRememberMeChange(e.target.checked)}
                    className="h-4 w-4 rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-600 transition-all duration-200"
                  />
                  <Label htmlFor="remember-me" className="ml-3 block text-sm text-gray-900">
                    记住我
                  </Label>
                </div>
                <div className="text-sm text-gray-500">
                  还没有账户？{' '}
                  <motion.div
                    variants={linkVariants}
                    whileHover="hover"
                    whileTap="tap"
                    className="inline-block"
                  >
                    <Link 
                      href="/register" 
                      className="font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      立即注册
                    </Link>
                  </motion.div>
                </div>
              </div>

              <div>
                <motion.div
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full justify-center rounded-lg bg-[#8a5cf6] px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-[#7c3aed] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a5cf6] transition-all duration-200 ease-out"
                  >
                    {isLoading ? '登录中...' : '登录'}
                  </Button>
                </motion.div>
              </div>
            </form>

            {/* 移除底部的注册链接，因为已经移到上面 */}
          </div>
        </div>
      </div>

      {/* 右侧品牌展示 - 增强遮罩效果 */}
      <div className="relative hidden lg:block" style={{ flexBasis: '58%' }}>
        <div className="absolute inset-0">
          <img
            alt="Neura AI招聘平台"
            src="/background.png"
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-10 left-10 right-10 text-white">
            <h3 className="text-2xl font-bold mb-2 drop-shadow-lg">从这里开始</h3>
            <p className="text-lg opacity-95 drop-shadow-md">
              Your next match is just one click away.
            </p>
          </div>
        </div>
      </div>
      
      {/* 成功提示组件 */}
      <SuccessToast 
        show={showSuccessToast} 
        message="登录成功！正在跳转..."
        onComplete={() => setShowSuccessToast(false)}
      />
    </div>
  )
} 