'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
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
      // 构造虚拟邮箱
      const virtualEmail = `${username}@neura.app`
      
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

      toast.success('登录成功')
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Login error:', error)
      toast.error('登录失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* 左侧登录表单 */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-8">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">N</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Neura</span>
            </div>
            <h2 className="text-2xl/9 font-bold tracking-tight text-gray-900">
              登录到您的账户
            </h2>
            <p className="mt-2 text-sm/6 text-gray-500">
              AI驱动的智能招聘平台
            </p>
          </div>

          <div className="mt-10">
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
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
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
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
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
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <Label htmlFor="remember-me" className="ml-3 block text-sm text-gray-900">
                    记住我
                  </Label>
                </div>
                <div className="text-sm text-gray-500">
                  还没有账户？{' '}
                  <Link 
                    href="/register" 
                    className="font-semibold text-indigo-600 hover:text-indigo-500"
                  >
                    立即注册
                  </Link>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  {isLoading ? '登录中...' : '登录'}
                </Button>
              </div>
            </form>

            {/* 移除底部的注册链接，因为已经移到上面 */}
          </div>
        </div>
      </div>

      {/* 右侧品牌展示 - 铺满整个高度 */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0">
          <img
            alt="Neura AI招聘平台"
            src="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1926&q=80"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 text-white">
            <h3 className="text-2xl font-bold mb-2">智能招聘，精准匹配</h3>
            <p className="text-lg opacity-90">
              使用AI技术为您找到最合适的候选人，让招聘变得简单高效
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 