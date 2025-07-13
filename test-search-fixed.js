// 测试搜索功能修复后的效果
const { createClient } = require('@supabase/supabase-js');

// 配置 Supabase 客户端
const supabaseUrl = 'http://localhost:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

// 测试搜索函数
async function testSearchFunctions() {
  console.log('🔍 测试搜索函数...\n');
  
  try {
    // 1. 先检查是否有测试数据
    const { data: resumes, error: resumeError } = await supabase
      .from('resumes')
      .select('id, name, current_title, location, embedding')
      .limit(5);
    
    if (resumeError) {
      console.error('❌ 获取简历数据失败:', resumeError);
      return;
    }
    
    console.log('📊 数据库中的简历数据:');
    resumes.forEach((resume, index) => {
      console.log(`${index + 1}. ${resume.name} - ${resume.current_title} (${resume.location})`);
      console.log(`   有向量: ${resume.embedding ? '✅' : '❌'}`);
    });
    
    console.log('\n');
    
    // 2. 测试搜索函数是否存在
    const { data: functions, error: funcError } = await supabase.rpc('search_candidates_rpc', {
      query_embedding: '[0.1,0.2,0.3]', // 假的向量，只是测试函数存在性
      query_text: 'test',
      similarity_threshold: 0.1,
      match_count: 1
    });
    
    if (funcError) {
      console.error('❌ 搜索函数调用失败:', funcError);
      
      // 检查具体的错误类型
      if (funcError.code === 'PGRST203') {
        console.log('🔧 这是函数重载冲突错误，需要修复函数定义');
      } else if (funcError.code === '42883') {
        console.log('🔧 函数不存在，需要创建函数');
      } else {
        console.log('🔧 其他错误:', funcError.code, funcError.message);
      }
    } else {
      console.log('✅ 搜索函数调用成功!');
      console.log('📊 返回结果数量:', functions?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testSearchFunctions(); 