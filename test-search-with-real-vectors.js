// 使用真实向量测试搜索功能
const { createClient } = require('@supabase/supabase-js');

// 配置 Supabase 客户端
const supabaseUrl = 'http://localhost:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

// 生成测试向量
function generateTestVector() {
  return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
}

// 测试搜索函数
async function testSearchWithRealVectors() {
  console.log('🔍 测试搜索功能（使用真实向量）...\n');
  
  try {
    // 1. 检查数据库中的数据
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
    
    // 2. 生成测试向量
    const testVector = generateTestVector();
    const testVectorStr = JSON.stringify(testVector);
    
    console.log('🔧 生成测试向量，维度:', testVector.length);
    console.log('🔧 向量前5个值:', testVector.slice(0, 5));
    console.log('');
    
    // 3. 测试搜索函数
    console.log('🔍 调用搜索函数...');
    const { data: searchResults, error: searchError } = await supabase.rpc('search_candidates_rpc', {
      query_embedding: testVectorStr,
      query_text: '深圳全栈开发',
      similarity_threshold: 0.0,
      match_count: 10,
      location_filter: null,
      experience_min: null,
      experience_max: null,
      salary_min: null,
      salary_max: null,
      skills_filter: [],
      status_filter: 'active',
      user_id: null, // 设置为 null 以测试
      fts_weight: 0.3,
      vector_weight: 0.7
    });
    
    if (searchError) {
      console.error('❌ 搜索函数调用失败:', searchError);
      return;
    }
    
    console.log('✅ 搜索函数调用成功!');
    console.log('📊 返回结果数量:', searchResults?.length || 0);
    
    if (searchResults && searchResults.length > 0) {
      console.log('\n🎯 搜索结果:');
      searchResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.name} - ${result.current_title} (${result.location})`);
        console.log(`   相似度: ${result.similarity?.toFixed(4) || 'N/A'}`);
        console.log(`   综合分数: ${result.combined_score?.toFixed(4) || 'N/A'}`);
        console.log('');
      });
    }
    
    console.log('🎉 搜索测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testSearchWithRealVectors(); 