#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

// 创建 Supabase 客户端（使用服务角色密钥，绕过 RLS）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// OpenAI Embedding 生成函数
async function generateEmbedding(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-large',
        dimensions: 1536
      })
    })
    
    const result = await response.json()
    return result.data[0].embedding
  } catch (error) {
    console.error(`❌ 生成embedding失败: ${error.message}`)
    return null
  }
}

// 创建候选人的embedding文本
function createCandidateEmbeddingText(candidate) {
  const parts = []
  
  // 基本信息
  parts.push(`${candidate.current_title} @ ${candidate.current_company}`)
  parts.push(`${candidate.current_title} @ ${candidate.current_company}`)
  
  // 技能 (重复一遍增强权重)
  if (candidate.skills && candidate.skills.length > 0) {
    const skillsText = candidate.skills.join(' | ')
    parts.push(skillsText)
    parts.push(skillsText)
  }
  
  // 工作经验
  if (candidate.experience && candidate.experience.length > 0) {
    candidate.experience.forEach(exp => {
      parts.push(`${exp.position} (${exp.start_date} – ${exp.end_date})`)
      if (exp.achievements) {
        parts.push(exp.achievements.join('，'))
      }
    })
  }
  
  // 教育背景
  if (candidate.education) {
    parts.push(`${candidate.education.degree} @ ${candidate.education.school}`)
  }
  
  // 项目经验
  if (candidate.projects) {
    candidate.projects.forEach(project => {
      parts.push(project.name)
      if (project.highlights) {
        parts.push(project.highlights.join('，'))
      }
    })
  }
  
  return parts.join('\n')
}

async function directUploadCandidates() {
  console.log('🚀 直接上传候选人数据到数据库...')
  
  try {
    // 读取候选人数据
    const candidatesData = JSON.parse(fs.readFileSync('test-candidates-batch.json', 'utf8'))
    console.log(`📊 准备上传 ${candidatesData.length} 个候选人`)

    const processedData = []

    for (let i = 0; i < candidatesData.length; i++) {
      const candidate = candidatesData[i]
      console.log(`\n🔄 处理候选人 ${i + 1}: ${candidate.name}`)

      // 生成 embedding 文本
      const embeddingText = createCandidateEmbeddingText(candidate)
      console.log(`📝 Embedding文本: ${embeddingText.substring(0, 100)}...`)

      // 生成向量
      const embedding = await generateEmbedding(embeddingText)
      if (!embedding) {
        console.log(`⚠️ 跳过候选人 ${candidate.name}（向量生成失败）`)
        continue
      }
      console.log(`✅ 向量生成成功，维度: ${embedding.length}`)

      // 准备数据库记录
      const candidateRecord = {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        age: candidate.age,
        current_title: candidate.current_title,
        current_company: candidate.current_company,
        location: candidate.location,
        years_of_experience: candidate.years_of_experience,
        expected_salary_min: candidate.expected_salary_min,
        expected_salary_max: candidate.expected_salary_max,
        skills: candidate.skills,
        education: candidate.education,
        experience: candidate.experience,
        projects: candidate.projects,
        certifications: candidate.certifications,
        languages: candidate.languages,
        summary: candidate.summary,
        status: 'active',
        embedding: JSON.stringify(embedding),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      processedData.push(candidateRecord)
    }

    console.log(`\n📊 成功处理 ${processedData.length} 个候选人`)

    // 批量插入到数据库
    console.log('💾 插入数据库...')
    const { data, error } = await supabase
      .from('resumes')
      .insert(processedData)

    if (error) {
      console.error('❌ 数据库插入失败:', error)
      return false
    }

    console.log('✅ 所有候选人数据上传成功!')
    console.log(`📊 上传了 ${processedData.length} 个候选人`)

    // 验证数据
    const { count, error: countError } = await supabase
      .from('resumes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    if (!countError) {
      console.log(`🔍 数据库中现有 ${count} 个活跃候选人`)
    }

    return true

  } catch (error) {
    console.error('🚨 直接上传过程中出错:', error.message)
    return false
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  directUploadCandidates().then(success => {
    if (success) {
      console.log('\n🎉 数据上传完成！现在可以运行 Spark 测试了')
      console.log('运行命令: node scripts/quick-spark-test.js')
    } else {
      console.log('\n❌ 数据上传失败')
      process.exit(1)
    }
  })
}

module.exports = { directUploadCandidates } 