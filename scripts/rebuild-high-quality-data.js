const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 生成高质量embedding的prompt
function generateHighQualityEmbeddingText(candidate) {
  // 使用更结构化、更语义化的prompt
  const parts = []
  
  // 1. 核心职位信息
  if (candidate.current_title) {
    parts.push(`职位: ${candidate.current_title}`)
  }
  
  // 2. 技能清单
  if (candidate.skills && candidate.skills.length > 0) {
    parts.push(`技能: ${candidate.skills.join(', ')}`)
  }
  
  // 3. 经验描述
  if (candidate.years_of_experience) {
    parts.push(`${candidate.years_of_experience}年工作经验`)
  }
  
  // 4. 领域描述
  if (candidate.domain) {
    parts.push(`专业领域: ${candidate.domain}`)
  }
  
  // 5. 关键词增强
  if (candidate.keywords) {
    parts.push(`关键词: ${candidate.keywords.join(' ')}`)
  }
  
  return parts.join(' | ')
}

// 高质量候选人数据 (30-50个)
const highQualityCandidates = [
  // 前端开发 (8个)
  {
    name: '王前端',
    current_title: '高级前端开发工程师',
    skills: ['React', 'Vue', 'JavaScript', 'TypeScript', 'HTML5', 'CSS3'],
    domain: '前端开发',
    keywords: ['frontend', 'web开发', 'UI开发', '用户界面'],
    years_of_experience: 5,
    location: '北京',
    expected_salary_min: 20000,
    expected_salary_max: 30000
  },
  {
    name: '李React',
    current_title: 'React开发专家',
    skills: ['React', 'Redux', 'Next.js', 'JavaScript', 'Node.js'],
    domain: 'React生态',
    keywords: ['react', 'frontend', 'spa', '单页应用'],
    years_of_experience: 6,
    location: '上海',
    expected_salary_min: 25000,
    expected_salary_max: 35000
  },
  {
    name: '张Vue',
    current_title: 'Vue.js前端架构师',
    skills: ['Vue.js', 'Vuex', 'Nuxt.js', 'JavaScript', 'Element UI'],
    domain: 'Vue技术栈',
    keywords: ['vue', 'frontend', 'mvvm', '响应式'],
    years_of_experience: 7,
    location: '深圳',
    expected_salary_min: 28000,
    expected_salary_max: 38000
  },
  {
    name: '陈前端架构',
    current_title: '前端架构师',
    skills: ['React', 'Vue', 'Angular', 'Webpack', 'Micro Frontend'],
    domain: '前端架构',
    keywords: ['frontend', 'architecture', '架构师', '微前端'],
    years_of_experience: 8,
    location: '杭州',
    expected_salary_min: 30000,
    expected_salary_max: 45000
  },
  {
    name: '刘UI专家',
    current_title: 'UI开发工程师',
    skills: ['HTML5', 'CSS3', 'SASS', 'JavaScript', 'Bootstrap'],
    domain: 'UI开发',
    keywords: ['UI', 'frontend', '用户界面', '界面开发'],
    years_of_experience: 4,
    location: '广州',
    expected_salary_min: 18000,
    expected_salary_max: 28000
  },
  {
    name: '赵Angular',
    current_title: 'Angular开发工程师',
    skills: ['Angular', 'TypeScript', 'RxJS', 'NgRx', 'Material Design'],
    domain: 'Angular框架',
    keywords: ['angular', 'frontend', 'typescript', 'spa'],
    years_of_experience: 5,
    location: '成都',
    expected_salary_min: 22000,
    expected_salary_max: 32000
  },
  {
    name: '孙Web开发',
    current_title: 'Web前端开发工程师',
    skills: ['JavaScript', 'HTML', 'CSS', 'jQuery', 'Bootstrap'],
    domain: 'Web开发',
    keywords: ['web', 'frontend', '网页开发', '前端'],
    years_of_experience: 3,
    location: '武汉',
    expected_salary_min: 15000,
    expected_salary_max: 25000
  },
  {
    name: '周全栈前端',
    current_title: '全栈前端工程师',
    skills: ['React', 'Node.js', 'Express', 'MongoDB', 'JavaScript'],
    domain: '全栈开发',
    keywords: ['fullstack', 'frontend', '全栈', 'javascript'],
    years_of_experience: 6,
    location: '南京',
    expected_salary_min: 25000,
    expected_salary_max: 35000
  },

  // Java后端 (8个)
  {
    name: '马Java',
    current_title: '高级Java开发工程师',
    skills: ['Java', 'Spring', 'Spring Boot', 'MySQL', 'Redis'],
    domain: 'Java后端',
    keywords: ['java', 'backend', '后端', 'spring'],
    years_of_experience: 6,
    location: '北京',
    expected_salary_min: 25000,
    expected_salary_max: 35000
  },
  {
    name: '吴Spring',
    current_title: 'Spring框架专家',
    skills: ['Java', 'Spring Framework', 'Spring Boot', 'Spring Cloud', 'Microservices'],
    domain: 'Spring生态',
    keywords: ['spring', 'java', 'backend', '微服务'],
    years_of_experience: 7,
    location: '上海',
    expected_salary_min: 28000,
    expected_salary_max: 40000
  },
  {
    name: '徐后端架构',
    current_title: 'Java后端架构师',
    skills: ['Java', 'Spring Cloud', 'Dubbo', 'Kafka', 'Elasticsearch'],
    domain: '后端架构',
    keywords: ['java', 'architect', '架构师', 'backend'],
    years_of_experience: 9,
    location: '深圳',
    expected_salary_min: 35000,
    expected_salary_max: 50000
  },
  {
    name: '朱微服务',
    current_title: '微服务架构工程师',
    skills: ['Java', 'Spring Cloud', 'Docker', 'Kubernetes', 'Gateway'],
    domain: '微服务',
    keywords: ['microservices', 'java', '微服务', 'cloud'],
    years_of_experience: 5,
    location: '杭州',
    expected_salary_min: 22000,
    expected_salary_max: 35000
  },
  {
    name: '胡数据库',
    current_title: 'Java数据库开发专家',
    skills: ['Java', 'MySQL', 'PostgreSQL', 'MyBatis', 'JPA'],
    domain: '数据库开发',
    keywords: ['java', 'database', '数据库', 'backend'],
    years_of_experience: 6,
    location: '广州',
    expected_salary_min: 24000,
    expected_salary_max: 34000
  },
  {
    name: '林Java高级',
    current_title: '资深Java工程师',
    skills: ['Java', 'JVM', 'Concurrency', 'Design Patterns', 'Algorithm'],
    domain: 'Java核心',
    keywords: ['java', 'senior', '资深', 'jvm'],
    years_of_experience: 8,
    location: '成都',
    expected_salary_min: 30000,
    expected_salary_max: 42000
  },
  {
    name: '黄Web后端',
    current_title: 'Web后端开发工程师',
    skills: ['Java', 'Servlet', 'JSP', 'Tomcat', 'Maven'],
    domain: 'Web后端',
    keywords: ['java', 'web', 'backend', '后端'],
    years_of_experience: 4,
    location: '武汉',
    expected_salary_min: 18000,
    expected_salary_max: 28000
  },
  {
    name: '蔡分布式',
    current_title: '分布式系统工程师',
    skills: ['Java', 'Distributed Systems', 'Zookeeper', 'RocketMQ', 'Sharding'],
    domain: '分布式系统',
    keywords: ['distributed', 'java', '分布式', 'system'],
    years_of_experience: 7,
    location: '西安',
    expected_salary_min: 26000,
    expected_salary_max: 38000
  },

  // Python AI/数据 (8个)
  {
    name: '韩AI工程师',
    current_title: '人工智能工程师',
    skills: ['Python', 'TensorFlow', 'PyTorch', 'Machine Learning', 'Deep Learning'],
    domain: '人工智能',
    keywords: ['ai', 'artificial intelligence', '人工智能', 'ml'],
    years_of_experience: 5,
    location: '北京',
    expected_salary_min: 30000,
    expected_salary_max: 45000
  },
  {
    name: '冯机器学习',
    current_title: '机器学习工程师',
    skills: ['Python', 'Scikit-learn', 'Pandas', 'NumPy', 'Jupyter'],
    domain: '机器学习',
    keywords: ['machine learning', 'ml', '机器学习', 'ai'],
    years_of_experience: 4,
    location: '上海',
    expected_salary_min: 25000,
    expected_salary_max: 38000
  },
  {
    name: '邓数据科学家',
    current_title: '数据科学家',
    skills: ['Python', 'R', 'Statistics', 'Data Mining', 'Visualization'],
    domain: '数据科学',
    keywords: ['data science', '数据科学', 'analytics', 'python'],
    years_of_experience: 6,
    location: '深圳',
    expected_salary_min: 28000,
    expected_salary_max: 42000
  },
  {
    name: '梁数据分析师',
    current_title: '数据分析师',
    skills: ['Python', 'SQL', 'Pandas', 'Matplotlib', 'Tableau'],
    domain: '数据分析',
    keywords: ['data analysis', '数据分析', 'analytics', 'python'],
    years_of_experience: 3,
    location: '杭州',
    expected_salary_min: 18000,
    expected_salary_max: 28000
  },
  {
    name: '潘深度学习',
    current_title: '深度学习工程师',
    skills: ['Python', 'PyTorch', 'CNN', 'RNN', 'Computer Vision'],
    domain: '深度学习',
    keywords: ['deep learning', '深度学习', 'neural network', 'ai'],
    years_of_experience: 5,
    location: '广州',
    expected_salary_min: 26000,
    expected_salary_max: 40000
  },
  {
    name: '谢NLP专家',
    current_title: 'NLP算法工程师',
    skills: ['Python', 'NLTK', 'spaCy', 'Transformers', 'BERT'],
    domain: '自然语言处理',
    keywords: ['nlp', 'natural language', '自然语言', 'text'],
    years_of_experience: 4,
    location: '成都',
    expected_salary_min: 24000,
    expected_salary_max: 36000
  },
  {
    name: '薛算法工程师',
    current_title: '算法工程师',
    skills: ['Python', 'Algorithm', 'Data Structure', 'Optimization', 'Math'],
    domain: '算法开发',
    keywords: ['algorithm', '算法', 'optimization', 'python'],
    years_of_experience: 5,
    location: '武汉',
    expected_salary_min: 22000,
    expected_salary_max: 35000
  },
  {
    name: '董Python后端',
    current_title: 'Python后端工程师',
    skills: ['Python', 'Django', 'Flask', 'FastAPI', 'PostgreSQL'],
    domain: 'Python后端',
    keywords: ['python', 'backend', '后端', 'web'],
    years_of_experience: 4,
    location: '南京',
    expected_salary_min: 20000,
    expected_salary_max: 30000
  },

  // DevOps/运维 (6个)
  {
    name: '段DevOps',
    current_title: 'DevOps工程师',
    skills: ['Docker', 'Kubernetes', 'Jenkins', 'Ansible', 'Terraform'],
    domain: 'DevOps',
    keywords: ['devops', '运维', 'ops', 'automation'],
    years_of_experience: 5,
    location: '北京',
    expected_salary_min: 25000,
    expected_salary_max: 38000
  },
  {
    name: '范云原生',
    current_title: '云原生工程师',
    skills: ['Kubernetes', 'Docker', 'Helm', 'Istio', 'Prometheus'],
    domain: '云原生',
    keywords: ['cloud native', '云原生', 'k8s', 'container'],
    years_of_experience: 4,
    location: '上海',
    expected_salary_min: 22000,
    expected_salary_max: 35000
  },
  {
    name: '高运维专家',
    current_title: '高级运维工程师',
    skills: ['Linux', 'Shell', 'Python', 'Monitoring', 'Troubleshooting'],
    domain: '系统运维',
    keywords: ['ops', '运维', 'linux', 'system'],
    years_of_experience: 6,
    location: '深圳',
    expected_salary_min: 24000,
    expected_salary_max: 36000
  },
  {
    name: '侯SRE',
    current_title: 'SRE工程师',
    skills: ['SRE', 'Monitoring', 'Alerting', 'Incident Response', 'Automation'],
    domain: 'SRE',
    keywords: ['sre', 'reliability', '可靠性', 'monitoring'],
    years_of_experience: 5,
    location: '杭州',
    expected_salary_min: 26000,
    expected_salary_max: 40000
  },
  {
    name: '贾CI/CD',
    current_title: 'CI/CD工程师',
    skills: ['Jenkins', 'GitLab CI', 'GitHub Actions', 'Pipeline', 'Deployment'],
    domain: 'CI/CD',
    keywords: ['cicd', 'pipeline', '流水线', 'automation'],
    years_of_experience: 4,
    location: '广州',
    expected_salary_min: 20000,
    expected_salary_max: 32000
  },
  {
    name: '康基础设施',
    current_title: '基础设施工程师',
    skills: ['Infrastructure', 'Cloud', 'AWS', 'Terraform', 'Networking'],
    domain: '基础设施',
    keywords: ['infrastructure', '基础设施', 'cloud', 'aws'],
    years_of_experience: 6,
    location: '成都',
    expected_salary_min: 23000,
    expected_salary_max: 35000
  },

  // 移动开发 (6个)
  {
    name: '兰iOS',
    current_title: 'iOS开发工程师',
    skills: ['Swift', 'Objective-C', 'iOS', 'Xcode', 'UIKit'],
    domain: 'iOS开发',
    keywords: ['ios', 'mobile', '移动开发', 'swift'],
    years_of_experience: 5,
    location: '北京',
    expected_salary_min: 24000,
    expected_salary_max: 36000
  },
  {
    name: '罗Android',
    current_title: 'Android开发工程师',
    skills: ['Java', 'Kotlin', 'Android', 'Android Studio', 'Material Design'],
    domain: 'Android开发',
    keywords: ['android', 'mobile', '移动开发', 'kotlin'],
    years_of_experience: 4,
    location: '上海',
    expected_salary_min: 22000,
    expected_salary_max: 34000
  },
  {
    name: '莫React Native',
    current_title: 'React Native开发工程师',
    skills: ['React Native', 'JavaScript', 'TypeScript', 'iOS', 'Android'],
    domain: '跨平台开发',
    keywords: ['react native', 'mobile', '跨平台', 'hybrid'],
    years_of_experience: 4,
    location: '深圳',
    expected_salary_min: 23000,
    expected_salary_max: 35000
  },
  {
    name: '倪Flutter',
    current_title: 'Flutter开发工程师',
    skills: ['Flutter', 'Dart', 'Mobile', 'Cross-platform', 'Material Design'],
    domain: 'Flutter开发',
    keywords: ['flutter', 'mobile', '跨平台', 'dart'],
    years_of_experience: 3,
    location: '杭州',
    expected_salary_min: 20000,
    expected_salary_max: 32000
  },
  {
    name: '欧移动架构',
    current_title: '移动端架构师',
    skills: ['iOS', 'Android', 'Architecture', 'Performance', 'Security'],
    domain: '移动架构',
    keywords: ['mobile', 'architect', '移动', '架构师'],
    years_of_experience: 7,
    location: '广州',
    expected_salary_min: 30000,
    expected_salary_max: 45000
  },
  {
    name: '彭混合开发',
    current_title: '混合开发工程师',
    skills: ['Cordova', 'Ionic', 'WebView', 'HTML5', 'JavaScript'],
    domain: '混合开发',
    keywords: ['hybrid', 'mobile', '混合开发', 'webview'],
    years_of_experience: 4,
    location: '武汉',
    expected_salary_min: 18000,
    expected_salary_max: 28000
  },

  // 产品/设计 (6个)
  {
    name: '齐产品经理',
    current_title: '产品经理',
    skills: ['Product Management', 'User Research', 'Prototyping', 'Agile', 'Data Analysis'],
    domain: '产品管理',
    keywords: ['product manager', '产品经理', 'pm', 'product'],
    years_of_experience: 5,
    location: '北京',
    expected_salary_min: 25000,
    expected_salary_max: 40000
  },
  {
    name: '任UI设计师',
    current_title: 'UI设计师',
    skills: ['UI Design', 'Figma', 'Sketch', 'Adobe XD', 'Photoshop'],
    domain: 'UI设计',
    keywords: ['ui design', 'ui', '界面设计', 'design'],
    years_of_experience: 4,
    location: '上海',
    expected_salary_min: 18000,
    expected_salary_max: 30000
  },
  {
    name: '沈UX设计师',
    current_title: 'UX设计师',
    skills: ['UX Design', 'User Research', 'Usability Testing', 'Wireframing', 'Prototyping'],
    domain: '用户体验',
    keywords: ['ux design', 'ux', '用户体验', 'user experience'],
    years_of_experience: 5,
    location: '深圳',
    expected_salary_min: 22000,
    expected_salary_max: 35000
  },
  {
    name: '唐交互设计',
    current_title: '交互设计师',
    skills: ['Interaction Design', 'Prototyping', 'User Flow', 'Information Architecture'],
    domain: '交互设计',
    keywords: ['interaction design', '交互设计', 'ixd', 'interaction'],
    years_of_experience: 4,
    location: '杭州',
    expected_salary_min: 20000,
    expected_salary_max: 32000
  },
  {
    name: '王产品运营',
    current_title: '产品运营专家',
    skills: ['Product Operations', 'Growth Hacking', 'Data Analysis', 'User Acquisition'],
    domain: '产品运营',
    keywords: ['product ops', '产品运营', 'growth', 'operations'],
    years_of_experience: 4,
    location: '广州',
    expected_salary_min: 18000,
    expected_salary_max: 28000
  },
  {
    name: '吴视觉设计',
    current_title: '视觉设计师',
    skills: ['Visual Design', 'Branding', 'Illustration', 'Typography', 'Color Theory'],
    domain: '视觉设计',
    keywords: ['visual design', '视觉设计', 'graphic', 'brand'],
    years_of_experience: 5,
    location: '成都',
    expected_salary_min: 16000,
    expected_salary_max: 26000
  }
]

