'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CandidateSearchResult } from '@/lib/context/search-context'
import {
  Mail,
  MapPin,
  Phone,
  Building,
  Copy,
  Check
} from 'lucide-react'
import { useState } from 'react'

interface CandidateCardProps {
  candidate: any // 使用any类型来处理API返回的动态数据结构
  simplified?: boolean
}

export function CandidateCard({
  candidate,
  simplified = false
}: CandidateCardProps) {
  const [copied, setCopied] = useState(false)

  const getSimilarityStyle = (similarity: number) => {
    // 🎨 Neura Score 边框粗细分级设计 - 五档评分体系
    
    // 统一使用深紫色文字保证可读性
    const baseTextColor = 'text-purple-700'
    const numberTextColor = 'text-purple-800'
    
    if (similarity >= 80) {
      // 🏆 优秀等级 (80+): 粗边框 2px
      return {
        background: 'bg-white border-2 border-purple-500',
        textColor: baseTextColor,
        numberColor: numberTextColor,
        shadow: 'shadow-md',
        animation: 'hover:border-purple-600 hover:shadow-lg',
        border: 'border-2 border-purple-500',
        ring: 'ring-1 ring-purple-500/20'
      }
    }
    if (similarity >= 60) {
      // 🎯 良好等级 (60-79): 中等边框 1.5px
      return {
        background: 'bg-white border-[1.5px] border-purple-400',
        textColor: baseTextColor,
        numberColor: numberTextColor,
        shadow: 'shadow-sm',
        animation: 'hover:border-purple-500 hover:shadow-md',
        border: 'border-[1.5px] border-purple-400',
        ring: 'ring-1 ring-purple-400/15'
      }
    }
    if (similarity >= 40) {
      // 📊 一般等级 (40-59): 细边框 1px
      return {
        background: 'bg-white border border-purple-300',
        textColor: baseTextColor,
        numberColor: numberTextColor,
        shadow: 'shadow-sm',
        animation: 'hover:border-purple-400 hover:shadow-md',
        border: 'border border-purple-300',
        ring: 'ring-1 ring-purple-300/10'
      }
    }
    if (similarity >= 20) {
      // 🔸 较低等级 (20-39): 最细边框 0.5px
      return {
        background: 'bg-white border-[0.5px] border-purple-200',
        textColor: baseTextColor,
        numberColor: numberTextColor,
        shadow: 'shadow-sm',
        animation: 'hover:border-purple-300',
        border: 'border-[0.5px] border-purple-200',
        ring: 'ring-1 ring-purple-200/5'
      }
    }
    // 🔹 最低等级 (0-19): 无边框
    return {
      background: 'bg-gray-50',
      textColor: baseTextColor,
      numberColor: numberTextColor,
      shadow: 'shadow-sm',
      animation: 'hover:bg-gray-100',
      border: '',
      ring: ''
    }
  }

  // 安全地获取候选人字段，处理可能的数据结构不一致
  const candidateName = candidate.name || 'Unknown'
  const candidateTitle = candidate.title || candidate.current_title || 'No Title'
  const candidateLocation = candidate.location || null
  const candidateAge = candidate.age || null
  const candidateCompany = candidate.current_company || null
  const candidateEmail = candidate.email || null
  const candidatePhone = candidate.phone || null
  
  // 🔧 修复分数计算逻辑：正确处理 0 值的情况
  const candidateMatchScore = (() => {
    // 1. 如果有 match_score（包括0），直接使用
    if (candidate.match_score !== undefined && candidate.match_score !== null) {
      return candidate.match_score
    }
    // 2. 如果有 final_score（包括0），转换为百分比
    if (candidate.final_score !== undefined && candidate.final_score !== null) {
      return Math.round(candidate.final_score * 100)
    }
    // 3. 最后使用 similarity 转换为百分比
    return Math.round((candidate.similarity || 0) * 100)
  })()

  // 复制候选人信息到剪贴板
  const copyToClipboard = async () => {
    const info = `姓名: ${candidateName}
职位: ${candidateTitle}${candidateAge ? `\n年龄: ${candidateAge}` : ''}${candidateCompany ? `\n公司: ${candidateCompany}` : ''}${candidateLocation ? `\n地点: ${candidateLocation}` : ''}${candidatePhone ? `\n电话: ${candidatePhone}` : ''}${candidateEmail ? `\n邮箱: ${candidateEmail}` : ''}
匹配度: ${candidateMatchScore}%`

    try {
      await navigator.clipboard.writeText(info)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }



  const styleConfig = getSimilarityStyle(candidateMatchScore)

  if (simplified) {
    return (
      <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-300 ease-out w-full" style={{ maxWidth: '645px', marginLeft: '-12px' }}>
        {/* 第一行：姓名 + 年龄 + 职位 + 匹配分数 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* 姓名和年龄 */}
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-gray-900 tracking-tight leading-6">
                {candidateName}
              </h3>
              {candidateAge && (
                <span className="text-sm text-gray-500 font-medium">
                  {candidateAge}岁
                </span>
              )}
            </div>
            
            {/* 当前职位 */}
            <div className="flex-1 min-w-0">
              <p className="text-gray-600 text-sm font-medium line-clamp-2 leading-6">
                {candidateTitle}
              </p>
            </div>
          </div>

          {/* Shimmer效果匹配分数 */}
          <div className="flex-shrink-0 ml-3">
            <div className={`
              inline-flex items-center gap-1.5
              px-3 py-1.5
              ${styleConfig.background}
              rounded-full
              transition-all duration-200 ease-out
              ${styleConfig.shadow}
              ${styleConfig.animation}
              cursor-default
              ${styleConfig.border}
              ${styleConfig.ring}
            `}>
              <span className={`text-xs font-medium ${styleConfig.textColor}`}>Neura Score</span>
              <span className={`font-bold text-sm ${styleConfig.numberColor}`}>
                {candidateMatchScore}%
              </span>
            </div>
          </div>
        </div>

        {/* 第二行：公司信息 */}
        {candidateCompany && (
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-4 w-4 text-gray-400 flex-shrink-0 stroke-1" />
            <span className="text-gray-700 text-sm font-medium truncate leading-6">
              {candidateCompany}
            </span>
          </div>
        )}

        {/* 第三行：联系方式 - 地点、电话、邮箱 */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 leading-6">
          {candidateLocation && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 stroke-1 text-gray-400" />
              <span>
                {candidateLocation}
                {candidateAge && <span className="text-gray-400"> · {candidateAge}岁</span>}
              </span>
            </div>
          )}
          {candidatePhone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 flex-shrink-0 stroke-1 text-gray-400" />
              <span>{candidatePhone}</span>
            </div>
          )}
          {candidateEmail && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 flex-shrink-0 stroke-1 text-gray-400" />
              <span className="truncate max-w-[200px]">
                {candidateEmail}
              </span>
            </div>
          )}
        </div>

        {/* 复制按钮 */}
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

  // 保留原有的完整版本以兼容其他地方的使用
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-neutral-100 p-4 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-900 tracking-tight">{candidateName}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {candidateTitle && (
                  <span className="line-clamp-2">{candidateTitle}</span>
                )}
              </div>
            </div>
            <div className={`
              inline-flex items-center gap-1.5
              px-3 py-1.5
              ${styleConfig.background}
              rounded-full
              transition-all duration-200 ease-out
              ${styleConfig.shadow}
              ${styleConfig.animation}
              cursor-default
              ${styleConfig.border}
              ${styleConfig.ring}
            `}>
              <span className={`text-xs font-medium ${styleConfig.textColor}`}>Neura Score</span>
              <span className={`font-bold text-sm ${styleConfig.numberColor}`}>
                {candidateMatchScore}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
 