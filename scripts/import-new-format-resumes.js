/**
 * 数据注入脚本 - 支持新 Prompt 格式
 * 用于将本地生成的高质量 JSON 数据注入到 Supabase 数据库
 */

// 使用 CommonJS 语法以兼容当前项目
const { createClient } = require('@supabase/supabase-js')
const { config } = require('dotenv')
const fs = require('fs').promises
const path = require('path')

// 加载环境变量
config({ path: '.env.local' })

// 初始化客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的 Supabase 环境变量')
  console.error('需要: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!openaiApiKey) {
  console.error('❌ 缺少 OPENAI_API_KEY')
  console.error('请在 .env.local 中添加: OPENAI_API_KEY=your_api_key_here')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * 生成 embedding 向量
 */
async function generateEmbedding(text) {
  try {
    console.log('  → 正在生成 embedding...')
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large', // 使用 large 模型
        input: text,
        dimensions: 1536, // 压缩到 1536 维以兼容现有数据库
        encoding_format: 'float'
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`OpenAI API 错误: ${errorData.error?.message || response.statusText}`)
    }
    
    const data = await response.json()
    return data.data[0].embedding
  } catch (error) {
    console.error('  ❌ Embedding 生成失败:', error.message)
    return null
  }
}

/**
 * 处理单个简历文件
 */
async function processResumeFile(filePath) {
  const fileName = path.basename(filePath)
  console.log(`\n📄 正在处理: ${fileName}`)

  try {
    // 1. 读取本地 JSON 文件
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    
    // 验证数据格式
    if (!data.candidate || !data.embedding_text || !data.fts_document) {
      console.error('  ❌ JSON 格式错误，缺少必要字段 (candidate, embedding_text, fts_document)')
      return false
    }

    const { candidate, embedding_text, fts_document } = data

    // 验证 candidate 必要字段
    if (!candidate.name) {
      console.error('  ❌ candidate.name 字段缺失')
      return false
    }

    // 2. 生成向量
    const embedding = await generateEmbedding(embedding_text)
    if (!embedding) {
      console.error('  ❌ 跳过该文件')
      return false
    }

    // 3. 准备数据库记录 - 移除 owner_id 让其使用默认值NULL
    const resumeRecord = {
      // 展开 candidate 字段
      name: candidate.name,
      email: candidate.email || null,
      phone: candidate.phone || null,
      age: candidate.age || null,
      current_title: candidate.current_title || null,
      current_company: candidate.current_company || null,
      location: candidate.location || null,
      years_of_experience: candidate.years_of_experience || null,
      expected_salary_min: candidate.expected_salary_min || null,
      expected_salary_max: candidate.expected_salary_max || null,
      skills: candidate.skills || [],
      education: candidate.education || null,
      experience: candidate.experience || null,
      certifications: candidate.certifications || null,
      languages: candidate.languages || null,
      raw_data: candidate,
      
      // 新增字段
      fts_document_text: fts_document,
      embedding: `[${embedding.join(',')}]`, // 转换为 PostgreSQL vector 格式
      
      // 默认值
      status: 'active'
      // 注意：不设置 owner_id，让数据库使用默认值
    }

    // 4. 插入数据库 - 使用 RPC 函数或直接插入
    console.log('  → 正在写入数据库...')
    
    // 首先尝试直接插入
    let insertedData, error
    
    try {
      const result = await supabase
        .from('resumes')
        .insert(resumeRecord)
        .select('id, name')
        .single()
      
      insertedData = result.data
      error = result.error
    } catch (insertError) {
      // 如果直接插入失败，尝试使用 RPC
      console.log('  → 直接插入失败，尝试使用 RPC 函数...')
      
      try {
        const rpcResult = await supabase.rpc('insert_candidate_with_embedding', {
          p_owner_id: null,
          p_name: candidate.name,
          p_email: candidate.email,
          p_phone: candidate.phone,
          p_current_title: candidate.current_title,
          p_current_company: candidate.current_company,
          p_location: candidate.location,
          p_years_of_experience: candidate.years_of_experience,
          p_expected_salary_min: candidate.expected_salary_min,
          p_expected_salary_max: candidate.expected_salary_max,
          p_skills: candidate.skills || [],
          p_education: candidate.education,
          p_experience: candidate.experience,
          p_certifications: candidate.certifications,
          p_languages: candidate.languages,
          p_raw_data: candidate,
          p_status: 'active',
          p_embedding: `[${embedding.join(',')}]`
        })
        
        if (rpcResult.error) {
          throw rpcResult.error
        }
        
        // RPC 返回 ID，需要查询完整记录
        const selectResult = await supabase
          .from('resumes')
          .select('id, name')
          .eq('id', rpcResult.data)
          .single()
        
        insertedData = selectResult.data
        error = selectResult.error
        
      } catch (rpcError) {
        error = rpcError
      }
    }

    if (error) {
      console.error('  ❌ 数据库写入失败:', error.message)
      if (error.details) console.error('  详细信息:', error.details)
      
      // 如果是外键约束错误，提供解决建议
      if (error.message.includes('foreign key') || error.message.includes('owner_id')) {
        console.error('  💡 建议：这可能是外键约束问题，请确保数据库允许 owner_id 为 NULL')
      }
      return false
    }

    console.log(`  ✅ 写入成功: ${insertedData.name} (ID: ${insertedData.id})`)
    
    // 5. 更新 fts_document_text 字段（如果还没有设置）
    if (fts_document) {
      const { error: updateError } = await supabase
        .from('resumes')
        .update({ fts_document_text: fts_document })
        .eq('id', insertedData.id)
      
      if (updateError) {
        console.error('  ⚠️  更新 fts_document_text 失败:', updateError.message)
      } else {
        console.log('  ✅ fts_document_text 已更新')
      }
    }
    
    return true

  } catch (error) {
    console.error(`  ❌ 处理 ${fileName} 时发生错误:`, error.message)
    return false
  }
}

