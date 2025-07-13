const { createClient } = require('@supabase/supabase-js');

// 创建 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

async function testSearchAPI() {
  console.log('🔍 测试搜索 API...');
  
  try {
    // 首先检查是否有测试数据
    const { data: resumes, error: fetchError } = await supabase
      .from('resumes')
      .select('id, name, current_title, location')
      .limit(5);
    
    if (fetchError) {
      console.error('❌ 获取简历数据失败:', fetchError);
      return;
    }
    
    console.log(`📊 数据库中有 ${resumes.length} 条简历记录`);
    resumes.forEach((resume, index) => {
      console.log(`${index + 1}. ${resume.name} - ${resume.current_title} (${resume.location})`);
    });
    
    if (resumes.length === 0) {
      console.log('⚠️  数据库中没有简历数据，请先上传一些测试数据');
      return;
    }
    
    // 生成测试向量
    const testVector = Array.from({ length: 1536 }, () => Math.random() - 0.5);
    const vectorString = `[${testVector.join(',')}]`;
    
    console.log('\n🔍 测试搜索函数...');
    
    // 调用搜索函数
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_candidates_rpc', {
        query_embedding: vectorString,
        query_text: '前端开发',
        similarity_threshold: 0.0,
        match_count: 10,
        location_filter: null,
        experience_min: null,
        experience_max: null,
        salary_min: null,
        salary_max: null,
        skills_filter: [],
        status_filter: 'active',
        user_id_param: null,
        fts_weight: 0.4,
        vector_weight: 0.6
      });
    
    if (searchError) {
      console.error('❌ 搜索失败:', searchError);
      return;
    }
    
    console.log(`✅ 搜索成功！返回 ${searchResults.length} 条结果`);
    
    if (searchResults.length > 0) {
      console.log('\n📊 搜索结果:');
      searchResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.name} - ${result.current_title}`);
        console.log(`   相似度: ${result.similarity.toFixed(4)}`);
        console.log(`   FTS分数: ${result.fts_rank.toFixed(4)}`);
        console.log(`   综合分数: ${result.combined_score.toFixed(4)}`);
        console.log('');
      });
    } else {
      console.log('📊 没有找到匹配的结果');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testSearchAPI(); 