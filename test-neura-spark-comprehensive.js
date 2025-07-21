#!/usr/bin/env node

const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// 测试用例：50个不同场景、长度、职位的用户输入
const testCases = [
  // === 短文本测试 (1-10词) ===
  {
    id: 1,
    input: "java开发",
    expected: {
      search_type: "candidate",
      role: ["Java开发工程师"],
      skills_must: ["Java"]
    }
  },
  {
    id: 2,
    input: "我是前端",
    expected: {
      search_type: "job",
      role: ["前端工程师"],
      skills_must: []
    }
  },
  {
    id: 3,
    input: "5年经验产品经理",
    expected: {
      search_type: "candidate",
      role: ["产品经理"],
      experience_min: 5
    }
  },
  {
    id: 4,
    input: "ui设计师 北京",
    expected: {
      search_type: "candidate",
      role: ["UI设计师"],
      location: ["北京"]
    }
  },
  {
    id: 5,
    input: "python 数据分析师",
    expected: {
      search_type: "candidate",
      role: ["数据分析师"],
      skills_must: ["Python"]
    }
  },

  // === 中等长度测试 (10-30词) ===
  {
    id: 6,
    input: "招聘高级Java工程师，要求5年以上开发经验，熟悉Spring Boot和MySQL",
    expected: {
      search_type: "candidate",
      role: ["高级Java工程师"],
      skills_must: ["Java", "Spring Boot", "MySQL"],
      experience_min: 5
    }
  },
  {
    id: 7,
    input: "我有3年React开发经验，想在上海找前端工作，期望月薪25-30k",
    expected: {
      search_type: "job",
      role: ["前端工程师"],
      skills_must: ["React"],
      location: ["上海"],
      experience_min: 3,
      salary_min: 25000,
      salary_max: 30000
    }
  },
  {
    id: 8,
    input: "寻找产品经理，有互联网行业背景，懂用户体验设计，本科以上学历",
    expected: {
      search_type: "candidate",
      role: ["产品经理"],
      industry: ["互联网"],
      skills_must: ["用户体验设计"],
      education: ["本科"]
    }
  },
  {
    id: 9,
    input: "DevOps工程师招聘，熟悉k8s、docker、jenkins，有AWS云平台经验",
    expected: {
      search_type: "candidate",
      role: ["DevOps工程师"],
      skills_must: ["k8s", "docker", "jenkins", "AWS"]
    }
  },
  {
    id: 10,
    input: "我是数据科学家，精通Python、R、机器学习，希望找到年薪40万的工作",
    expected: {
      search_type: "job",
      role: ["数据科学家"],
      skills_must: ["Python", "R", "机器学习"],
      salary_min: 33333,
      salary_max: 33333
    }
  },

  // === 长文本测试 (30词以上) ===
  {
    id: 11,
    input: "我是一名有8年经验的全栈工程师，精通前端React、Vue、TypeScript，后端Node.js、Python Django，数据库PostgreSQL、MongoDB，有微服务架构经验，目前在腾讯工作，希望在深圳找到技术总监的职位，期望年薪80-100万",
    expected: {
      search_type: "job",
      role: ["技术总监", "全栈工程师"],
      skills_must: ["React", "Vue", "TypeScript", "Node.js", "Python", "Django", "PostgreSQL", "MongoDB"],
      experience_min: 8,
      location: ["深圳"],
      company: ["腾讯"],
      salary_min: 66667,
      salary_max: 83333
    }
  },
  {
    id: 12,
    input: "急招高级前端开发工程师，要求：1. 5年以上前端开发经验；2. 精通React、Vue框架；3. 熟悉TypeScript、Webpack、ESLint；4. 有移动端H5开发经验；5. 了解Node.js后端开发优先；6. 本科学历，计算机相关专业；7. 良好的团队合作能力；薪资面议，地点北京朝阳区",
    expected: {
      search_type: "candidate",
      role: ["高级前端开发工程师"],
      skills_must: ["React", "Vue", "TypeScript", "Webpack", "ESLint", "H5", "Node.js"],
      experience_min: 5,
      education: ["本科"],
      location: ["北京"]
    }
  },

  // === 口语化表达测试 ===
  {
    id: 13,
    input: "找个会做app的，ios android都要会",
    expected: {
      search_type: "candidate",
      role: ["移动端开发工程师"],
      skills_must: ["iOS", "Android"]
    }
  },
  {
    id: 14,
    input: "我刚毕业，学的是计算机，会点java和python，想找个实习",
    expected: {
      search_type: "job",
      role: ["实习生"],
      skills_must: ["Java", "Python"],
      education: ["本科"]
    }
  },
  {
    id: 15,
    input: "要个ui，会ps ai sketch的那种，最好还懂点交互",
    expected: {
      search_type: "candidate",
      role: ["UI设计师"],
      skills_must: ["PS", "AI", "Sketch", "交互设计"]
    }
  },

  // === 薪资表达多样性测试 ===
  {
    id: 16,
    input: "java开发 月薪15k-20k",
    expected: {
      search_type: "candidate",
      role: ["Java开发工程师"],
      skills_must: ["Java"],
      salary_min: 15000,
      salary_max: 20000
    }
  },
  {
    id: 17,
    input: "找工作 期望年薪36万",
    expected: {
      search_type: "job",
      salary_min: 30000,
      salary_max: 30000
    }
  },
  {
    id: 18,
    input: "产品经理 25w-35w年薪",
    expected: {
      search_type: "candidate",
      role: ["产品经理"],
      salary_min: 20833,
      salary_max: 29167
    }
  },

  // === 年龄性别测试 ===
  {
    id: 19,
    input: "找个25-30岁的男程序员，会java的",
    expected: {
      search_type: "candidate",
      role: ["程序员"],
      skills_must: ["Java"],
      gender: "男",
      age_min: 25,
      age_max: 30
    }
  },
  {
    id: 20,
    input: "我是女生，23岁，应届毕业生，想找前端开发工作",
    expected: {
      search_type: "job",
      role: ["前端开发工程师"],
      gender: "女",
      age_min: 23,
      age_max: 23
    }
  },

  // === 行业特定测试 ===
  {
    id: 21,
    input: "金融行业风控工程师，要求有机器学习和大数据经验",
    expected: {
      search_type: "candidate",
      role: ["风控工程师"],
      industry: ["金融"],
      skills_must: ["机器学习", "大数据"]
    }
  },
  {
    id: 22,
    input: "游戏开发unity c# 有手游经验的",
    expected: {
      search_type: "candidate",
      role: ["游戏开发工程师"],
      skills_must: ["Unity", "C#"],
      industry: ["游戏"]
    }
  },
  {
    id: 23,
    input: "我在电商公司做运营，想跳槽到字节跳动",
    expected: {
      search_type: "job",
      role: ["运营"],
      industry: ["电商"],
      company: ["字节跳动"]
    }
  },

  // === 技术栈组合测试 ===
  {
    id: 24,
    input: "全栈工程师 前端react vue 后端nodejs express mongodb",
    expected: {
      search_type: "candidate",
      role: ["全栈工程师"],
      skills_must: ["React", "Vue", "Node.js", "Express", "MongoDB"]
    }
  },
  {
    id: 25,
    input: "大数据开发 hadoop spark kafka elasticsearch",
    expected: {
      search_type: "candidate",
      role: ["大数据开发工程师"],
      skills_must: ["Hadoop", "Spark", "Kafka", "Elasticsearch"]
    }
  },

  // === 岗位级别测试 ===
  {
    id: 26,
    input: "高级算法工程师 深度学习 nlp cv方向",
    expected: {
      search_type: "candidate",
      role: ["高级算法工程师"],
      skills_must: ["深度学习", "NLP", "CV"]
    }
  },
  {
    id: 27,
    input: "技术总监 管理20人团队经验",
    expected: {
      search_type: "candidate",
      role: ["技术总监"]
    }
  },
  {
    id: 28,
    input: "我想找个架构师的工作，有10年开发经验",
    expected: {
      search_type: "job",
      role: ["架构师"],
      experience_min: 10
    }
  },

  // === 教育背景测试 ===
  {
    id: 29,
    input: "清华计算机硕士 算法工程师",
    expected: {
      search_type: "candidate",
      role: ["算法工程师"],
      education: ["硕士"]
    }
  },
  {
    id: 30,
    input: "海归博士 人工智能方向 希望在北京找研发工作",
    expected: {
      search_type: "job",
      role: ["研发工程师"],
      education: ["博士"],
      location: ["北京"],
      skills_must: ["人工智能"]
    }
  },

  // === 地域特色测试 ===
  {
    id: 31,
    input: "深圳南山区 产品经理 腾讯阿里背景优先",
    expected: {
      search_type: "candidate",
      role: ["产品经理"],
      location: ["深圳"],
      company: ["腾讯", "阿里"]
    }
  },
  {
    id: 32,
    input: "我在杭州，想找个python后端的工作，网易或者阿里",
    expected: {
      search_type: "job",
      role: ["后端工程师"],
      skills_must: ["Python"],
      location: ["杭州"],
      company: ["网易", "阿里"]
    }
  },

  // === 特殊技能测试 ===
  {
    id: 33,
    input: "区块链开发 solidity web3 defi经验",
    expected: {
      search_type: "candidate",
      role: ["区块链开发工程师"],
      skills_must: ["Solidity", "Web3", "DeFi"]
    }
  },
  {
    id: 34,
    input: "AI工程师 tensorflow pytorch transformer模型",
    expected: {
      search_type: "candidate",
      role: ["AI工程师"],
      skills_must: ["TensorFlow", "PyTorch", "Transformer"]
    }
  },

  // === 复杂场景测试 ===
  {
    id: 35,
    input: "我目前在美团做高级java开发，5年经验，想跳槽到字节跳动做后端架构师，期望薪资50-60k，地点北京或深圳都可以",
    expected: {
      search_type: "job",
      role: ["后端架构师"],
      skills_must: ["Java"],
      experience_min: 5,
      company: ["字节跳动"],
      salary_min: 50000,
      salary_max: 60000,
      location: ["北京", "深圳"]
    }
  },

  // === 边缘情况测试 ===
  {
    id: 36,
    input: "招人 要求：35岁以下 男性优先 985本科 5年以上经验",
    expected: {
      search_type: "candidate",
      age_max: 35,
      gender: "男",
      education: ["本科"],
      experience_min: 5
    }
  },
  {
    id: 37,
    input: "我是女程序员，想找个996不严重的公司",
    expected: {
      search_type: "job",
      role: ["程序员"],
      gender: "女"
    }
  },

  // === 实习/应届生测试 ===
  {
    id: 38,
    input: "应届生求职 计算机专业 实习过java开发",
    expected: {
      search_type: "job",
      role: ["Java开发工程师"],
      skills_must: ["Java"],
      education: ["本科"]
    }
  },
  {
    id: 39,
    input: "招实习生 前端方向 在校大学生",
    expected: {
      search_type: "candidate",
      role: ["实习生", "前端工程师"]
    }
  },

  // === 远程/兼职测试 ===
  {
    id: 40,
    input: "remote工作 python开发 可以远程",
    expected: {
      search_type: "candidate",
      role: ["Python开发工程师"],
      skills_must: ["Python"]
    }
  },
  {
    id: 41,
    input: "我想找个兼职的ui设计工作",
    expected: {
      search_type: "job",
      role: ["UI设计师"]
    }
  },

  // === 创业公司测试 ===
  {
    id: 42,
    input: "创业公司CTO 股权+期权 技术合伙人",
    expected: {
      search_type: "candidate",
      role: ["CTO", "技术合伙人"]
    }
  },

  // === 非技术岗位测试 ===
  {
    id: 43,
    input: "市场营销总监 有品牌推广经验 英语流利",
    expected: {
      search_type: "candidate",
      role: ["市场营销总监"],
      skills_must: ["品牌推广", "英语"]
    }
  },
  {
    id: 44,
    input: "我是HR，有5年招聘经验，想找个HRD的工作",
    expected: {
      search_type: "job",
      role: ["HRD"],
      experience_min: 5
    }
  },
  {
    id: 45,
    input: "财务经理 注册会计师 熟悉SAP系统",
    expected: {
      search_type: "candidate",
      role: ["财务经理"],
      skills_must: ["SAP"]
    }
  },

  // === 混合表达测试 ===
  {
    id: 46,
    input: "找个做小程序的，会微信开发，最好还懂点后台",
    expected: {
      search_type: "candidate",
      role: ["小程序开发工程师"],
      skills_must: ["微信开发", "小程序"]
    }
  },
  {
    id: 47,
    input: "我会flutter dart，想找移动端开发，android ios都可以做",
    expected: {
      search_type: "job",
      role: ["移动端开发工程师"],
      skills_must: ["Flutter", "Dart", "Android", "iOS"]
    }
  },

  // === 最后几个复杂测试 ===
  {
    id: 48,
    input: "高级前端+全栈，react/vue/angular都熟，node.js express koa，数据库mysql redis，有团队管理经验，坐标上海，期望40-50k",
    expected: {
      search_type: "candidate",
      role: ["高级前端工程师", "全栈工程师"],
      skills_must: ["React", "Vue", "Angular", "Node.js", "Express", "Koa", "MySQL", "Redis"],
      location: ["上海"],
      salary_min: 40000,
      salary_max: 50000
    }
  },
  {
    id: 49,
    input: "我在startup做了3年产品，熟悉b端saas产品设计，想去大厂做高级产品经理，最好是阿里腾讯字节",
    expected: {
      search_type: "job",
      role: ["高级产品经理"],
      experience_min: 3,
      skills_must: ["SaaS", "B端产品"],
      company: ["阿里", "腾讯", "字节"]
    }
  },
  {
    id: 50,
    input: "寻找资深golang开发工程师，要求：8年以上后端开发经验，精通gin、gorm、redis、kafka、elasticsearch，有大型分布式系统架构经验，熟悉云原生k8s docker，年薪60-80万，地点北京海淀区",
    expected: {
      search_type: "candidate",
      role: ["资深Golang开发工程师"],
      skills_must: ["Golang", "Gin", "GORM", "Redis", "Kafka", "Elasticsearch", "Kubernetes", "Docker"],
      experience_min: 8,
      salary_min: 50000,
      salary_max: 66667,
      location: ["北京"]
    }
  }
];

