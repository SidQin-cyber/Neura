'use client'

import React from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { X, MapPin, Briefcase, Star, GraduationCap, DollarSign, Building, Clock } from 'lucide-react'

interface ParsedQuery {
  search_type: 'candidate' | 'job'
  role: string[]
  skills_must: string[]
  skills_related: Array<{ skill: string; confidence: number }>
  industry: string[]
  location: string[]
  experience_min: number | null
  experience_max: number | null
  education: string[]
  salary_min: number | null
  salary_max: number | null
  company: string[]
  gender: string | null
  age_min: number | null
  age_max: number | null
  rewritten_query: string
}

interface QueryChipsProps {
  parsedQuery: ParsedQuery
  onRemoveChip?: (category: keyof ParsedQuery, index: number) => void
  onClear?: () => void
  className?: string
}

export function QueryChips({ 
  parsedQuery, 
  onRemoveChip, 
  onClear, 
  className = '' 
}: QueryChipsProps) {
  const renderChips = (
    items: string[], 
    category: keyof ParsedQuery, 
    icon: React.ReactNode, 
    color: string = 'bg-gray-50 text-gray-700 border-gray-200'
  ) => {
    if (!items.length) return null
    
    return items.map((item, index) => (
      <Badge 
        key={`${category}-${index}`} 
        variant="outline" 
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 
          ${color} 
          hover:${color.replace('50', '100').replace('text-gray-700', 'text-gray-800')} 
          transition-all duration-200 ease-out
          cursor-text
          ring-1 ring-gray-200/50
          hover:ring-gray-300/50
          hover:shadow-sm
        `}
      >
        {icon}
        <span className="text-xs font-medium select-text">{item}</span>
        {onRemoveChip && (
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 ml-1 hover:bg-red-100 transition-colors duration-150 cursor-pointer"
            onClick={() => onRemoveChip(category, index)}
            title="删除标签"
          >
            <X size={12} />
          </Button>
        )}
      </Badge>
    ))
  }

  const renderExperience = () => {
    if (!parsedQuery.experience_min && !parsedQuery.experience_max) return null
    
    let experienceText = ''
    if (parsedQuery.experience_min && parsedQuery.experience_max) {
      experienceText = `${parsedQuery.experience_min}-${parsedQuery.experience_max}年`
    } else if (parsedQuery.experience_min) {
      experienceText = `${parsedQuery.experience_min}年以上`
    } else if (parsedQuery.experience_max) {
      experienceText = `${parsedQuery.experience_max}年以下`
    }
    
    return (
      <Badge 
        variant="outline" 
        className="
          inline-flex items-center gap-1.5 px-3 py-1.5 
          bg-green-50 text-green-700 border-green-200
          hover:bg-green-100 hover:text-green-800
          transition-all duration-200 ease-out
          cursor-text
          ring-1 ring-green-200/50
          hover:ring-green-300/50
          hover:shadow-sm
        "
      >
        <Clock size={14} />
        <span className="text-xs font-medium select-text">{experienceText}</span>
      </Badge>
    )
  }

  const renderSalary = () => {
    if (!parsedQuery.salary_min && !parsedQuery.salary_max) return null
    
    let salaryText = ''
    if (parsedQuery.salary_min && parsedQuery.salary_max) {
      salaryText = `${parsedQuery.salary_min}-${parsedQuery.salary_max}k`
    } else if (parsedQuery.salary_min) {
      salaryText = `${parsedQuery.salary_min}k+`
    } else if (parsedQuery.salary_max) {
      salaryText = `≤${parsedQuery.salary_max}k`
    }
    
    return (
      <Badge 
        variant="outline" 
        className="
          inline-flex items-center gap-1.5 px-3 py-1.5 
          bg-emerald-50 text-emerald-700 border-emerald-200
          hover:bg-emerald-100 hover:text-emerald-800
          transition-all duration-200 ease-out
          cursor-text
          ring-1 ring-emerald-200/50
          hover:ring-emerald-300/50
          hover:shadow-sm
        "
      >
        <DollarSign size={14} />
        <span className="text-xs font-medium select-text">{salaryText}</span>
      </Badge>
    )
  }

  const hasAnyChips = (
    parsedQuery.role.length > 0 ||
    parsedQuery.skills_must.length > 0 ||
    parsedQuery.skills_related.length > 0 ||
    parsedQuery.industry.length > 0 ||
    parsedQuery.location.length > 0 ||
    parsedQuery.education.length > 0 ||
    parsedQuery.company.length > 0 ||
    parsedQuery.experience_min ||
    parsedQuery.experience_max ||
    parsedQuery.salary_min ||
    parsedQuery.salary_max
  )

  if (!hasAnyChips) return null

  return (
    <div className={`space-y-3 p-4 bg-gray-50/80 rounded-lg border border-gray-200/60 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            解析结果 ({parsedQuery.search_type === 'candidate' ? '找人选' : '找职位'})
          </span>
          <Badge 
            variant="outline" 
            className="text-xs bg-white border-gray-200 text-gray-600"
          >
            {parsedQuery.search_type === 'candidate' ? '👥 候选人搜索' : '💼 职位搜索'}
          </Badge>
        </div>
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150"
            title="清除所有解析结果"
          >
            <X size={16} />
            清除
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {/* 岗位 */}
        {renderChips(
          parsedQuery.role, 
          'role', 
          <Briefcase size={14} />, 
          'bg-purple-50 text-purple-700 border-purple-200'
        )}

        {/* 必备技能 - 改为浅灰色 */}
        {renderChips(
          parsedQuery.skills_must, 
          'skills_must', 
          <Star size={14} />, 
          'bg-gray-50 text-gray-700 border-gray-200'
        )}

        {/* 相关技能 */}
        {parsedQuery.skills_related
          .filter(item => item.confidence >= 3)
          .map((item, index) => (
            <Badge 
              key={`skills_related-${index}`} 
              variant="outline" 
              className="
                inline-flex items-center gap-1.5 px-3 py-1.5 
                bg-gray-100/80 text-gray-600 border-gray-300 
                hover:bg-gray-200/80 hover:text-gray-700
                transition-all duration-200 ease-out
                cursor-text
                ring-1 ring-gray-200/30
                hover:ring-gray-300/50
                hover:shadow-sm
              "
            >
              <Star size={14} className="opacity-60" />
              <span className="text-xs font-medium select-text">{item.skill}</span>
              <span className="text-xs opacity-50">({item.confidence})</span>
              {onRemoveChip && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-red-100 transition-colors duration-150 cursor-pointer"
                  onClick={() => {
                    // Note: This would need special handling for skills_related
                    console.log('Remove related skill:', item.skill)
                  }}
                  title="删除相关技能"
                >
                  <X size={12} />
                </Button>
              )}
            </Badge>
          ))}

        {/* 地点 */}
        {renderChips(
          parsedQuery.location, 
          'location', 
          <MapPin size={14} />, 
          'bg-orange-50 text-orange-700 border-orange-200'
        )}

        {/* 行业 */}
        {renderChips(
          parsedQuery.industry, 
          'industry', 
          <Building size={14} />, 
          'bg-teal-50 text-teal-700 border-teal-200'
        )}

        {/* 公司 */}
        {renderChips(
          parsedQuery.company, 
          'company', 
          <Building size={14} />, 
          'bg-indigo-50 text-indigo-700 border-indigo-200'
        )}

        {/* 学历 */}
        {renderChips(
          parsedQuery.education, 
          'education', 
          <GraduationCap size={14} />, 
          'bg-pink-50 text-pink-700 border-pink-200'
        )}

        {/* 工作经验 */}
        {renderExperience()}

        {/* 薪资 */}
        {renderSalary()}
      </div>

      {/* 重写后的查询 */}
      {parsedQuery.rewritten_query && parsedQuery.rewritten_query !== '' && (
        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-1">优化后的搜索语句：</div>
          <div className="
            text-sm text-gray-700 bg-white px-3 py-2 rounded border border-gray-200
            italic cursor-text select-text
            hover:border-gray-300 transition-colors duration-150
          ">
            &ldquo;{parsedQuery.rewritten_query}&rdquo;
          </div>
        </div>
      )}
    </div>
  )
} 