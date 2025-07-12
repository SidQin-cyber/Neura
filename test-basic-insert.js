const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 测试基础插入功能...')

const supabase = createClient(supabaseUrl, supabaseKey)

async function testBasicInsert() {
  try {
    // 1. 测试简单的插入（不含embedding）
    console.log('\n📝 测试简单插入...')
    const testData = {
      name: '测试候选人',
      current_title: '测试工程师',
      location: '测试城市',
      status: 'active'
    }

    const { data: insertResult, error: insertError } = await supabase
      .from('resumes')
      .insert(testData)
      .select()

    if (insertError) {
      console.error('❌ 简单插入失败:', insertError)
    } else {
      console.log('✅ 简单插入成功:', insertResult)
    }

    // 2. 检查数据是否真的插入了
    console.log('\n🔍 检查插入的数据...')
    const { data: checkResult, error: checkError } = await supabase
      .from('resumes')
      .select('*')
      .eq('name', '测试候选人')

    if (checkError) {
      console.error('❌ 数据检查失败:', checkError)
    } else {
      console.log('✅ 数据检查结果:', checkResult)
    }

    // 3. 测试RPC函数是否存在
    console.log('\n🔧 测试RPC函数...')
    const { data: rpcResult, error: rpcError } = await supabase.rpc('insert_candidate_with_embedding', {
      p_owner_id: '00000000-0000-0000-0000-000000000000',
      p_name: 'RPC测试',
      p_email: 'test@test.com',
      p_phone: '123456789',
      p_current_title: 'RPC工程师',
      p_current_company: 'RPC公司',
      p_location: 'RPC城市',
      p_years_of_experience: 5,
      p_expected_salary_min: 20000,
      p_expected_salary_max: 30000,
      p_skills: ['test'],
      p_education: { degree: 'test' },
      p_experience: { company: 'test' },
      p_certifications: { cert: 'test' },
      p_languages: { lang: 'test' },
      p_raw_data: { test: 'data' },
      p_status: 'active',
      p_embedding: '[0.1,0.2,0.3]' // 简短的测试embedding
    })

    if (rpcError) {
      console.error('❌ RPC函数测试失败:', {
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code
      })
    } else {
      console.log('✅ RPC函数测试成功:', rpcResult)
    }

    // 4. 清理测试数据
    console.log('\n🧹 清理测试数据...')
    await supabase.from('resumes').delete().eq('name', '测试候选人')
    console.log('✅ 测试数据清理完成')

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

testBasicInsert() 