// 准确率评估函数
function evaluateAccuracy(expected, actual) {
  let score = 0;
  let total = 0;
  const issues = [];

  // 评估search_type (权重25%)
  if (expected.search_type) {
    total += 25;
    if (actual.search_type === expected.search_type) {
      score += 25;
    } else {
      issues.push(`search_type: expected "${expected.search_type}", got "${actual.search_type}"`);
    }
  }

  // 评估role (权重20%)
  if (expected.role && expected.role.length > 0) {
    total += 20;
    if (actual.role && actual.role.length > 0) {
      const expectedRoles = expected.role.map(r => r.toLowerCase());
      const actualRoles = actual.role.map(r => r.toLowerCase());
      const overlap = expectedRoles.filter(r => 
        actualRoles.some(ar => ar.includes(r) || r.includes(ar))
      ).length;
      const roleScore = (overlap / expectedRoles.length) * 20;
      score += roleScore;
      if (roleScore < 15) {
        issues.push(`role: expected ${JSON.stringify(expected.role)}, got ${JSON.stringify(actual.role)}`);
      }
    } else {
      issues.push(`role: expected ${JSON.stringify(expected.role)}, got empty`);
    }
  }

  // 评估skills_must (权重25%)
  if (expected.skills_must && expected.skills_must.length > 0) {
    total += 25;
    if (actual.skills_must && actual.skills_must.length > 0) {
      const expectedSkills = expected.skills_must.map(s => s.toLowerCase());
      const actualSkills = actual.skills_must.map(s => s.toLowerCase());
      const overlap = expectedSkills.filter(s => 
        actualSkills.some(as => as.includes(s) || s.includes(as))
      ).length;
      const skillScore = (overlap / expectedSkills.length) * 25;
      score += skillScore;
      if (skillScore < 20) {
        issues.push(`skills_must: expected ${JSON.stringify(expected.skills_must)}, got ${JSON.stringify(actual.skills_must)}`);
      }
    } else {
      issues.push(`skills_must: expected ${JSON.stringify(expected.skills_must)}, got empty`);
    }
  }

  // 评估数值字段 (总权重30%)
  const numericFields = ['experience_min', 'experience_max', 'salary_min', 'salary_max', 'age_min', 'age_max'];
  let numericFieldsChecked = 0;
  let numericFieldsCorrect = 0;

  numericFields.forEach(field => {
    if (expected[field] !== undefined) {
      numericFieldsChecked++;
      if (actual[field] !== undefined) {
        const expectedValue = expected[field];
        const actualValue = actual[field];
        // 允许 ±10% 的误差
        const tolerance = Math.max(Math.abs(expectedValue * 0.1), 100);
        if (Math.abs(actualValue - expectedValue) <= tolerance) {
          numericFieldsCorrect++;
        } else {
          issues.push(`${field}: expected ${expectedValue}, got ${actualValue}`);
        }
      } else {
        issues.push(`${field}: expected ${expected[field]}, got undefined`);
      }
    }
  });

  if (numericFieldsChecked > 0) {
    total += 30;
    score += (numericFieldsCorrect / numericFieldsChecked) * 30;
  }

  // 评估其他字段 (剩余权重)
  const otherFields = ['location', 'industry', 'education', 'company', 'gender'];
  let otherFieldsChecked = 0;
  let otherFieldsCorrect = 0;

  otherFields.forEach(field => {
    if (expected[field] !== undefined) {
      otherFieldsChecked++;
      if (Array.isArray(expected[field])) {
        if (actual[field] && Array.isArray(actual[field])) {
          const expectedArray = expected[field].map(item => item.toLowerCase());
          const actualArray = actual[field].map(item => item.toLowerCase());
          const overlap = expectedArray.filter(item => 
            actualArray.some(actualItem => actualItem.includes(item) || item.includes(actualItem))
          ).length;
          if (overlap >= expectedArray.length * 0.7) {
            otherFieldsCorrect++;
          } else {
            issues.push(`${field}: expected ${JSON.stringify(expected[field])}, got ${JSON.stringify(actual[field])}`);
          }
        } else {
          issues.push(`${field}: expected ${JSON.stringify(expected[field])}, got ${JSON.stringify(actual[field])}`);
        }
      } else {
        if (actual[field] === expected[field]) {
          otherFieldsCorrect++;
        } else {
          issues.push(`${field}: expected "${expected[field]}", got "${actual[field]}"`);
        }
      }
    }
  });

  if (otherFieldsChecked > 0) {
    const remainingWeight = 100 - total;
    total += remainingWeight;
    score += (otherFieldsCorrect / otherFieldsChecked) * remainingWeight;
  }

  return {
    score: Math.round(score),
    total: Math.round(total),
    percentage: Math.round((score / Math.max(total, 1)) * 100),
    issues
  };
}

