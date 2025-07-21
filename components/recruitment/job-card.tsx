'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { JobSearchResult } from '@/lib/context/search-context'
import {
  Building,
} from 'lucide-react'

interface JobCardProps {
  job: JobSearchResult
  simplified?: boolean
}

export function JobCard({
  job,
  simplified = false
}: JobCardProps) {
  const getCompanyInitials = (company: string) => {
    return company
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return 'bg-green-100 text-green-800'
    if (similarity >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  // 🎨 Neura Score 边框粗细分级设计 - 五档评分体系
  const getMatchScoreStyle = (score: number) => {
    // 统一使用深紫色文字保证可读性
    const baseTextColor = 'text-purple-700'
    const numberTextColor = 'text-purple-800'
    
    if (score >= 80) {
      // 🏆 优秀等级 (80+): 粗边框 2px
      return {
        classes: 'bg-white border-2 border-purple-500 text-purple-700 shadow-md hover:border-purple-600 hover:shadow-lg ring-1 ring-purple-500/20',
        textColor: numberTextColor
      }
    }
    if (score >= 60) {
      // 🎯 良好等级 (60-79): 中等边框 1.5px  
      return {
        classes: 'bg-white border-[1.5px] border-purple-400 text-purple-700 shadow-sm hover:border-purple-500 hover:shadow-md ring-1 ring-purple-400/15',
        textColor: numberTextColor
      }
    }
    if (score >= 40) {
      // 📊 一般等级 (40-59): 细边框 1px
      return {
        classes: 'bg-white border border-purple-300 text-purple-700 shadow-sm hover:border-purple-400 hover:shadow-md ring-1 ring-purple-300/10',
        textColor: numberTextColor
      }
    }
    if (score >= 20) {
      // 🔸 较低等级 (20-39): 最细边框 0.5px
      return {
        classes: 'bg-white border-[0.5px] border-purple-200 text-purple-700 shadow-sm hover:border-purple-300 ring-1 ring-purple-200/5',
        textColor: numberTextColor
      }
    }
    // 🔹 最低等级 (0-19): 无边框
    return {
      classes: 'bg-gray-50 text-purple-700 shadow-sm hover:bg-gray-100',
      textColor: numberTextColor
    }
  }

  const jobMatchScore = job.match_score || 0

  if (simplified) {
    // 🎯 构建基础要求信息（经验和学历）
    const buildBasicRequirements = () => {
      const requirements = []
      
      // 经验要求
      if (job.experience_required) {
        requirements.push(`${job.experience_required}年经验`)
      }
      
      // 学历要求（如果API返回的数据中有此字段）
      if ((job as any).education_required) {
        requirements.push((job as any).education_required)
      }
      
      return requirements.filter(Boolean).join(' / ')
    }

    // 🎯 获取核心技能（前5个最重要的）
    const getCoreSkills = () => {
      if (job.skills_required && job.skills_required.length > 0) {
        return job.skills_required.slice(0, 5)
      }
      return []
    }

    return (
      <div className="group relative bg-white rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md hover:border-gray-300/60 transition-all duration-300 ease-out w-full" style={{ maxWidth: '645px', marginLeft: '-12px' }}>
        <div className="p-6 space-y-4">
          {/* Line 1: Company Name (bold, top-left) + Neura Score (right-aligned badge) */}
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-bold text-gray-900 text-lg leading-6 flex-1 min-w-0">
              {job.company}
            </h3>
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

          {/* Line 2: Job Title + Location (smaller, show search relevance) */}
          <div className="flex items-center gap-2">
            <span className="text-gray-700 font-semibold text-base leading-6">
              {job.title}
            </span>
            {job.location && (
              <>
                <span className="text-gray-400 text-sm">·</span>
                <span className="text-gray-500 text-base leading-6">
                  {job.location}
                </span>
              </>
            )}
          </div>

          {/* Line 3: Experience / Degree / Skills (small and secondary) */}
          <div className="space-y-3">
            {/* 基础要求：经验和学历 */}
            {buildBasicRequirements() && (
              <div className="text-gray-500 text-sm leading-5 font-medium">
                {buildBasicRequirements()}
              </div>
            )}
            
            {/* 核心技能：胶囊形式 */}
            {getCoreSkills().length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {getCoreSkills().map((skill, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-all duration-200 ease-out border border-gray-200/50"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : !buildBasicRequirements() && (
              <div className="text-gray-500 text-sm leading-5 font-medium">
                详情请查看职位描述
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 保留原有的完整版本以兼容其他地方的使用
  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-blue-100 text-blue-800">
            {getCompanyInitials(job.company)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg text-blue-900">{job.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                <span className="font-medium">{job.company}</span>
              </div>
            </div>
            <Badge className={getMatchScoreStyle(jobMatchScore).classes}>
              Neura Score {jobMatchScore}%
            </Badge>
          </div>
          
          {/* 其他信息... */}
        </div>
      </div>
    </div>
  )
}
 