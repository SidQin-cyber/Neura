/**
 * 薪资解析工具函数
 * 支持各种薪资格式的解析和转换
 */

export interface SalaryRange {
  min: number | null
  max: number | null
  currency: string
  period: 'monthly' | 'yearly'
  original: string
}

export interface SalaryParseResult {
  success: boolean
  ranges: SalaryRange[]
  error?: string
}

/**
 * 薪资格式正则表达式
 */
const SALARY_PATTERNS = {
  // 中文格式: 30k, 3w, 30万, 3000, 30K, 3W
  chinese: /(?:年薪|月薪|薪资|薪酬|工资|期望|预期)?\s*(?:约|大约|至少|最少|最多|不超过)?\s*(\d+(?:\.\d+)?)\s*([kKwW万千]?)\s*(?:[-~至到]\s*(\d+(?:\.\d+)?)\s*([kKwW万千]?))?/g,
  
  // 英文格式: 30k, 30K, 30000
  english: /(?:salary|expected|range)?\s*(?:around|about|at least|up to)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kK]?)\s*(?:[-~to]\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kK]?))?/gi,
  
  // 范围格式: 25-35k, 2w-3w, 25000-35000
  range: /(\d+(?:\.\d+)?)\s*([kKwW万千]?)\s*[-~至到]\s*(\d+(?:\.\d+)?)\s*([kKwW万千]?)/g,
  
  // 年薪标识
  yearly: /年薪|年收入|年度薪资|annually?|yearly?|per year|\/year/i,
  
  // 月薪标识
  monthly: /月薪|月收入|月度薪资|monthly?|per month|\/month/i
}

/**
 * 解析薪资文本
 */
export function parseSalaryText(text: string): SalaryParseResult {
  if (!text || typeof text !== 'string') {
    return { success: false, ranges: [], error: 'Invalid input text' }
  }

  const ranges: SalaryRange[] = []
  const normalizedText = text.toLowerCase().trim()

  // 检测是否为年薪
  const isYearly = SALARY_PATTERNS.yearly.test(normalizedText)
  const isMonthly = SALARY_PATTERNS.monthly.test(normalizedText)
  const period = isYearly ? 'yearly' : 'monthly'

  // 尝试各种匹配模式
  const patterns = [SALARY_PATTERNS.chinese, SALARY_PATTERNS.english, SALARY_PATTERNS.range]
  
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(normalizedText)) !== null) {
      const range = extractSalaryRange(match, period, normalizedText)
      if (range) {
        ranges.push(range)
      }
    }
  }

  // 去重和合并相似的范围
  const uniqueRanges = deduplicateRanges(ranges)

  return {
    success: uniqueRanges.length > 0,
    ranges: uniqueRanges,
    error: uniqueRanges.length === 0 ? 'No salary information found' : undefined
  }
}

/**
 * 从正则匹配结果提取薪资范围
 */
function extractSalaryRange(
  match: RegExpExecArray,
  period: 'monthly' | 'yearly',
  originalText: string
): SalaryRange | null {
  const [fullMatch, minStr, minUnit, maxStr, maxUnit] = match

  if (!minStr) return null

  const min = convertToNumber(minStr, minUnit || '')
  const max = maxStr ? convertToNumber(maxStr, maxUnit || minUnit || '') : null

  if (min === null) return null

  // 转换为月薪（统一单位）
  const convertedMin = period === 'yearly' ? Math.round(min / 12) : min
  const convertedMax = max && period === 'yearly' ? Math.round(max / 12) : max

  return {
    min: convertedMin,
    max: convertedMax,
    currency: 'CNY',
    period: 'monthly', // 统一转换为月薪
    original: fullMatch
  }
}

/**
 * 转换数字和单位为实际数值
 */
function convertToNumber(numStr: string, unit: string): number | null {
  const num = parseFloat(numStr.replace(/,/g, ''))
  if (isNaN(num)) return null

  const lowerUnit = unit.toLowerCase()
  
  // 处理各种单位
  switch (lowerUnit) {
    case 'k':
    case 'K':
    case '千':
      return num * 1000
    case 'w':
    case 'W':
    case '万':
      return num * 10000
    case '':
      // 根据数值大小判断单位
      if (num < 100) {
        // 小于100，可能是k或w
        return num >= 10 ? num * 1000 : num * 10000
      } else if (num < 1000) {
        // 100-999，可能是k
        return num * 1000
      } else {
        // 大于1000，直接使用
        return num
      }
    default:
      return num
  }
}