// 调用解析API
async function callParseAPI(query) {
  try {
    const response = await fetch('http://localhost:3000/api/parse-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`API调用失败:`, error.message);
    return null;
  }
}

// 主测试函数
async function runBatchTest() {
  console.log('🚀 开始Neura Spark批量测试 (50个用例)');
  console.log('=' .repeat(80));

  const results = [];
  let totalScore = 0;
  let successCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📝 测试 ${testCase.id}/50: "${testCase.input}"`);
    
    const actual = await callParseAPI(testCase.input);
    
    if (!actual) {
      console.log('❌ API调用失败');
      results.push({
        id: testCase.id,
        input: testCase.input,
        success: false,
        accuracy: 0,
        issues: ['API调用失败']
      });
      continue;
    }

    const evaluation = evaluateAccuracy(testCase.expected, actual);
    totalScore += evaluation.percentage;
    
    if (evaluation.percentage >= 90) {
      successCount++;
      console.log(`✅ 准确率: ${evaluation.percentage}%`);
    } else if (evaluation.percentage >= 70) {
      console.log(`⚠️  准确率: ${evaluation.percentage}% (可接受)`);
      if (evaluation.issues.length > 0) {
        console.log(`   主要问题: ${evaluation.issues[0]}`);
      }
    } else {
      console.log(`❌ 准确率: ${evaluation.percentage}% (不合格)`);
      evaluation.issues.slice(0, 2).forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }

    results.push({
      id: testCase.id,
      input: testCase.input,
      expected: testCase.expected,
      actual: actual,
      success: true,
      accuracy: evaluation.percentage,
      issues: evaluation.issues
    });

    // 避免API限制，每个请求间隔100ms
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 生成测试报告
  console.log('\n' + '='.repeat(80));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(80));

  const avgAccuracy = totalScore / testCases.length;
  const excellentCount = results.filter(r => r.accuracy >= 90).length;
  const goodCount = results.filter(r => r.accuracy >= 70 && r.accuracy < 90).length;
  const poorCount = results.filter(r => r.accuracy < 70).length;

  console.log(`总测试用例: ${testCases.length}`);
  console.log(`平均准确率: ${avgAccuracy.toFixed(1)}%`);
  console.log(`优秀 (≥90%): ${excellentCount} (${(excellentCount/testCases.length*100).toFixed(1)}%)`);
  console.log(`良好 (70-89%): ${goodCount} (${(goodCount/testCases.length*100).toFixed(1)}%)`);
  console.log(`需改进 (<70%): ${poorCount} (${(poorCount/testCases.length*100).toFixed(1)}%)`);

  // 分析常见问题
  const allIssues = results.flatMap(r => r.issues);
  const issueTypes = {};
  allIssues.forEach(issue => {
    const type = issue.split(':')[0];
    issueTypes[type] = (issueTypes[type] || 0) + 1;
  });

  console.log('\n🔍 常见问题分析:');
  Object.entries(issueTypes)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}次`);
    });

  // 输出详细结果到文件
  const detailedReport = {
    summary: {
      total: testCases.length,
      averageAccuracy: avgAccuracy,
      excellent: excellentCount,
      good: goodCount,
      poor: poorCount
    },
    issueTypes,
    results: results.map(r => ({
      id: r.id,
      input: r.input,
      accuracy: r.accuracy,
      issues: r.issues,
      expected: r.expected,
      actual: r.actual
    }))
  };

  fs.writeFileSync('neura-spark-test-report.json', JSON.stringify(detailedReport, null, 2));
  console.log('\n📄 详细报告已保存到: neura-spark-test-report.json');

  // 结论建议
  console.log('\n💡 建议:');
  if (avgAccuracy >= 95) {
    console.log('✅ 解析质量优秀，可以投入生产使用');
  } else if (avgAccuracy >= 85) {
    console.log('⚠️  解析质量良好，建议针对主要问题进行优化');
  } else {
    console.log('❌ 解析质量需要改进，建议调整prompt或考虑使用更强的模型');
  }

  return avgAccuracy;
}

// 启动测试
if (require.main === module) {
  runBatchTest().catch(console.error);
}

module.exports = { testCases, runBatchTest }; 