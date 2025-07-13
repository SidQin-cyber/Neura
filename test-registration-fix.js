// 测试注册功能的脚本
// 运行方式: node test-registration-fix.js

const testRegistration = async () => {
  const testUser = {
    username: `testuser_${Date.now()}`,
    password: '12345678',
    fullName: 'Test User Fix'
  }

  console.log('🧪 开始测试注册功能...')
  console.log('📝 测试用户信息:', testUser)

  try {
    const response = await fetch('http://localhost:3002/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser)
    })

    console.log('📡 响应状态:', response.status, response.statusText)
    
    const data = await response.json()
    console.log('📨 响应数据:', JSON.stringify(data, null, 2))

    if (response.ok) {
      console.log('✅ 注册测试成功！')
      console.log('👤 用户ID:', data.user?.id)
      console.log('📧 虚拟邮箱:', data.email)
      console.log('📋 档案ID:', data.user?.profileId)
    } else {
      console.log('❌ 注册测试失败:', data.error)
    }

  } catch (error) {
    console.error('🔥 测试异常:', error.message)
  }
}

// 运行测试
testRegistration() 