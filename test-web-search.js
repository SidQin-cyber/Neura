const fetch = require('node-fetch');

async function testWebSearch() {
  console.log('🔍 测试 Web 应用搜索功能...');
  
  try {
    // 测试搜索 API 端点
    const response = await fetch('http://localhost:3000/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '深圳的前端开发',
        searchType: 'candidates',
        filters: {
          location: null,
          experience: { min: null, max: null },
          salary: { min: null, max: null },
          skills: []
        }
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ 搜索 API 调用成功!');
      console.log(`📊 返回状态码: ${response.status}`);
      console.log(`📊 返回数据类型: ${typeof result}`);
      
      if (result.candidates) {
        console.log(`📊 找到 ${result.candidates.length} 个候选人`);
        result.candidates.forEach((candidate, index) => {
          console.log(`${index + 1}. ${candidate.name} - ${candidate.current_title}`);
        });
      } else {
        console.log('📊 响应格式:', JSON.stringify(result, null, 2));
      }
    } else {
      console.error('❌ 搜索 API 调用失败:', response.status, result);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

// 运行测试
testWebSearch(); 