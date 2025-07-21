import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

// 别名到标准术语的映射词典
export const ALIAS_DICTIONARY = {
  roles: {
    'HRD': '人力资源总监',
    'HRBP': '人力资源业务伙伴',
    'CTO': '首席技术官',
    'CEO': '首席执行官',
    'COO': '首席运营官',
    'CFO': '首席财务官',
    'CPO': '首席产品官',
    'CIO': '首席信息官',
    'CMO': '首席营销官',
    'DevOps': 'DevOps工程师',
    'PM': '产品经理',
    'QA': '质量保证工程师',
    'BA': '业务分析师',
    'UI': 'UI设计师',
    'UX': 'UX设计师'
  },
  skills: {
    'k8s': 'Kubernetes',
    'K8S': 'Kubernetes',
    'kube': 'Kubernetes',
    'GKE': 'Kubernetes',
    'docker': 'Docker',
    'ps': 'Photoshop',
    'PS': 'Photoshop',
    'ai': 'Illustrator',
    'AI': 'Illustrator',
    'js': 'JavaScript',
    'JS': 'JavaScript',
    'ts': 'TypeScript',
    'TS': 'TypeScript',
    'py': 'Python',
    'node': 'Node.js',
    'vue': 'Vue.js',
    'react': 'React',
    'angular': 'Angular',
    'mysql': 'MySQL',
    'postgres': 'PostgreSQL',
    'redis': 'Redis',
    'mongo': 'MongoDB',
    'aws': 'AWS',
    'gcp': 'Google Cloud',
    'azure': 'Microsoft Azure'
  }
}

// 静态词典替换（快速、零成本）
export function applyAliasDictionary(text: string): string {
  let result = text

  // 职位别名替换
  Object.entries(ALIAS_DICTIONARY.roles).forEach(([alias, standard]) => {
    // 使用词边界确保精确匹配
    const regex = new RegExp(`\\b${alias}\\b`, 'gi')
    result = result.replace(regex, standard)
  })

  // 技能别名替换
  Object.entries(ALIAS_DICTIONARY.skills).forEach(([alias, standard]) => {
    const regex = new RegExp(`\\b${alias}\\b`, 'gi')
    result = result.replace(regex, standard)
  })

  return result
}

// LLM 标准化 Prompt
const STANDARDIZATION_PROMPT = `你是一名招聘数据标准化专家。  
任务：将输入的中文/英文简历或岗位描述**转换为统一范式文本**，以便后续做向量检索。  
必须逐条执行下列规则；若无法全部满足请输出【ERROR】并给出简短原因。

—————————【规则开始】—————————

① 职位名称标准化  
   使用下表将所有别名替换为唯一范式：  
   | 别名 | 唯一范式 |
   | HRD | 人力资源总监 |
   | CTO | 首席技术官 |
   | CEO | 首席执行官 |
   | CFO | 首席财务官 |
   | COO | 首席运营官 |
   | CPO | 首席产品官 |
   | DevOps | DevOps工程师 |

② 技能名称标准化  
   | 别名 | 唯一范式 |
   | k8s, K8S, Kube | Kubernetes |
   | docker | Docker |
   | PS | Photoshop |
   | AI | Illustrator |
   | js, JS | JavaScript |
   | ts, TS | TypeScript |

③ 数值与单位统一  
   • 薪资：  
     - "25k/月" "25K/月" "2.5w/月" "2.5万/月" → "25000 元/月"  
     - "年薪60-80万" → "60~80 万元/年"  
   • 经验：  
     - "5+ 年" "五年以上" → "5 年以上"  
   • 年龄：  
     - "32 岁" 统一写成 "32 岁"

④ 中文排版  
   • 统一使用全角中文标点：， 。 ： ； （ ）  
   • 英文/数字与中文之间保留 1 个空格  
   • 删除多余空行、连续空格

—————————【规则结束】—————————

输出要求：  
1. 只输出"处理后的完整文本"，保留段落结构；不要任何解释或元数据。  
2. 如有任何规则无法满足，输出：  
   【ERROR】<简要原因>`

// LLM 标准化（仅在词典无法处理时使用）
export async function normalizeWithLLM(text: string): Promise<string> {
  try {
    console.log('🤖 调用LLM进行文本标准化')
    
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: STANDARDIZATION_PROMPT,
      prompt: text,
      temperature: 0,
      maxTokens: 2048
    })

    if (result.text.startsWith('【ERROR】')) {
      throw new Error(`LLM标准化失败: ${result.text}`)
    }

    console.log('✅ LLM标准化完成')
    return result.text.trim()
  } catch (error) {
    console.error('❌ LLM标准化错误:', error)
    throw error
  }
}

// 检查是否仍有未标准化的别名
export function hasUnstandardizedAliases(text: string): boolean {
  const allAliases = [
    ...Object.keys(ALIAS_DICTIONARY.roles),
    ...Object.keys(ALIAS_DICTIONARY.skills)
  ]

  return allAliases.some(alias => {
    const regex = new RegExp(`\\b${alias}\\b`, 'i')
    return regex.test(text)
  })
}

// 综合标准化函数（词典 + LLM）
export async function normalizeTextForEmbedding(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text
  }

  console.log('🔄 开始文本标准化流程')

  // 第一步：应用静态词典
  let normalized = applyAliasDictionary(text)
  console.log('📚 词典标准化完成')

  // 第二步：检查是否还有未标准化的内容
  if (hasUnstandardizedAliases(normalized) || text.length > 100) {
    // 如果仍有别名或文本较长，使用LLM进一步标准化
    try {
      normalized = await normalizeWithLLM(normalized)
    } catch (error) {
      console.warn('⚠️ LLM标准化失败，使用词典结果:', error)
      // 如果LLM失败，仍使用词典的结果
    }
  }

  console.log('✅ 文本标准化完成')
  return normalized
}

// 验证文本是否符合标准化要求
export function validateNormalizedText(text: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // 检查是否还有未标准化的别名
  if (hasUnstandardizedAliases(text)) {
    const foundAliases = []
    const allAliases = [
      ...Object.keys(ALIAS_DICTIONARY.roles),
      ...Object.keys(ALIAS_DICTIONARY.skills)
    ]
    
    for (const alias of allAliases) {
      const regex = new RegExp(`\\b${alias}\\b`, 'i')
      if (regex.test(text)) {
        foundAliases.push(alias)
      }
    }
    
    if (foundAliases.length > 0) {
      errors.push(`存在未标准化别名：${foundAliases.join(', ')}`)
    }
  }

  // 检查是否包含错误标记
  if (text.includes('【ERROR】')) {
    errors.push('文本包含错误标记')
  }

  // 检查文本长度
  if (text.trim().length < 10) {
    errors.push('文本内容过少')
  }

  // 检查连续空格
  if (/\s{2,}/.test(text)) {
    errors.push('存在连续空格')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// 缓存相关的键值对存储（简单内存缓存）
const normalizationCache = new Map<string, string>()

// 带缓存的标准化函数
export async function normalizeTextWithCache(text: string): Promise<string> {
  const cacheKey = text.trim()
  
  if (normalizationCache.has(cacheKey)) {
    console.log('💾 使用缓存的标准化结果')
    return normalizationCache.get(cacheKey)!
  }

  const normalized = await normalizeTextForEmbedding(text)
  normalizationCache.set(cacheKey, normalized)
  
  return normalized
} 