const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 从环境变量中读取 Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 请设置环境变量 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseKey)

// 模拟 OpenAI embedding 生成（简单的随机向量）
function generateMockEmbedding() {
  const embedding = []
  for (let i = 0; i < 1536; i++) {
    embedding.push(Math.random() * 0.1 - 0.05) // 生成-0.05到0.05之间的随机数
  }
  return embedding
}

// 创建候选人embedding文本
function createCandidateEmbeddingText(candidate) {
  const parts = []
  
  if (candidate.name) parts.push(`姓名: ${candidate.name}`)
  if (candidate.title) parts.push(`职位: ${candidate.title}`)
  if (candidate.current_company) parts.push(`公司: ${candidate.current_company}`)
  if (candidate.location) parts.push(`地点: ${candidate.location}`)
  if (candidate.experience) parts.push(`经验: ${candidate.experience}`)
  if (candidate.skills && candidate.skills.length > 0) {
    parts.push(`技能: ${candidate.skills.join(', ')}`)
  }
  if (candidate.education) parts.push(`教育: ${candidate.education}`)
  
  return parts.join('\n')
}

// 解析薪资期望
function parseSalaryExpectation(salaryStr) {
  if (!salaryStr) return { min: null, max: null }
  
  const match = salaryStr.match(/(\d+)(?:000)?-(\d+)(?:000)?/)
  if (match) {
    const min = parseInt(match[1]) * (salaryStr.includes('000') ? 1 : 1000)
    const max = parseInt(match[2]) * (salaryStr.includes('000') ? 1 : 1000)
    return { min, max }
  }
  
  return { min: null, max: null }
}

// 解析经验年限
function parseExperience(expStr) {
  if (!expStr) return null
  const match = expStr.match(/(\d+)/)
  return match ? parseInt(match[1]) : null
}

// 测试用户ID（需要是已存在的用户）
const TEST_USER_ID = '39981515-46f9-4716-86f5-79ccd06d8c87' // 从终端日志中获取的用户ID

async function importTestCandidates() {
  console.log('🚀 开始导入测试候选人数据...')
  
  // 读取示例数据
  const candidatesPath = path.join(__dirname, '../public/examples/candidates-example.json')
  const candidatesData = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'))
  
  console.log(`📊 发现 ${candidatesData.length} 个候选人`)
  
  // 处理每个候选人
  for (const candidate of candidatesData) {
    try {
      console.log(`🔄 处理候选人: ${candidate.name}`)
      
      // 解析薪资期望
      const salary = parseSalaryExpectation(candidate.salary_expectation)
      
      // 准备数据
      const candidateData = {
        owner_id: TEST_USER_ID,
        name: candidate.name,
        email: candidate.email || null,
        phone: candidate.phone || null,
        current_title: candidate.title,
        current_company: candidate.current_company || null,
        location: candidate.location || null,
        years_of_experience: parseExperience(candidate.experience),
        expected_salary_min: salary.min,
        expected_salary_max: salary.max,
        skills: candidate.skills || [],
        education: candidate.education ? { degree: candidate.education } : null,
        experience: candidate.experience ? { years: candidate.experience } : null,
        status: 'active',
        raw_data: candidate
      }
      
      // 生成embedding文本
      const embeddingText = createCandidateEmbeddingText(candidateData)
      const embedding = generateMockEmbedding()
      
      console.log(`  - 生成embedding文本: ${embeddingText.substring(0, 100)}...`)
      console.log(`  - 生成embedding向量，维度: ${embedding.length}`)
      
      // 插入数据库
      const { data, error } = await supabase
        .from('resumes')
        .insert({
          ...candidateData,
          embedding: `[${embedding.join(',')}]`
        })
        .select('id, name')
        .single()
      
      if (error) {
        console.error(`❌ 插入 ${candidate.name} 失败:`, error)
        continue
      }
      
      console.log(`✅ 成功插入 ${candidate.name}，ID: ${data.id}`)
      
    } catch (error) {
      console.error(`❌ 处理 ${candidate.name} 时出错:`, error)
    }
  }
  
  console.log('🎉 测试数据导入完成!')
}

// 执行导入
importTestCandidates().catch(console.error) 