/**
 * 去重和合并相似的薪资范围
 */
function deduplicateRanges(ranges: SalaryRange[]): SalaryRange[] {
  if (ranges.length === 0) return []

  const uniqueRanges: SalaryRange[] = []
  
  for (const range of ranges) {
    const existing = uniqueRanges.find(r => 
      Math.abs((r.min || 0) - (range.min || 0)) < 1000 &&
      Math.abs((r.max || 0) - (range.max || 0)) < 1000
    )
    
    if (!existing) {
      uniqueRanges.push(range)
    }
  }

  return uniqueRanges
}

/**
 * 格式化薪资范围为显示文本
 */
export function formatSalaryRange(range: SalaryRange): string {
  const { min, max, currency } = range
  
  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`.replace('.0', '')
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`.replace('.0', '')
    }
    return num.toString()
  }

  if (!min && !max) return '面议'
  if (!min) return `最高 ${formatNumber(max!)}`
  if (!max) return `最低 ${formatNumber(min)}`
  
  return `${formatNumber(min)}-${formatNumber(max)}`
}

/**
 * 检查薪资范围是否重叠
 */
export function isSalaryRangeOverlap(
  range1: { min: number | null; max: number | null },
  range2: { min: number | null; max: number | null }
): boolean {
  const r1Min = range1.min || 0
  const r1Max = range1.max || Number.MAX_VALUE
  const r2Min = range2.min || 0
  const r2Max = range2.max || Number.MAX_VALUE

  return r1Min <= r2Max && r2Min <= r1Max
}

/**
 * 计算薪资匹配度分数 (0-1)
 */
export function calculateSalaryMatchScore(
  candidateRange: { min: number | null; max: number | null },
  jobRange: { min: number | null; max: number | null }
): number {
  const cMin = candidateRange.min || 0
  const cMax = candidateRange.max || Number.MAX_VALUE
  const jMin = jobRange.min || 0
  const jMax = jobRange.max || Number.MAX_VALUE

  // 计算重叠区间
  const overlapMin = Math.max(cMin, jMin)
  const overlapMax = Math.min(cMax, jMax)

  if (overlapMin > overlapMax) {
    // 没有重叠，计算距离
    const distance = Math.min(Math.abs(cMin - jMax), Math.abs(jMin - cMax))
    const maxRange = Math.max(cMax - cMin, jMax - jMin)
    return Math.max(0, 1 - distance / maxRange)
  }

  // 有重叠，计算重叠比例
  const overlapSize = overlapMax - overlapMin
  const totalSize = Math.max(cMax - cMin, jMax - jMin)
  
  if (totalSize === 0) return 1 // 完全匹配

  return Math.min(1, overlapSize / totalSize)
}

/**
 * 智能薪资建议
 */
export function generateSalarySuggestions(
  candidateRanges: SalaryRange[],
  jobRanges: SalaryRange[]
): {
  recommendation: string
  score: number
  reasons: string[]
} {
  if (candidateRanges.length === 0 || jobRanges.length === 0) {
    return {
      recommendation: '无法提供薪资建议',
      score: 0,
      reasons: ['缺少薪资信息']
    }
  }

  const candidate = candidateRanges[0]
  const job = jobRanges[0]
  
  const score = calculateSalaryMatchScore(candidate, job)
  const reasons: string[] = []

  let recommendation = ''
  
  if (score >= 0.8) {
    recommendation = '薪资期望高度匹配'
    reasons.push('候选人期望薪资与职位薪资范围重叠度很高')
  } else if (score >= 0.6) {
    recommendation = '薪资期望基本匹配'
    reasons.push('候选人期望薪资与职位薪资范围有部分重叠')
  } else if (score >= 0.4) {
    recommendation = '薪资期望存在差距'
    reasons.push('候选人期望薪资与职位薪资范围差距较大')
  } else {
    recommendation = '薪资期望差距较大'
    reasons.push('候选人期望薪资与职位薪资范围差距很大')
  }

  return { recommendation, score, reasons }
} 