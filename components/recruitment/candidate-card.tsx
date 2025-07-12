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
} from 'lucide-react'

interface CandidateCardProps {
  candidate: CandidateSearchResult
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
    if (similarity >= 0.8) return 'bg-green-100 text-green-800'
    if (similarity >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  if (simplified) {
    return (
      <div className="bg-white rounded-xl px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.06)] cursor-pointer -ml-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#333] text-lg leading-tight truncate">{candidate.name}</h3>
            {candidate.title && (
              <p className="text-[#666] text-sm font-medium mt-1 truncate">{candidate.title}</p>
            )}
          </div>
          <Badge className="bg-green-500 text-white px-3 py-1 text-sm font-medium flex-shrink-0 flex items-center gap-1 self-start sm:self-auto">
            <TrendingUp className="h-3 w-3" />
            {candidate.match_score || 0}%
          </Badge>
        </div>

        {/* 基本信息 */}
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[#666]">
          {candidate.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{candidate.location}</span>
            </div>
          )}
          {candidate.experience && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{candidate.experience}</span>
            </div>
          )}
        </div>

        {/* 技能标签 */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {candidate.skills.slice(0, 3).map((skill, index) => (
              <span key={index} className="bg-[#F3F4F6] text-[#333] px-3 py-1 rounded-full text-sm">
                {skill}
              </span>
            ))}
            {candidate.skills.length > 3 && (
              <span className="bg-[#F3F4F6] text-[#666] px-3 py-1 rounded-full text-sm">
                +{candidate.skills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 联系信息 */}
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[#666]">
          {candidate.email && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{candidate.email}</span>
            </div>
          )}
          {candidate.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              <span>{candidate.phone}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 保留原有的完整版本以兼容其他地方的使用
  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{getInitials(candidate.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">{candidate.name}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {candidate.title && (
                  <span>{candidate.title}</span>
                )}
              </div>
            </div>
            <Badge className={getSimilarityColor(candidate.match_score ? candidate.match_score / 100 : 0)}>
              匹配度 {candidate.match_score || 0}%
            </Badge>
          </div>
          
          {/* 其他信息... */}
        </div>
      </div>
    </div>
  )
}
 