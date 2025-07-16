'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { CandidateSearchResult } from '@/lib/context/search-context'
import {
  Calendar,
  Mail,
  MapPin,
  Phone,
  TrendingUp,
  Building,
} from 'lucide-react'

interface CandidateCardProps {
  candidate: any // 使用any类型来处理API返回的动态数据结构
  simplified?: boolean
}

export function CandidateCard({
  candidate,
  simplified = false
}: CandidateCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 80) return 'bg-green-500 text-white'
    if (similarity >= 60) return 'bg-yellow-500 text-white'
    if (similarity >= 40) return 'bg-orange-500 text-white'
    return 'bg-red-500 text-white'
  }
  
  const getMatchLabel = (score: number) => {
    if (score >= 80) return '高匹配'
    if (score >= 60) return '中匹配'
    if (score >= 40) return '低匹配'
    return '不匹配'
  }

  // 安全地获取候选人字段，处理可能的数据结构不一致
  const candidateName = candidate.name || 'Unknown'
  const candidateTitle = candidate.title || candidate.current_title || 'No Title'
  const candidateLocation = candidate.location || null
  const candidateExperience = candidate.experience || 
    (candidate.years_of_experience ? `${candidate.years_of_experience}年经验` : null)
  const candidateSkills = candidate.skills || []
  // 优先使用 match_score，其次使用 final_score*100，最后使用 similarity*100
  const candidateMatchScore = candidate.match_score || 
    (candidate.final_score ? Math.round(candidate.final_score * 100) : 
     Math.round((candidate.similarity || 0) * 100))

  if (simplified) {
    return (
      <div className="bg-white rounded-xl px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer -ml-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#333] text-lg leading-tight truncate">{candidateName}</h3>
            {candidateTitle && (
              <p className="text-[#666] text-sm font-medium mt-1 truncate">{candidateTitle}</p>
            )}
          </div>
          <Badge className={`${getSimilarityColor(candidateMatchScore)} px-3 py-1 text-sm font-medium flex-shrink-0 flex items-center gap-1 self-start sm:self-auto`}>
            <TrendingUp className="h-3 w-3" />
            {candidateMatchScore}%
          </Badge>
        </div>

        {/* 基本信息 */}
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[#666]">
          {candidateLocation && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{candidateLocation}</span>
            </div>
          )}
          {candidateExperience && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{candidateExperience}</span>
            </div>
          )}
        </div>

        {/* 技能标签 */}
        {candidateSkills && candidateSkills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {candidateSkills.slice(0, 3).map((skill: string, index: number) => (
              <span key={index} className="bg-[#F3F4F6] text-[#333] px-3 py-1 rounded-full text-sm">
                {skill}
              </span>
            ))}
            {candidateSkills.length > 3 && (
              <span className="bg-[#F3F4F6] text-[#666] px-3 py-1 rounded-full text-sm">
                +{candidateSkills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 联系方式 */}
        <div className="flex flex-col gap-1.5 mt-2 text-sm text-[#666]">
          {candidate.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              <span>{candidate.email}</span>
            </div>
          )}
          {candidate.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              <span>{candidate.phone}</span>
            </div>
          )}
        </div>

        {/* 公司信息 */}
        {candidate.current_company && (
          <div className="flex items-center gap-1.5 mt-2 text-sm text-[#666]">
            <Building className="h-4 w-4" />
            <span>{candidate.current_company}</span>
          </div>
        )}
      </div>
    )
  }

  // 保留原有的完整版本以兼容其他地方的使用
  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{getInitials(candidateName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">{candidateName}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {candidateTitle && (
                  <span>{candidateTitle}</span>
                )}
              </div>
            </div>
            <Badge className={getSimilarityColor(candidateMatchScore)}>
              {getMatchLabel(candidateMatchScore)} {candidateMatchScore}%
            </Badge>
          </div>
          
          {/* 其他信息... */}
        </div>
      </div>
    </div>
  )
}
 