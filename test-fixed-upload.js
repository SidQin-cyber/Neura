// 测试修复后的候选人上传功能
// 运行方式: node test-fixed-upload.js

const testFixedUpload = async () => {
  const testData = [
    {
      name: "测试用户",
      title: "软件工程师",
      company: "测试公司",
      location: "北京",
      email: "test@example.com",
      phone: "13800138000",
      experience: 3,
      salary_min: 15000,
      salary_max: 25000,
      skills: ["JavaScript", "React", "Node.js"]
    }
  ]

  console.log('🧪 测试修复后的候选人上传功能...')
  console.log('📝 测试数据:', JSON.stringify(testData, null, 2))

  try {
    const response = await fetch('http://localhost:3002/api/upload/candidates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: testData })
    })

    console.log('📡 响应状态:', response.status, response.statusText)
    
    const result = await response.json()
    console.log('📨 响应结果:', JSON.stringify(result, null, 2))

    if (response.ok) {
      console.log('✅ 候选人上传修复成功！')
      console.log('📊 成功上传:', result.count, '条记录')
      console.log('💾 数据库ID:', result.ids)
    } else {
      console.log('❌ 候选人上传仍有问题:')
      console.log('🔍 错误信息:', result.error)
    }

  } catch (error) {
    console.error('🔥 测试异常:', error.message)
  }
}

// 运行测试
testFixedUpload() 