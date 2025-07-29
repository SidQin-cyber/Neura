import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// 辅助函数：等待并重试创建用户档案
async function createUserProfileWithRetry(
  supabase: any,
  userId: string,
  fullName: string,
  username: string,
  maxRetries = 3
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 等待时间递增：1秒, 2秒, 3秒
      const waitTime = (i + 1) * 1000
      await new Promise(resolve => setTimeout(resolve, waitTime))
      
      console.log(`📝 尝试创建用户档案 (第${i + 1}次尝试)...`)
      
      const { data: profileData, error: profileError } = await supabase.rpc('create_user_profile', {
        p_user_id: userId,
        p_full_name: fullName,
        p_username: username,
        p_role: 'recruiter'
      })

      if (profileError) {
        console.error(`❌ 第${i + 1}次创建档案失败:`, profileError)
        
        // 如果是最后一次尝试，抛出错误
        if (i === maxRetries - 1) {
          throw profileError
        }
        
        // 如果不是用户不存在的错误，直接抛出
        if (!profileError.message.includes('User does not exist')) {
          throw profileError
        }
        
        // 继续重试
        continue
      }

      console.log('✅ 用户档案创建成功，ID:', profileData)
      return profileData
      
    } catch (error) {
      console.error(`❌ 第${i + 1}次创建档案异常:`, error)
      
      // 如果是最后一次尝试，抛出错误
      if (i === maxRetries - 1) {
        throw error
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, fullName, inviteCode } = await request.json()

    // 🔥 添加邀请码验证
    if (inviteCode !== 'Neura2025！') {
      return NextResponse.json(
        { error: '邀请码错误，请检查大小写和符号' },
        { status: 400 }
      )
    }

    // 验证输入
    if (!username || !password || !fullName) {
      return NextResponse.json(
        { error: '请填写所有必填字段' },
        { status: 400 }
      )
    }

    // 验证用户名格式
    if (username.length < 3) {
      return NextResponse.json(
        { error: '用户名长度至少3位' },
        { status: 400 }
      )
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: '用户名只能包含字母、数字和下划线' },
        { status: 400 }
      )
    }

    // 验证密码长度
    if (password.length < 8) {
      return NextResponse.json(
        { error: '密码长度至少8位' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 生成虚拟邮箱（统一使用小写）
    const virtualEmail = `${username.toLowerCase()}@neura.app`

    // 检查用户名是否已存在
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: '用户名已存在，请选择其他用户名' },
        { status: 400 }
      )
    }

    // 创建用户
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: virtualEmail,
      password: password,
      options: {
        data: {
          full_name: fullName,
          username: username
        }
      }
    })

    if (authError) {
      console.error('注册失败:', authError)
      return NextResponse.json(
        { error: '注册失败：' + authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: '注册失败：用户创建失败' },
        { status: 400 }
      )
    }

    console.log('📧 开始确认邮箱和创建档案...', {
      userId: authData.user.id,
      email: virtualEmail
    })

    // 自动确认邮箱 - 使用 Service Role 客户端
    try {
      const serviceClient = createServiceRoleClient()
      
      // 检查 Service Role Key 是否存在
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY 未配置，跳过邮箱自动确认')
      } else {
        const { error: confirmError } = await serviceClient.rpc('confirm_user_email', {
          user_email: virtualEmail
        })
        
        if (confirmError) {
          console.error('⚠️ 邮箱确认失败:', confirmError)
        } else {
          console.log('✅ 邮箱确认成功')
        }
      }
    } catch (confirmError) {
      console.error('⚠️ 邮箱确认异常:', confirmError)
      // 不阻止流程，因为用户可能已经创建成功
    }

    // 使用重试机制创建用户档案
    try {
      const profileData = await createUserProfileWithRetry(
        supabase,
        authData.user.id,
        fullName,
        username
      )

      return NextResponse.json({
        success: true,
        message: '注册成功',
        email: virtualEmail,
        user: {
          id: authData.user.id,
          username: username,
          fullName: fullName,
          profileId: profileData
        }
      })
      
    } catch (profileError) {
      console.error('📝 用户档案创建最终失败:', profileError)
      
      // 即使档案创建失败，用户仍然创建成功了
      // 返回部分成功的状态，用户可以稍后完善档案
      return NextResponse.json({
        success: true,
        message: '注册成功，但档案创建失败，请联系管理员',
        email: virtualEmail,
        user: {
          id: authData.user.id,
          username: username,
          fullName: fullName
        },
        warning: '用户档案创建失败：' + (profileError instanceof Error ? profileError.message : '未知错误')
      }, { status: 201 }) // 201 表示部分成功
    }

  } catch (error) {
    console.error('注册API错误:', error)
    return NextResponse.json(
      { error: '服务器错误，请重试' },
      { status: 500 }
    )
  }
} 