#!/usr/bin/env node

/**
 * 混合搜索功能测试脚本
 * 验证向量搜索 + 全文搜索的混合模式是否正常工作
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3000/api';

async function testHybridSearch() {
  console.log('🧪 开始测试混合搜索功能...\n');
  
  const testCases = [
    {
      name: '精确匹配测试',
      query: '深圳的全栈工程师',
      mode: 'candidates',
      expectedBehavior: '应该返回李小明且综合分数 > 0.7'
    },
    {
      name: '关键词匹配测试',
      query: '全栈工程师',
      mode: 'candidates',
      expectedBehavior: '应该返回包含"全栈工程师"的候选人'
    },
    {
      name: '语义搜索测试',
      query: '前端开发专家',
      mode: 'candidates',
      expectedBehavior: '应该返回相关的前端开发人员'
    },
    {
      name: '职位搜索测试',
      query: '北京的Java开发工程师',
      mode: 'jobs',
      expectedBehavior: '应该返回相关的Java职位'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 执行测试: ${testCase.name}`);
    console.log(`   查询: "${testCase.query}"`);
    console.log(`   模式: ${testCase.mode}`);
    console.log(`   期望: ${testCase.expectedBehavior}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: testCase.query,
          mode: testCase.mode,
          filters: {}
        })
      });
      
      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        console.log(`   ✅ 成功返回 ${result.data.length} 个结果`);
        
        // 显示前3个结果的详情
        result.data.slice(0, 3).forEach((item, index) => {
          console.log(`   📊 结果 ${index + 1}:`);
          console.log(`      名称/标题: ${item.name || item.title}`);
          console.log(`      位置: ${item.location}`);
          console.log(`      相似度: ${(item.similarity * 100).toFixed(1)}%`);
          console.log(`      全文搜索分数: ${(item.fts_rank || 0).toFixed(4)}`);
          console.log(`      综合分数: ${((item.combined_score || item.similarity) * 100).toFixed(1)}%`);
        });
      } else {
        console.log(`   ⚠️  未找到匹配结果`);
      }
      
    } catch (error) {
      console.log(`   ❌ 测试失败: ${error.message}`);
    }
  }
  
  console.log('\n🏁 测试完成！');
  
  console.log('\n📈 优化建议:');
  console.log('   • 如果综合分数偏低，可以调整 fts_weight/vector_weight 权重');
  console.log('   • 如果中文分词效果不佳，可以尝试安装 zhparser 插件');
  console.log('   • 可以根据实际使用情况调整 similarity_threshold 阈值');
  
  console.log('\n🔧 权重调整方法:');
  console.log('   在 API 调用中添加参数:');
  console.log('   fts_weight: 0.4,    // 全文搜索权重');
  console.log('   vector_weight: 0.6  // 向量搜索权重');
}

// 检查服务器是否启动
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', mode: 'candidates' })
    });
    return true;
  } catch (error) {
    console.error('❌ 无法连接到服务器，请确保应用正在运行在 http://localhost:3000');
    console.error('   运行命令: npm run dev');
    return false;
  }
}

async function main() {
  if (await checkServer()) {
    await testHybridSearch();
  }
}

main().catch(console.error); 