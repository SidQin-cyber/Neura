import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

// ========================================
// 1. 智能标准化：基于语义理解而非硬编码
// ========================================

/**
 * 职位标准化：将各种职位表达标准化为规范名称
 * 核心思路：使用LLM的语义理解能力，而非简单字符串替换
 */
const ROLE_STANDARDIZATION_PROMPT = `你是招聘行业的职位标准化专家。

任务：将输入的职位名称转换为标准化、规范化的职位名称。

标准化原则：
1. 使用行业通用的标准职位名称
2. 中文优先，保持简洁明确
3. 技术栈信息可保留，但职级和部门信息标准化
4. 不要创造新职位名称，使用已建立的行业标准

常见标准化规则：
• 开发类：Java开发工程师、前端工程师、后端工程师、全栈工程师、移动端开发工程师
• 管理类：技术总监、项目经理、产品经理、团队负责人
• 设计类：UI设计师、UX设计师、交互设计师、视觉设计师
• 运维类：运维工程师、DevOps工程师、系统管理员
• 数据类：数据分析师、数据工程师、算法工程师、机器学习工程师
• 高管类：首席技术官、首席执行官、首席产品官、技术副总裁

输出要求：
- 只输出标准化后的职位名称，不要解释
- 如果无法标准化，输出原职位名称
- 一行一个结果

示例：
输入：Java后端开发工程师
输出：Java开发工程师

输入：Senior Frontend Developer
输出：前端工程师

输入：CTO
输出：首席技术官`

/**
 * 技能标准化：将技能别名转换为标准术语
 */
const SKILL_STANDARDIZATION_PROMPT = `你是技术技能标准化专家。

任务：将输入的技能关键词转换为标准化、规范化的技能名称。

标准化原则：
1. 使用技术社区公认的标准名称
2. 保持原有的技术精确性
3. 统一大小写和命名风格
4. 保留版本信息（如果重要）

常见标准化规则：
• 编程语言：JavaScript、TypeScript、Python、Java、Go、Rust
• 前端框架：React、Vue.js、Angular、Next.js、Nuxt.js
• 后端框架：Spring Boot、Express.js、Django、Flask、Gin
• 数据库：MySQL、PostgreSQL、MongoDB、Redis、Elasticsearch
• 云原生：Docker、Kubernetes、AWS、Azure、Google Cloud
• 工具链：Git、Jenkins、Webpack、Vite、ESLint

输出要求：
- 只输出标准化后的技能名称，不要解释
- 保持技术准确性
- 一行一个结果

示例：
输入：k8s
输出：Kubernetes

输入：react.js
输出：React

输入：mysql数据库
输出：MySQL`

/**
 * 批量职位标准化
 */
export async function standardizeRoles(roles: string[]): Promise<string[]> {
  if (!roles || roles.length === 0) return []
  
  try {
    console.log('🎯 开始职位标准化:', roles)
    
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: ROLE_STANDARDIZATION_PROMPT,
      prompt: roles.join('\n'),
      temperature: 0.1,
      maxTokens: 500
    })

    const standardizedRoles = result.text.trim().split('\n').filter(Boolean)
    console.log('✅ 职位标准化完成:', standardizedRoles)
    
    return standardizedRoles
  } catch (error) {
    console.warn('⚠️ 职位标准化失败，返回原值:', error)
    return roles
  }
}

/**
 * 批量技能标准化
 */
export async function standardizeSkills(skills: string[]): Promise<string[]> {
  if (!skills || skills.length === 0) return []
  
  try {
    console.log('🛠️ 开始技能标准化:', skills)
    
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: SKILL_STANDARDIZATION_PROMPT,
      prompt: skills.join('\n'),
      temperature: 0.1,
      maxTokens: 800
    })

    const standardizedSkills = result.text.trim().split('\n').filter(Boolean)
    console.log('✅ 技能标准化完成:', standardizedSkills)
    
    return standardizedSkills
  } catch (error) {
    console.warn('⚠️ 技能标准化失败，返回原值:', error)
    return skills
  }
}

// ========================================
// 2. 缓存与学习机制
// ========================================

interface StandardizationCache {
  roles: Map<string, string>
  skills: Map<string, string>
  lastUpdated: Date
}

const cache: StandardizationCache = {
  roles: new Map(),
  skills: new Map(),
  lastUpdated: new Date()
}

/**
 * 带缓存的职位标准化
 */
export async function standardizeRoleWithCache(role: string): Promise<string> {
  const cacheKey = role.toLowerCase().trim()
  
  if (cache.roles.has(cacheKey)) {
    console.log(`💾 使用缓存的职位标准化: ${role} -> ${cache.roles.get(cacheKey)}`)
    return cache.roles.get(cacheKey)!
  }

  const [standardized] = await standardizeRoles([role])
  cache.roles.set(cacheKey, standardized)
  
  return standardized
}

/**
 * 带缓存的技能标准化
 */
