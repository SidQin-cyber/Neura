'use client'

import { JobSearchResult } from '@/lib/context/search-context'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface JobCardOptimizedProps {
  job: JobSearchResult & {
    salary_min?: number
    salary_max?: number
    employment_type?: string
  }
}

export function JobCardOptimized({ job }: JobCardOptimizedProps) {
  const [copied, setCopied] = useState(false)
  
  // 🎨 Neura Score 样式系统（保持原有的颜色变化和设定）
  const getMatchScoreStyle = (score: number) => {
    const baseTextColor = 'text-purple-700'
    const numberTextColor = 'text-purple-800'
    
    if (score >= 80) {
      return {
        classes: 'bg-white border-2 border-purple-500 text-purple-700 shadow-md hover:border-purple-600 hover:shadow-lg ring-1 ring-purple-500/20',
        textColor: numberTextColor
      }
    }
    if (score >= 60) {
      return {
        classes: 'bg-white border-[1.5px] border-purple-400 text-purple-700 shadow-sm hover:border-purple-500 hover:shadow-md ring-1 ring-purple-400/15',
        textColor: numberTextColor
      }
    }
    if (score >= 40) {
      return {
        classes: 'bg-white border border-purple-300 text-purple-700 shadow-sm hover:border-purple-400 hover:shadow-md ring-1 ring-purple-300/10',
        textColor: numberTextColor
      }
    }
    if (score >= 20) {
      return {
        classes: 'bg-white border-[0.5px] border-purple-200 text-purple-700 shadow-sm hover:border-purple-300 ring-1 ring-purple-200/5',
        textColor: numberTextColor
      }
    }
    return {
      classes: 'bg-gray-50 text-purple-700 shadow-sm hover:bg-gray-100',
      textColor: numberTextColor
    }
  }

  // 复制职位信息到剪贴板
  const copyToClipboard = async () => {
    const info = `公司: ${job.company}
职位: ${job.title}${job.location ? `\n地点: ${job.location}` : ''}${job.experience_required ? `\n经验要求: ${typeof job.experience_required === 'number' ? `${job.experience_required}年` : job.experience_required}` : ''}${job.salary_min && job.salary_max ? `\n薪资: ${(job.salary_min / 1000).toFixed(0)}-${(job.salary_max / 1000).toFixed(0)}K` : ''}
Neura Score: ${jobMatchScore}%${job.description ? `\n职位描述: ${job.description.slice(0, 200)}...` : ''}`

    try {
      await navigator.clipboard.writeText(info)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  // 🎯 智能提取职位精华描述（一句话）
  const extractJobSummary = (description: string) => {
    if (!description) return '专业技术岗位，欢迎有经验的候选人加入'
    
    // 提取第一句话或核心描述
    const firstSentence = description.split(/[。！？\n]/)[0].trim()
    if (firstSentence.length > 10 && firstSentence.length < 60) {
      return firstSentence
    }
    
    // 如果第一句话不合适，寻找关键词并生成描述
    const keyTerms = []
    if (description.includes('VLA') || description.includes('算法')) keyTerms.push('算法开发')
    if (description.includes('大模型') || description.includes('LLM')) keyTerms.push('大模型技术')
    if (description.includes('机器学习') || description.includes('AI')) keyTerms.push('AI技术')
    if (description.includes('前端') || description.includes('React')) keyTerms.push('前端开发')
    if (description.includes('后端') || description.includes('服务器')) keyTerms.push('后端开发')
    
    if (keyTerms.length > 0) {
      return `专注于${keyTerms.slice(0, 2).join('、')}，寻找有经验的技术人才`
    }
    
    return '技术驱动的专业岗位，提供优秀的发展平台'
  }

  // 🎯 智能提取核心职责（3个要点）
  const extractCoreResponsibilities = (description: string) => {
    if (!description) return []
    
    // 寻找职责部分 - 修复正则表达式兼容性
    let responsibilitySection = null
    
    const patterns = [
      /岗位职责[：:]([\s\S]*?)(?=任职要求|职位要求|$)/,
      /工作职责[：:]([\s\S]*?)(?=任职要求|职位要求|$)/,
      /主要职责[：:]([\s\S]*?)(?=任职要求|职位要求|$)/
    ]
    
    for (const pattern of patterns) {
      const match = description.match(pattern)
      if (match) {
        responsibilitySection = match[1]
        break
      }
    }
    
    if (responsibilitySection) {
      // 提取编号列表
      const responsibilities = responsibilitySection
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => /^[0-9]/.test(line))
        .map(line => line.replace(/^[0-9]+[、．\.]?\s*/, '').trim())
        .filter(line => line.length > 5 && line.length < 100)
        .slice(0, 3)
      
      if (responsibilities.length >= 2) {
        return responsibilities
      }
    }
    
    // 如果没有找到结构化职责，根据职位类型生成通用职责
    const title = job.title.toLowerCase()
    if (title.includes('算法') || title.includes('vla')) {
      return [
        '负责算法模型的研发与优化',
        '参与技术架构设计与实现',
        '推动前沿技术的工程化落地'
      ]
    }
    if (title.includes('前端') || title.includes('react')) {
      return [
        '负责前端产品的开发与维护',
        '优化用户界面和交互体验',
        '参与技术架构升级和重构'
      ]
    }
    if (title.includes('后端') || title.includes('服务')) {
      return [
        '负责后端服务的开发与维护',
        '设计高并发分布式系统架构',
        '优化系统性能和稳定性'
      ]
    }
    
    return [
      '负责核心业务功能的开发实现',
      '参与技术方案设计与评审',
      '持续优化产品性能和用户体验'
    ]
  }

  const jobMatchScore = job.match_score || 0
  const jobSummary = extractJobSummary(job.description)
  const coreResponsibilities = extractCoreResponsibilities(job.description)

  return (
    <div className="group relative bg-white rounded-[16px] border border-gray-200/60 shadow-sm hover:shadow-lg transition-all duration-300 p-5 space-y-4 w-full" style={{ maxWidth: '645px', marginLeft: '-12px' }}>
      
      {/* 🏆 头部信息行：公司名 + 职位标题（同一行）+ Neura Score */}
      <div className="flex items-center justify-between gap-4">
        {/* 左侧：公司名 + 职位信息（同一行） */}
        <div className="flex-1 min-w-0 flex items-baseline gap-3">
          {/* 公司名：重点信息，加粗突出 */}
          <h3 className="text-xl font-bold text-gray-900 tracking-tight flex-shrink-0">
            {job.company}
          </h3>
          
          {/* 职位标题：次重点信息，稍小颜色浅灰 */}
          <div className="text-base text-gray-500 font-medium truncate">
            {job.title}
          </div>
        </div>

        {/* 右侧：Neura Score - 保持原有设计 */}
        <div className={`
          inline-flex items-center gap-1.5
          px-3 py-1.5
          ${getMatchScoreStyle(jobMatchScore).classes}
          rounded-full
          transition-all duration-200 ease-out
          cursor-default
          flex-shrink-0
        `}>
          <span className="text-xs font-medium">Neura Score</span>
          <span className={`text-sm font-bold ${getMatchScoreStyle(jobMatchScore).textColor}`}>
            {jobMatchScore}%
          </span>
        </div>
      </div>

      {/* 🎯 职位精华描述：苹果风格简洁设计 */}
      <div className="bg-gray-50/70 rounded-[12px] px-4 py-3">
        <p className="text-gray-800 font-medium text-sm leading-relaxed">
          {jobSummary}
        </p>
      </div>

      {/* 📋 核心职责：苹果风格简约列表 */}
      {coreResponsibilities.length > 0 && (
        <div className="space-y-3 pr-12">
          <h4 className="text-sm font-semibold text-gray-900 tracking-tight">
            核心职责：
          </h4>
          <ul className="space-y-2">
            {coreResponsibilities.map((responsibility, index) => (
              <li key={index} className="flex items-center gap-3">
                {/* Apple风格简约bullet点 */}
                <span className="flex-shrink-0 text-gray-400 text-sm font-medium">
                  •
                </span>
                <span className="text-gray-600 text-xs leading-relaxed">
                  {responsibility}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 💼 地点信息：只显示地点 */}
      {job.location && (
        <div className="pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            {job.location}
          </div>
        </div>
      )}

      {/* 🔗 复制按钮：右下角，参考人选卡片 */}
      <Button
        onClick={copyToClipboard}
        variant="ghost"
        size="sm"
        className="absolute bottom-4 right-4 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-gray-100/80 transition-all duration-200 rounded-lg"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : (
          <Copy className="h-4 w-4 text-gray-400" />
        )}
      </Button>

    </div>
  )
} 