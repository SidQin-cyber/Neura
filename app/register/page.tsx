'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return '密码长度至少8位'
    }
    return null
  }

  const validateUsername = (username: string) => {
    if (username.length < 3) {
      return '用户名长度至少3位'
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return '用户名只能包含字母、数字和下划线'
    }
    return null
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 表单验证
    if (!username || !password || !confirmPassword || !fullName) {
      toast.error('请填写所有必填字段')
      return
    }

    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    const usernameError = validateUsername(username)
    if (usernameError) {
      toast.error(usernameError)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          fullName
        })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || '注册失败')
        return
      }

      toast.success('注册成功！正在为您登录...')
      
      // 注册成功后自动登录
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email, // 使用返回的虚拟邮箱
        password
      })

      if (signInError) {
        toast.error('自动登录失败，请手动登录')
        router.push('/login')
      } else {
        router.push('/')
        router.refresh()
      }

    } catch (error) {
      console.error('Registration error:', error)
      toast.error('注册失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* 左侧注册表单 */}
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
              创建您的账户
            </h2>
            <p className="mt-2 text-sm/6 text-gray-500">
              加入AI驱动的智能招聘平台
            </p>
          </div>

          <div className="mt-10">
            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <Label htmlFor="fullName" className="block text-sm/6 font-medium text-gray-900">
                  姓名
                </Label>
                <div className="mt-2">
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                    placeholder="请输入您的姓名"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="username" className="block text-sm/6 font-medium text-gray-900">
                  用户名
                </Label>
                <div className="mt-2">
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                    placeholder="请输入用户名（至少3位）"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  只能包含字母、数字和下划线
                </p>
              </div>

              <div>
                <Label htmlFor="password" className="block text-sm/6 font-medium text-gray-900">
                  密码
                </Label>
                <div className="mt-2">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                    placeholder="请输入密码（至少8位）"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="block text-sm/6 font-medium text-gray-900">
                  确认密码
                </Label>
                <div className="mt-2">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                    placeholder="请再次输入密码"
                  />
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  {isLoading ? '注册中...' : '注册'}
                </Button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <div className="text-sm/6 text-gray-500">
                已有账户？{' '}
                <Link 
                  href="/login" 
                  className="font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  立即登录
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧品牌展示 - 铺满整个高度 */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0">
          <img
            alt="Neura AI招聘平台"
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1926&q=80"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 text-white">
            <h3 className="text-2xl font-bold mb-2">开启智能招聘之旅</h3>
            <p className="text-lg opacity-90">
              创建您的账户，体验AI驱动的智能招聘平台
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 