// 删除现有数据并重建
async function rebuildHighQualityData() {
  console.log('🔄 重建高质量搜索数据')
  console.log('=' * 60)

  try {
    // 1. 删除现有测试数据
    console.log('\n1️⃣ 删除现有测试数据...')
    const { data: deleteResult, error: deleteError } = await supabase
      .from('resumes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // 删除所有数据

    if (deleteError) {
      console.error('❌ 删除数据失败:', deleteError)
      return
    }
    console.log('✅ 已清空现有数据')

    // 2. 生成高质量候选人数据
    console.log('\n2️⃣ 生成高质量候选人数据...')
    console.log(`📊 将添加 ${highQualityCandidates.length} 个候选人`)

    for (let i = 0; i < highQualityCandidates.length; i++) {
      const candidate = highQualityCandidates[i]
      
      try {
        console.log(`   正在处理 ${i+1}/${highQualityCandidates.length}: ${candidate.name}`)
        
        // 生成高质量embedding文本
        const embeddingText = generateHighQualityEmbeddingText(candidate)
        console.log(`     Embedding文本: ${embeddingText.substring(0, 100)}...`)
        
        // 调用OpenAI API生成embedding
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: embeddingText,
            model: 'text-embedding-3-large',
            dimensions: 1536
          })
        })
        
        const embeddingResponse = await response.json()
        const embedding = embeddingResponse.data[0].embedding

        // 插入到数据库
        const { data, error } = await supabase
          .from('resumes')
          .insert({
            name: candidate.name,
            current_title: candidate.current_title,
            skills: candidate.skills,
            location: candidate.location,
            years_of_experience: candidate.years_of_experience,
            expected_salary_min: candidate.expected_salary_min,
            expected_salary_max: candidate.expected_salary_max,
            embedding: JSON.stringify(embedding),
            status: 'active'
          })

        if (error) {
          console.log(`     ❌ 插入失败: ${error.message}`)
        } else {
          console.log(`     ✅ 成功添加`)
        }

        // 添加延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 150))

      } catch (error) {
        console.log(`     ❌ 处理出错: ${error.message}`)
      }
    }

    // 3. 验证数据质量
    console.log('\n3️⃣ 验证数据质量...')
    const { data: finalCount, error: countError } = await supabase
      .from('resumes')
      .select('id', { count: 'exact' })

    if (!countError) {
      console.log(`📊 最终候选人数量: ${finalCount?.length || 0}`)
    }

    // 4. 快速搜索测试
    console.log('\n4️⃣ 快速搜索测试...')
    const testQueries = [
      '前端开发工程师',
      'Java后端架构师', 
      '人工智能工程师',
      'DevOps运维工程师',
      'iOS移动开发'
    ]

    for (const query of testQueries) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: query,
            model: 'text-embedding-3-large',
            dimensions: 1536
          })
        })
        
        const embeddingResponse = await response.json()
        const queryEmbedding = embeddingResponse.data[0].embedding

        const { data: results, error } = await supabase.rpc('search_candidates_enhanced', {
          query_embedding: JSON.stringify(queryEmbedding),
          query_text: query,
          similarity_threshold: -1.0,
          match_count: 10
        })

        if (!error) {
          const highSimilarity = results?.filter(r => r.similarity > 0.2) || []
          console.log(`   "${query}": ${results?.length || 0}个结果, ${highSimilarity.length}个高相关性 (>0.2)`)
          
          if (highSimilarity.length > 0) {
            console.log(`      最高相似度: ${highSimilarity[0]?.similarity?.toFixed(3)}`)
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.log(`   ❌ 测试"${query}"失败: ${error.message}`)
      }
    }

    console.log('\n✅ 高质量数据重建完成!')
    console.log('🎯 现在可以重新运行完整测试验证召回率')

  } catch (error) {
    console.error('❌ 重建过程出错:', error)
  }
}

// 运行重建
rebuildHighQualityData().catch(console.error) 