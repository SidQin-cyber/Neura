'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { JobSearchResult } from '@/lib/context/search-context'
import {
  Building,
  Calendar,
  DollarSign,
  MapPin,
  TrendingUp,
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

  if (simplified) {
    return (
      <div className="bg-white rounded-xl px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer -ml-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#333] text-lg leading-tight truncate">{job.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Building className="h-4 w-4 text-[#666] flex-shrink-0" />
              <p className="text-[#666] text-sm font-medium truncate">{job.company}</p>
            </div>
          </div>
          <Badge className="bg-green-500 text-white px-3 py-1 text-sm font-medium flex-shrink-0 flex items-center gap-1 self-start sm:self-auto">
            <TrendingUp className="h-3 w-3" />
            {job.match_score || 0}%
          </Badge>
        </div>

        {/* 基本信息 */}
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[#666]">
          {job.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{job.location}</span>
            </div>
          )}
          {job.experience_required && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{job.experience_required}</span>
            </div>
          )}
          {job.salary_range && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              <span>{job.salary_range}</span>
            </div>
          )}
        </div>

        {/* 技能要求 */}
        {job.skills_required && job.skills_required.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {job.skills_required.slice(0, 3).map((skill, index) => (
              <span key={index} className="bg-[#F3F4F6] text-[#333] px-3 py-1 rounded-full text-sm">
                {skill}
              </span>
            ))}
            {job.skills_required.length > 3 && (
              <span className="bg-[#F3F4F6] text-[#666] px-3 py-1 rounded-full text-sm">
                +{job.skills_required.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 职位描述 */}
        {job.description && (
          <p className="text-[#333] text-sm mt-2 leading-relaxed line-clamp-2">
            {job.description}
          </p>
        )}
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
            <Badge className={getSimilarityColor(job.match_score ? job.match_score / 100 : 0)}>
              匹配度 {job.match_score || 0}%
            </Badge>
          </div>
          
          {/* 其他信息... */}
        </div>
      </div>
    </div>
  )
}
 