/**
 * 主函数
 */
async function main() {
  const resumesDir = process.argv[2] || './processed_resumes'
  
  console.log('🚀 开始数据注入流程')
  console.log(`📁 源目录: ${resumesDir}`)
  console.log(`🔗 目标数据库: ${supabaseUrl}`)
  
  try {
    // 检查目录是否存在
    await fs.access(resumesDir)
  } catch (error) {
    console.error(`❌ 目录不存在: ${resumesDir}`)
    console.log('💡 使用方法: node scripts/import-new-format-resumes.js [目录路径]')
    console.log('💡 当前创建了默认目录: processed_resumes/')
    console.log('💡 请将 JSON 文件放入该目录后重试')
    process.exit(1)
  }

  try {
    // 测试 Supabase 连接
    console.log('\n🔧 测试数据库连接...')
    const { data, error } = await supabase.from('resumes').select('count').limit(1)
    if (error) {
      console.error('❌ 数据库连接失败:', error.message)
      process.exit(1)
    }
    console.log('✅ 数据库连接正常')

    // 读取所有 JSON 文件
    const files = await fs.readdir(resumesDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    if (jsonFiles.length === 0) {
      console.log('📭 目录中没有找到 JSON 文件')
      console.log('💡 请将使用新 Prompt 格式生成的 JSON 文件放入目录中')
      return
    }

    console.log(`📊 找到 ${jsonFiles.length} 个 JSON 文件`)
    
    // 清空现有数据（可选）
    const clearData = process.argv.includes('--clear')
    if (clearData) {
      console.log('\n🗑️  正在清空现有数据...')
      const { error: deleteError } = await supabase
        .from('resumes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // 删除所有记录
      
      if (deleteError) {
        console.error('❌ 清空数据失败:', deleteError.message)
      } else {
        console.log('✅ 现有数据已清空')
      }
    }

    // 处理每个文件
    let successCount = 0
    let failCount = 0

    for (const file of jsonFiles) {
      const filePath = path.join(resumesDir, file)
      const success = await processResumeFile(filePath)
      
      if (success) {
        successCount++
      } else {
        failCount++
      }
    }

    // 输出统计结果
    console.log('\n📈 处理完成')
    console.log(`✅ 成功: ${successCount} 个`)
    console.log(`❌ 失败: ${failCount} 个`)
    console.log(`📊 总计: ${jsonFiles.length} 个`)

    // 重建向量索引（建议）
    if (successCount > 0) {
      console.log('\n💡 建议在 Supabase 控制台中重建向量索引以获得最佳性能:')
      console.log('   DROP INDEX IF EXISTS idx_resumes_embedding;')
      console.log('   CREATE INDEX idx_resumes_embedding ON resumes USING hnsw (embedding vector_cosine_ops);')
    }

  } catch (error) {
    console.error('❌ 处理过程中发生错误:', error.message)
    process.exit(1)
  }
}

// 运行主函数
main() 