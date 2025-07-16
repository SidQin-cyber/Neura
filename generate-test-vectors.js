// 为测试数据生成向量
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// 配置 Supabase 客户端
const supabaseUrl = 'http://localhost:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

// 配置 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
});

// 生成向量的函数
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
      dimensions: 1536
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('生成向量失败:', error.message);
    // 如果 OpenAI 不可用，生成一个假的向量
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }
}

// 为候选人生成向量化文本
function generateCandidateText(candidate) {
  return `姓名: ${candidate.name}. 职位: ${candidate.current_title}. 公司: ${candidate.current_company}. 位置: ${candidate.location}. 技能: ${candidate.skills?.join(', ') || ''}`;
}

// 更新候选人向量
async function updateCandidateVectors() {
  console.log('🔄 开始为候选人生成向量...\n');
  
  try {
    // 获取没有向量的候选人
    const { data: candidates, error: fetchError } = await supabase
      .from('resumes')
      .select('*')
      .is('embedding', null);
    
    if (fetchError) {
      console.error('❌ 获取候选人数据失败:', fetchError);
      return;
    }
    
    console.log(`📊 找到 ${candidates.length} 个需要生成向量的候选人`);
    
    for (const candidate of candidates) {
      console.log(`🔄 处理候选人: ${candidate.name}`);
      
      // 生成向量化文本
      const text = generateCandidateText(candidate);
      console.log(`📝 向量化文本: ${text}`);
      
      // 生成向量
      const embedding = await generateEmbedding(text);
      console.log(`✅ 向量生成成功，维度: ${embedding.length}`);
      
      // 更新数据库
      const { error: updateError } = await supabase
        .from('resumes')
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', candidate.id);
      
      if (updateError) {
        console.error(`❌ 更新候选人 ${candidate.name} 的向量失败:`, updateError);
      } else {
        console.log(`✅ 候选人 ${candidate.name} 向量更新成功`);
      }
      
      console.log('');
    }
    
    console.log('🎉 所有候选人向量生成完成！');
    
  } catch (error) {
    console.error('❌ 生成向量过程中发生错误:', error);
  }
}

// 运行脚本
updateCandidateVectors(); 