export async function standardizeSkillWithCache(skill: string): Promise<string> {
  const cacheKey = skill.toLowerCase().trim()
  
  if (cache.skills.has(cacheKey)) {
    console.log(`💾 使用缓存的技能标准化: ${skill} -> ${cache.skills.get(cacheKey)}`)
    return cache.skills.get(cacheKey)!
  }

  const [standardized] = await standardizeSkills([skill])
  cache.skills.set(cacheKey, standardized)
  
  return standardized
}

// ========================================
// 3. 全文本智能标准化
// ========================================

/**
 * 智能全文本标准化：处理复杂的简历或JD文本
 */
const COMPREHENSIVE_STANDARDIZATION_PROMPT = `你是招聘数据标准化专家，负责对简历或职位描述进行全面的标准化处理。

核心任务：
1. 职位名称标准化（保持行业通用标准）
2. 技能名称标准化（使用技术社区标准）  
3. 数值格式统一（薪资、经验、年龄）
4. 文本格式规范化

职位标准化规则：
• Java后端开发 → Java开发工程师
• Senior Frontend Developer → 高级前端工程师  
• 技术Leader → 技术负责人
• DevOps Engineer → DevOps工程师
• Data Scientist → 数据科学家

技能标准化规则：
• k8s/Kube → Kubernetes
• react.js/reactjs → React
• vue.js/vuejs → Vue.js
• node.js/nodejs → Node.js
• python3 → Python
• mysql/MySQL数据库 → MySQL

数值标准化规则：
• 薪资：25k/月 → 25000元/月，年薪60万 → 60万元/年
• 经验：5+年 → 5年以上，五年经验 → 5年经验
• 年龄：32岁 → 32岁

文本格式规则：
• 使用标准中文标点符号
• 英文/数字与中文间保留空格
• 删除多余空行和连续空格

输出要求：
- 只输出处理后的完整文本
- 保持原文结构和段落
- 不要添加解释或说明`

/**
 * 智能全文本标准化
 */
export async function comprehensiveNormalization(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return text
  
  try {
    console.log('🧠 开始智能全文本标准化')
    
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: COMPREHENSIVE_STANDARDIZATION_PROMPT,
      prompt: text,
      temperature: 0.1,
      maxTokens: 2048
    })

    console.log('✅ 智能全文本标准化完成')
    return result.text.trim()
  } catch (error) {
    console.warn('⚠️ 智能全文本标准化失败，返回原文:', error)
    return text
  }
}

// ========================================
// 4. 质量控制与一致性检查
// ========================================

/**
 * 标准化质量评估
 */
export interface StandardizationQuality {
  score: number // 0-100 分
  issues: string[]
  suggestions: string[]
}

export async function assessStandardizationQuality(
  original: string, 
  standardized: string
): Promise<StandardizationQuality> {
  const issues: string[] = []
  const suggestions: string[] = []
  let score = 100

  // 检查长度变化（不应过大）
  const lengthRatio = standardized.length / original.length
  if (lengthRatio < 0.7 || lengthRatio > 1.5) {
    issues.push('文本长度变化过大，可能存在信息丢失或冗余')
    score -= 20
  }

  // 检查关键信息保留
  const originalWords = original.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || []
  const standardizedWords = standardized.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || []
  
  const lostWords = originalWords.filter(word => 
    !standardizedWords.some(sw => sw.toLowerCase().includes(word.toLowerCase()))
  )
  
  if (lostWords.length > originalWords.length * 0.3) {
    issues.push('可能丢失了重要的原始信息')
    score -= 15
  }

  // 检查标准化效果
  if (standardized === original) {
    suggestions.push('文本未发生变化，可能需要更深度的标准化')
    score -= 5
  }

  return { score, issues, suggestions }
}

// ========================================
// 5. 主入口函数
// ========================================

/**
 * 智能标准化主函数
 * 替代原有的硬编码标准化方式
 */
export async function intelligentNormalization(text: string): Promise<{
  normalized: string
  quality: StandardizationQuality
  processingTime: number
}> {
  const startTime = Date.now()
  
  try {
    // 执行智能标准化
    const normalized = await comprehensiveNormalization(text)
    
    // 质量评估
    const quality = await assessStandardizationQuality(text, normalized)
    
    const processingTime = Date.now() - startTime
    
    console.log(`🎯 智能标准化完成，耗时: ${processingTime}ms，质量分数: ${quality.score}`)
    
    return { normalized, quality, processingTime }
  } catch (error) {
    console.error('❌ 智能标准化失败:', error)
    throw error
  }
}

// ========================================
// 6. 导出统一接口
// ========================================

export const IntelligentNormalizer = {
  // 单项标准化
  standardizeRole: standardizeRoleWithCache,
  standardizeSkill: standardizeSkillWithCache,
  
  // 批量标准化  
  standardizeRoles,
  standardizeSkills,
  
  // 全文本智能标准化
  comprehensiveNormalization,
  intelligentNormalization,
  
  // 质量控制
  assessQuality: assessStandardizationQuality
} 