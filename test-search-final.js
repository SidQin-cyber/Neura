#!/usr/bin/env node

console.log('🔍 测试搜索功能最终修复...');

// 测试数据
const testCases = [
  {
    name: '候选人搜索 - 深圳全栈工程师',
    request: {
      query: '深圳全栈工程师',
      mode: 'candidates',
      filters: {}
    }
  },
  {
    name: '职位搜索 - 全栈工程师',
    request: {
      query: '全栈工程师',
      mode: 'jobs',
      filters: {}
    }
  },
  {
    name: '候选人搜索 - React开发者',
    request: {
      query: 'React开发者',
      mode: 'candidates',
      filters: {}
    }
  }
];

async function testSearch(testCase) {
  try {
    console.log(`\n📋 测试: ${testCase.name}`);
    
    const response = await fetch('http://localhost:3002/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCase.request)
    });
    
    const result = await response.json();
    
    console.log(`- 状态码: ${response.status}`);
    console.log(`- 成功: ${result.success}`);
    
    if (result.success) {
      console.log(`✅ 测试通过! 找到 ${result.data?.length || 0} 个结果`);
      if (result.data && result.data.length > 0) {
        console.log('- 前2个结果:');
        result.data.slice(0, 2).forEach((item, index) => {
          const name = item.name || item.title;
          const title = item.current_title || item.company;
          const score = item.match_score || Math.round(item.similarity * 100);
          console.log(`  ${index + 1}. ${name} (${title}) - 匹配度: ${score}%`);
        });
      }
    } else {
      console.log(`❌ 测试失败: ${result.error}`);
    }
    
  } catch (error) {
    console.error(`❌ 测试异常: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('🚀 开始运行所有测试...\n');
  
  for (const testCase of testCases) {
    await testSearch(testCase);
    // 等待一秒钟避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 所有测试完成!');
  console.log('\n💡 提示: 如果看到 "Unauthorized" 错误，请先在浏览器中登录 http://localhost:3002');
}

// 运行测试
runAllTests().catch(console.error); 