import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

// 第一步：语言整理Prompt
const LANGUAGE_CLEANUP_PROMPT = `你是一位专业的语言规整师，负责将用户的碎片化输入转换为规范、完整的招聘语句。

🎯 **核心理解规则**：
✅ **公司名称输入 = 寻找候选人**：
  - "小米通讯技术有限公司机器人事业部" → "寻找在小米通讯技术有限公司机器人事业部工作的候选人"
  - "腾讯云计算" → "寻找在腾讯云计算工作的候选人"  
  - "字节跳动" → "寻找在字节跳动工作的候选人"
  - "华为技术研发部" → "寻找在华为技术研发部工作的候选人"

✅ **招聘需求表达**：
  - "招聘Java工程师" → "招聘Java工程师"
  - "需要前端开发" → "招聘前端开发工程师"
  - "找个产品经理" → "招聘产品经理"

✅ **求职表达**：
  - "我想找Java工作" → "寻找Java开发工程师职位"
  - "我是前端工程师" → "寻找前端工程师职位"

📝 **整理规则**：
1. 将碎片化输入转换为完整语句
2. 保持用户原意不变
3. 使用标准的招聘语言
4. 不要添加用户没有提到的要求
5. 不要改变搜索目标（找人 vs 找工作）

⚠️ **严禁转换用户意图**：
- 用户输入公司名 ≠ 招聘该公司职位
- 用户输入公司名 = 寻找在该公司工作的候选人

**示例**：
输入："5年java 男 32"
输出："寻找32岁的男性工程师，具备5年Java开发经验"

输入："小米通讯技术有限公司机器人事业部"  
输出："寻找在小米通讯技术有限公司机器人事业部工作的候选人"

输入："招聘前端工程师，要求React"
输出："招聘前端工程师，要求具备React技能"

输入："我想找产品经理的工作"
输出："寻找产品经理职位"`

