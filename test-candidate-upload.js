// 测试候选人上传功能的脚本
// 运行方式: node test-candidate-upload.js

const testCandidateUpload = async () => {
  const testData = [
    {
      name: "张三",
      title: "全栈开发工程师",
      company: "阿里巴巴",
      location: "杭州",
      email: "zhangsan@example.com",
      phone: "13888888888",
      experience: 5,
      salary_min: 25000,
      salary_max: 35000,
      skills: ["JavaScript", "React", "Node.js", "TypeScript"],
      education: { degree: "本科", major: "计算机科学" },
      experience_records: { 
        total_years: 5, 
        companies: ["腾讯", "阿里巴巴"] 
      }
    },
    {
      name: "李四",
      title: "前端开发工程师", 
      company: "字节跳动",
      location: "北京",
      email: "lisi@example.com",
      phone: "13999999999",
      experience: 3,
      salary_min: 20000,
      salary_max: 28000,
      skills: ["React", "Vue.js", "CSS", "JavaScript"],
      education: { degree: "本科", major: "软件工程" },
      experience_records: { 
        total_years: 3, 
        companies: ["字节跳动"] 
      }
    }
  ]

  console.log('🧪 开始测试候选人上传功能...')
  console.log('📝 测试数据:', JSON.stringify(testData, null, 2))

  try {
    const response = await fetch('http://localhost:3002/api/upload/candidates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 注意：这里需要添加认证头，实际使用时需要先登录获取token
        // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      body: JSON.stringify({ data: testData })
    })

    console.log('📡 响应状态:', response.status, response.statusText)
    
    const result = await response.json()
    console.log('📨 响应数据:', JSON.stringify(result, null, 2))

    if (response.ok) {
      console.log('✅ 候选人上传测试成功！')
      console.log('📊 上传数量:', result.count)
      console.log('💾 数据库ID:', result.ids)
    } else {
      console.log('❌ 候选人上传测试失败:', result.error)
    }

  } catch (error) {
    console.error('🔥 测试异常:', error.message)
  }
}

// 运行测试
testCandidateUpload() 