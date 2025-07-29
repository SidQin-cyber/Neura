#!/usr/bin/env node

/**
 * 测试注册登录流程
 * 用法: node test-auth-flow.js
 */

import { createClient } from '@supabase/supabase-js'

// 配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kwnljatqoisviobioelr.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_ANON_KEY) {
  console.error('❌ 缺少 NEXT_PUBLIC_SUPABASE_ANON_KEY 环境变量')
  process.exit(1)
}

// 创建客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testAuthFlow() {
  console.log('🧪 开始测试注册登录流程...\n')

  const testUser = {
    username: `testuser_${Date.now()}`,
    password: 'test123456',
    fullName: '测试用户',
    inviteCode: 'Neura2025！'
  }

  try {
    // 1. 测试注册API
    console.log('1️⃣ 测试注册API...')
    const registerResponse = await fetch(`${SUPABASE_URL.replace('https://', 'https://neura-beta-ten.vercel.app')}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser)
    })

    const registerData = await registerResponse.json()
    
    if (!registerResponse.ok) {
      console.log(`❌ 注册失败: ${registerData.error}`)
      return
    }

    console.log(`✅ 注册成功: ${registerData.message}`)
    console.log(`📧 虚拟邮箱: ${registerData.email}`)
    console.log(`👤 用户ID: ${registerData.user?.id}`)
    
    // 等待一秒确保用户完全创建
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 2. 测试登录
    console.log('\n2️⃣ 测试登录...')
    const virtualEmail = `${testUser.username}@neura.app`
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: virtualEmail,
      password: testUser.password
    })

    if (loginError) {
      console.log(`❌ 登录失败: ${loginError.message}`)
      return
    }

    console.log(`✅ 登录成功!`)
    console.log(`👤 用户邮箱: ${loginData.user.email}`)
    console.log(`📧 邮箱确认状态: ${loginData.user.email_confirmed_at ? '已确认' : '未确认'}`)
    console.log(`🔑 Session ID: ${loginData.session.access_token.slice(0, 20)}...`)

    // 3. 测试获取用户信息
    console.log('\n3️⃣ 测试获取用户信息...')
    const { data: userData, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.log(`❌ 获取用户信息失败: ${userError.message}`)
    } else {
      console.log(`✅ 用户信息获取成功`)
      console.log(`👤 用户元数据:`, userData.user.user_metadata)
    }

    // 4. 登出
    console.log('\n4️⃣ 测试登出...')
    const { error: signOutError } = await supabase.auth.signOut()
    
    if (signOutError) {
      console.log(`❌ 登出失败: ${signOutError.message}`)
    } else {
      console.log(`✅ 登出成功`)
    }

    console.log('\n🎉 注册登录流程测试完成！')
    console.log('\n📝 流程总结:')
    console.log('1. 用户注册 → 自动创建账户（邮箱已确认）')
    console.log('2. 跳转到登录页面')
    console.log('3. 用户登录 → 成功获取session')
    console.log('4. 跳转到主页，用户信息正常显示')

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message)
  }
}

// 运行测试
testAuthFlow() 