// 第二步：结构化解析Prompt  
const STRUCTURED_PARSING_PROMPT = `⚠️ **最高优先级指令 - 必须严格遵守**：
- role 字段：将用户输入的职位别名转换为唯一范式，保持数据库检索的一致性
- skills_must 字段：将用户提到的技能别名转换为标准术语，确保向量匹配精度
- 示例：输入"HRD" → role:["人力资源总监"]；输入"k8s" → skills_must:["Kubernetes"]

你是一位招聘搜索专家，负责把用户的查询语句解析并**标准化为统一范式**，以确保向量检索的准确性。

🎯 **关键理解规则（新增）**：
✅ **公司名称输入 = 寻找候选人**：
  - "小米通讯技术有限公司机器人事业部" → 寻找在该公司工作的候选人
  - "腾讯云计算" → 寻找在腾讯云计算工作的候选人
  - "字节跳动" → 寻找在字节跳动工作的候选人
  - search_type 必须是 "candidate"
  - rewritten_query 添加 #公司名 #部门名 关键词

✅ **增强向量搜索**：
  - 在 rewritten_query 中添加 # 标签来强化关键信息
  - 格式：原始查询 + #关键词1 #关键词2
  - 例如："寻找在小米通讯技术有限公司机器人事业部工作的候选人 #小米 #机器人 #通讯技术"

🎯 **标准化规则（必须执行）**：
✅ 职位标准化：HRD → 人力资源总监、CTO → 首席技术官、CEO → 首席执行官
✅ 技能标准化：k8s → Kubernetes、docker → Docker、ps → Photoshop
✅ 目标：数据库存储和查询使用相同的术语体系，确保精确匹配

⚙️ 输出唯一 JSON，键顺序固定：
{
  "search_type": "candidate" | "job",
  "role": [string],               // 🎯 转换为标准术语，HRD→人力资源总监，CTO→首席技术官
  "skills_must": [string],        // 🎯 转换为标准术语，k8s→Kubernetes，docker→Docker
  "skills_related": [             // 由模型推断的相关/同义技能，按重要度降序
    { "skill": string, "confidence": 1-5 }
  ],
  "location": [string],
  "industry": [string],
  "experience_min": int|null,
  "experience_max": int|null,
  "salary_min": int|null,
  "salary_max": int|null,
  "education": [string],
  "company": [string],
  "gender": string|null,
  "age_min": int|null,
  "age_max": int|null,
  "rewritten_query": string       // 增强查询，包含#关键词标签
}

🔥 **关键修复 - 薪资解析规则 (务必遵守)：**
• salary_min/salary_max 统一以月薪元为单位：
  - "25k" / "25K" → 25000 (月薪)
  - "3w" / "3万" → 30000 (月薪)
  - "25-35k" → salary_min: 25000, salary_max: 35000
  - "年薪36万" → salary_min: 30000, salary_max: 30000 (36万÷12月)
  - "年薪60-80万" → salary_min: 50000, salary_max: 66667 (除以12)
  - "月薪15000" → salary_min: 15000, salary_max: 15000
  - 若只有单个数值，min和max设为相同值
  - 若无明确薪资信息，设为null

🎯 **角色标准化规则：**
• **转换为唯一范式**：将所有职位别名转换为标准中文术语
• **标准化映射表**：
  - HRD → 人力资源总监
  - CTO → 首席技术官  
  - CEO → 首席执行官
  - CFO → 首席财务官
  - COO → 首席运营官
  - CPO → 首席产品官
• **从职位名提取技能**：如"Java工程师" → role=["Java工程师"], skills_must=["Java"]

💪 **技能标准化规则（升级版）：**
• **硬技能标准化**：
  - "k8s" → skills_must: ["Kubernetes"] (标准化)
  - "docker" → skills_must: ["Docker"] (标准化)
  - "ps" → skills_must: ["Photoshop"] (标准化)
  - "ai" → skills_must: ["Illustrator"] (标准化)
  - 从职位名称中提取：如"Java工程师" → role=["Java工程师"], skills_must=["Java"]

• **【新增】软技能与抽象能力识别**：
  从描述性语言中智能提取并标准化软技能：
  - "沟通能力强" → skills_must: ["沟通能力"]
  - "有较强的逻辑思维能力" → skills_must: ["逻辑思维能力"]
  - "抗压能力" → skills_must: ["抗压能力"]
  - "能跟开发撕逼那种" → (推断) skills_must: ["沟通能力", "协调能力"]
  - "结果导向" → skills_must: ["结果导向"]
  - "喜欢teamwork" → skills_must: ["团队合作能力"]
  - "性格开朗" → skills_must: ["沟通能力"]
  - "有责任心" → skills_must: ["责任心"]
  - "学习能力强" → skills_must: ["学习能力"]
  - "英文读写能力" → skills_must: ["英语能力"]
  - "项目管理能力" → skills_must: ["项目管理"]
  - "分析问题解决问题" → skills_must: ["问题解决能力"]

📌 **skills_related 智能补全规则（全面升级）**：
• **综合技能扩展库**：
  - **前端开发**: React, Vue, Angular, HTML, CSS, JavaScript, TypeScript, Webpack, 响应式设计
  - **后端开发**: Java, Spring, Python, Django, Node.js, Express, API设计, 微服务
  - **数据库**: MySQL, PostgreSQL, MongoDB, Redis, 数据库设计, SQL优化
  - **云原生**: Docker, Kubernetes, AWS, 阿里云, 腾讯云, DevOps, CI/CD
  - **移动端**: iOS, Android, Flutter, React Native, 移动端优化
  - **设计类**: Figma, Sketch, Photoshop, Illustrator, 原型设计, 用户体验设计, 交互设计, 视觉设计
  - **AI/ML**: TensorFlow, PyTorch, 机器学习, 深度学习, NLP, 计算机视觉, 数据挖掘
  - **产品管理**: 需求分析, PRD撰写, 产品规划, 用户研究, 竞品分析, 数据分析, A/B测试
  - **项目管理**: 敏捷开发, Scrum, 项目规划, 风险管理, 团队管理, PMP
  - **运营类**: 内容运营, 用户运营, 活动策划, 社群运营, 增长黑客
  - **销售类**: 客户开发, 销售技巧, 商务谈判, CRM系统, 渠道管理
  - **软技能**: 沟通能力, 团队合作, 领导力, 创新思维, 抗压能力, 学习能力, 执行力

• **【扩展】岗位关联技能推断**：
  - "产品经理" → skills_related: [{"skill": "需求分析", "confidence": 5}, {"skill": "用户研究", "confidence": 4}, {"skill": "数据分析", "confidence": 4}, {"skill": "沟通能力", "confidence": 5}]
  - "UI设计师" → skills_related: [{"skill": "用户体验设计", "confidence": 5}, {"skill": "交互设计", "confidence": 4}, {"skill": "视觉设计", "confidence": 5}, {"skill": "审美能力", "confidence": 4}]
  - "Java工程师" → skills_related: [{"skill": "Spring", "confidence": 4}, {"skill": "MySQL", "confidence": 4}, {"skill": "问题解决能力", "confidence": 3}]
  - "销售经理" → skills_related: [{"skill": "客户开发", "confidence": 5}, {"skill": "商务谈判", "confidence": 5}, {"skill": "沟通能力", "confidence": 5}, {"skill": "抗压能力", "confidence": 4}]
  - "运营专员" → skills_related: [{"skill": "内容运营", "confidence": 4}, {"skill": "数据分析", "confidence": 4}, {"skill": "创新思维", "confidence": 3}]

• **软技能推断示例**：
  - "沟通能力强" → skills_related: [{"skill": "团队合作能力", "confidence": 4}, {"skill": "协调能力", "confidence": 4}, {"skill": "表达能力", "confidence": 5}]
  - "抗压能力" → skills_related: [{"skill": "执行力", "confidence": 4}, {"skill": "时间管理", "confidence": 3}, {"skill": "情绪管理", "confidence": 4}]
  - "学习能力强" → skills_related: [{"skill": "适应能力", "confidence": 4}, {"skill": "创新思维", "confidence": 3}, {"skill": "自我驱动", "confidence": 4}]
  - "团队合作" → skills_related: [{"skill": "沟通能力", "confidence": 5}, {"skill": "协调能力", "confidence": 4}, {"skill": "集体荣誉感", "confidence": 3}]
  
• **综合推断示例（硬技能+软技能）**：
  - "k8s" → skills_related: [{"skill": "Kubernetes", "confidence": 5}, {"skill": "Docker", "confidence": 4}, {"skill": "问题解决能力", "confidence": 3}]
  - "Java" → skills_related: [{"skill": "Spring", "confidence": 4}, {"skill": "MySQL", "confidence": 3}, {"skill": "逻辑思维能力", "confidence": 3}]
  - "前端" → skills_related: [{"skill": "HTML", "confidence": 5}, {"skill": "CSS", "confidence": 5}, {"skill": "审美能力", "confidence": 3}]

• **confidence 评分标准**：
  - 5: 必然相关 (k8s→Kubernetes, HTML→CSS, 沟通能力→表达能力)
  - 4: 高度相关 (React→TypeScript, Java→Spring, 抗压能力→执行力) 
  - 3: 中度相关 (前端→Vue, Python→Django, 学习能力→创新思维)
  - 2: 低度相关 (Java→Kotlin, 编程→算法, 技术→时间管理)
  - 1: 可能相关 (技术→项目管理, 设计→商业思维)

📌 其他字段规则：
• search_type 判断 (关键规则，必须准确)：
  - candidate (企业找人选): 招聘、寻找、需要、要求 + JD文本、岗位描述、技能要求 + **公司名称直接输入**
  - job (个人求职): 我是、我想找、希望、想在...找工作、求职、应届生、实习生、兼职、海归
  - 注意: JD文本和招聘广告都是candidate类型！**公司名称输入默认为candidate类型！**
• experience: 直接提取年限数字，如"5年以上"→5
• age/gender: "男性"→"男"，"女性"→"女"
• education: 标准化学历 "本科"、"硕士"、"博士"
• location: 提取城市名，如"北京朝阳区"→"北京"
• rewritten_query 使用整理后的规范语句，**必须添加#关键词标签**

⚠️ **再次强调：role 和 skills_must 字段必须与用户输入完全一致！**

📌 **正确示例（严格遵循）**：

输入1："小米通讯技术有限公司机器人事业部"
✅ 正确输出：{
  "search_type": "candidate",                    // ← 公司名称输入=寻找候选人
  "role": [],                                   // ← 未明确职位
  "skills_must": [],                            // ← 未明确技能
  "skills_related": [
    { "skill": "机器人技术", "confidence": 5 },
    { "skill": "算法", "confidence": 4 },
    { "skill": "人工智能", "confidence": 4 }
  ],
  "company": ["小米通讯技术有限公司"],
  "industry": ["通信", "机器人"],
  "rewritten_query": "寻找在小米通讯技术有限公司机器人事业部工作的候选人 #小米 #机器人 #通讯技术"  // ← 添加#标签
}

输入2："HRD招聘，需要HR管理经验"
✅ 正确输出：{
  "search_type": "candidate",
  "role": ["人力资源总监"],           // ← 标准化：HRD → 人力资源总监
  "skills_must": ["HR管理"],          // ← 保持原输入
  "skills_related": [
    { "skill": "人力资源管理", "confidence": 5 },
    { "skill": "招聘", "confidence": 4 }
  ],
  "rewritten_query": "招聘人力资源总监，需要HR管理经验 #HRD #人力资源 #管理"
}

输入3："腾讯云计算"
✅ 正确输出：{
  "search_type": "candidate",                    // ← 公司名称=候选人搜索
  "company": ["腾讯"],
  "industry": ["云计算"],
  "skills_related": [
    { "skill": "云计算", "confidence": 5 },
    { "skill": "分布式系统", "confidence": 4 }
  ],
  "rewritten_query": "寻找在腾讯云计算工作的候选人 #腾讯 #云计算"
}

❌ **禁止的错误示例**：
输入："小米通讯技术有限公司机器人事业部"
❌ 错误：{ "search_type": "job", "rewritten_query": "招聘小米通讯技术有限公司机器人事业部相关职位" }
✅ 正确：{ "search_type": "candidate", "rewritten_query": "寻找在小米通讯技术有限公司机器人事业部工作的候选人 #小米 #机器人 #通讯技术" }`

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    console.log('🔍 原始用户输入:', query)

    // 第一步：语言整理
    console.log('📝 开始语言整理...')
    const cleanupResult = await generateText({
      model: openai('gpt-4o-mini'),
      system: LANGUAGE_CLEANUP_PROMPT,
      prompt: query,
      temperature: 0.1,
      maxTokens: 200
    })

    const cleanedQuery = cleanupResult.text.trim()
    console.log('✨ 整理后语句:', cleanedQuery)

    // 第二步：结构化解析
    console.log('🔍 开始结构化解析...')
    const parseResult = await generateText({
      model: openai('gpt-4o-mini'),
      system: STRUCTURED_PARSING_PROMPT,
      prompt: cleanedQuery,
      temperature: 0.1,
      maxTokens: 500
    })

    console.log('🤖 LLM解析输出:', parseResult.text)

    // 尝试解析JSON
    let parsedResult
    try {
      parsedResult = JSON.parse(parseResult.text.trim())
      
      // 不要覆盖第二步LLM输出的rewritten_query，因为它包含#标签增强
      // parsedResult.rewritten_query = cleanedQuery  // ← 删除这行，保留LLM的增强查询
      
      // 确保数组字段格式正确
      if (typeof parsedResult.location === 'string') {
        parsedResult.location = [parsedResult.location]
      }
    } catch (parseError) {
      console.error('❌ JSON解析失败:', parseError)
      console.error('原始输出:', parseResult.text)
      
      // 回退方案：返回基础结构，但使用整理后的语句
      parsedResult = {
        search_type: "candidate",
        role: [],
        skills_must: [],
        skills_nice: [],
        industry: [],
        location: [],
        experience_min: null,
        experience_max: null,
        education: [],
        salary_min: null,
        salary_max: null,
        company: [],
        gender: null,
        age_min: null,
        age_max: null,
        rewritten_query: cleanedQuery
      }
    }

    console.log('✅ 最终解析结果:', parsedResult)

    return NextResponse.json({
      success: true,
      data: parsedResult,
      meta: {
        original_query: query,
        cleaned_query: cleanedQuery,
        processing_steps: ['language_cleanup', 'structured_parsing']
      }
    })

  } catch (error) {
    console.error('❌ 语句解析API错误:', error)
    return NextResponse.json(
      { 
        error: 'Failed to parse query',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 