'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, AlertCircle, TrendingUp, BarChart3, DollarSign, Search } from 'lucide-react'
import { parseSalaryText, formatSalaryRange, calculateSalaryMatchScore, type SalaryRange } from '@/lib/utils/salary-parser'
import { createClient } from '@/lib/supabase/client'

interface SalaryValidationPanelProps {
  className?: string
}

interface SalaryIssue {
  id: string
  type: 'candidates' | 'jobs'
  recordId: string
  name: string
  originalMin: number | null
  originalMax: number | null
  issues: string[]
  suggestedFix?: {
    min: number | null
    max: number | null
    reason: string
  }
}

interface SalaryStats {
  entityType: string
  avgMinSalary: number
  avgMaxSalary: number
  medianMinSalary: number
  medianMaxSalary: number
  minSalary: number
  maxSalary: number
  countWithSalary: number
  totalCount: number
}

export function SalaryValidationPanel({ className }: SalaryValidationPanelProps) {
  const [testSalaryText, setTestSalaryText] = useState('')
  const [parseResult, setParseResult] = useState<{ success: boolean; ranges: SalaryRange[]; error?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [salaryIssues, setSalaryIssues] = useState<SalaryIssue[]>([])
  const [salaryStats, setSalaryStats] = useState<SalaryStats[]>([])
  const [candidateRange, setCandidateRange] = useState({ min: 25, max: 35 })
  const [jobRange, setJobRange] = useState({ min: 20, max: 30 })

  const supabase = createClient()

  // 测试薪资解析
  const handleTestParsing = () => {
    if (!testSalaryText.trim()) return
    
    const result = parseSalaryText(testSalaryText)
    setParseResult(result)
  }

  // 获取薪资统计
  const fetchSalaryStats = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_salary_statistics_rpc')
      if (error) throw error
      setSalaryStats(data || [])
    } catch (error) {
      console.error('获取薪资统计失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 运行薪资数据清洗
  const runSalaryValidation = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('clean_salary_data')
      if (error) throw error
      
      // 转换数据格式
      const issues: SalaryIssue[] = (data || []).map((item: any) => ({
        id: item.record_id,
        type: item.table_name,
        recordId: item.record_id,
        name: `${item.table_name} - ${item.record_id}`,
        originalMin: item.original_min,
        originalMax: item.original_max,
        issues: item.issues || [],
        suggestedFix: generateSuggestedFix(item)
      }))
      
      setSalaryIssues(issues)
    } catch (error) {
      console.error('薪资验证失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateSuggestedFix = (item: any) => {
    if (item.issues.includes('min_greater_than_max')) {
      return {
        min: Math.min(item.original_min, item.original_max),
        max: Math.max(item.original_min, item.original_max),
        reason: '交换最小值和最大值'
      }
    }
    
    if (item.issues.includes('min_too_low')) {
      return {
        min: 5000,
        max: item.original_max,
        reason: '最小薪资过低，建议设为5000'
      }
    }
    
    if (item.issues.includes('max_too_high')) {
      return {
        min: item.original_min,
        max: 200000,
        reason: '最大薪资过高，建议设为200000'
      }
    }
    
    return undefined
  }

  // 计算匹配度
  const matchScore = calculateSalaryMatchScore(
    { min: candidateRange.min * 1000, max: candidateRange.max * 1000 },
    { min: jobRange.min * 1000, max: jobRange.max * 1000 }
  )

  useEffect(() => {
    fetchSalaryStats()
  }, [])

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-green-600" />
        <h2 className="text-xl font-semibold">薪资数据验证与优化</h2>
      </div>

      <Tabs defaultValue="parser" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="parser">薪资解析测试</TabsTrigger>
          <TabsTrigger value="validation">数据验证</TabsTrigger>
          <TabsTrigger value="statistics">统计分析</TabsTrigger>
          <TabsTrigger value="matching">匹配度测试</TabsTrigger>
        </TabsList>

        <TabsContent value="parser" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                薪资解析测试
              </CardTitle>
              <CardDescription>
                测试各种薪资格式的解析效果
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="salary-text">薪资文本</Label>
                <Input
                  id="salary-text"
                  value={testSalaryText}
                  onChange={(e) => setTestSalaryText(e.target.value)}
                  placeholder="输入薪资文本，例如：期望薪资25-35k"
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    '30k',
                    '3w',
                    '25-35k',
                    '年薪36万',
                    '月薪30000',
                    '期望薪资28k-32k',
                    '2w-3w',
                    '30万'
                  ].map((example) => (
                    <Button
                      key={example}
                      variant="outline"
                      size="sm"
                      onClick={() => setTestSalaryText(example)}
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
              
              <Button onClick={handleTestParsing} disabled={!testSalaryText.trim()}>
                解析薪资
              </Button>

              {parseResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {parseResult.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="font-medium">
                      {parseResult.success ? '解析成功' : '解析失败'}
                    </span>
                  </div>

                  {parseResult.success && parseResult.ranges.map((range, index) => (
                    <div key={index} className="bg-green-50 p-3 rounded-lg">
                      <div className="text-sm text-green-800">
                        <div>原始文本: {range.original}</div>
                        <div>最小值: {range.min?.toLocaleString()} 元</div>
                        <div>最大值: {range.max?.toLocaleString()} 元</div>
                        <div>格式化: {formatSalaryRange(range)}</div>
                      </div>
                    </div>
                  ))}

                  {parseResult.error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-700">{parseResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                数据验证与清洗
              </CardTitle>
              <CardDescription>
                检查并修复薪资数据中的问题
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runSalaryValidation} disabled={isLoading}>
                {isLoading ? '验证中...' : '运行薪资验证'}
              </Button>

              {salaryIssues.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">发现的问题:</h4>
                  {salaryIssues.map((issue) => (
                    <div key={issue.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{issue.name}</span>
                        <Badge variant="outline">{issue.type}</Badge>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <div>原始范围: {issue.originalMin?.toLocaleString()} - {issue.originalMax?.toLocaleString()}</div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {issue.issues.map((issueType) => (
                          <Badge key={issueType} variant="destructive" className="text-xs">
                            {getIssueLabel(issueType)}
                          </Badge>
                        ))}
                      </div>
                      
                      {issue.suggestedFix && (
                        <div className="bg-blue-50 p-2 rounded text-sm">
                          <div className="font-medium text-blue-800">建议修复:</div>
                          <div className="text-blue-700">
                            {issue.suggestedFix.min?.toLocaleString()} - {issue.suggestedFix.max?.toLocaleString()}
                          </div>
                          <div className="text-blue-600">{issue.suggestedFix.reason}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {salaryIssues.length === 0 && !isLoading && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-700">薪资数据验证完成，未发现问题！</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                薪资统计分析
              </CardTitle>
              <CardDescription>
                查看薪资数据的整体分布情况
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {salaryStats.map((stat) => (
                  <div key={stat.entityType} className="border rounded-lg p-4 space-y-3">
                    <h4 className="font-medium capitalize">
                      {stat.entityType === 'candidates' ? '候选人' : '职位'}薪资统计
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">平均最小:</span>
                        <div className="font-medium">{stat.avgMinSalary?.toLocaleString()} 元</div>
                      </div>
                      <div>
                        <span className="text-gray-600">平均最大:</span>
                        <div className="font-medium">{stat.avgMaxSalary?.toLocaleString()} 元</div>
                      </div>
                      <div>
                        <span className="text-gray-600">中位数最小:</span>
                        <div className="font-medium">{stat.medianMinSalary?.toLocaleString()} 元</div>
                      </div>
                      <div>
                        <span className="text-gray-600">中位数最大:</span>
                        <div className="font-medium">{stat.medianMaxSalary?.toLocaleString()} 元</div>
                      </div>
                      <div>
                        <span className="text-gray-600">最低薪资:</span>
                        <div className="font-medium">{stat.minSalary?.toLocaleString()} 元</div>
                      </div>
                      <div>
                        <span className="text-gray-600">最高薪资:</span>
                        <div className="font-medium">{stat.maxSalary?.toLocaleString()} 元</div>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <div className="text-xs text-gray-500">
                        有薪资数据: {stat.countWithSalary} / {stat.totalCount}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{ width: `${(stat.countWithSalary / stat.totalCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matching" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                薪资匹配度测试
              </CardTitle>
              <CardDescription>
                测试候选人与职位的薪资匹配度
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>候选人期望薪资 (k)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={candidateRange.min}
                      onChange={(e) => setCandidateRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                      placeholder="最小值"
                    />
                    <Input
                      type="number"
                      value={candidateRange.max}
                      onChange={(e) => setCandidateRange(prev => ({ ...prev, max: parseInt(e.target.value) || 0 }))}
                      placeholder="最大值"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>职位薪资范围 (k)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={jobRange.min}
                      onChange={(e) => setJobRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                      placeholder="最小值"
                    />
                    <Input
                      type="number"
                      value={jobRange.max}
                      onChange={(e) => setJobRange(prev => ({ ...prev, max: parseInt(e.target.value) || 0 }))}
                      placeholder="最大值"
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-2xl shadow-lg shadow-purple-100/50 border border-purple-100">
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                    {Math.round(matchScore * 100)}%
                  </div>
                  <div className="text-sm text-purple-600 mt-1 font-medium">Neura Score</div>
                </div>
                
                <div className="mt-4">
                  <div className="w-full bg-purple-50 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500 ease-out shadow-sm"
                      style={{ width: `${matchScore * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-purple-600 mt-2 text-center font-medium">
                    {matchScore >= 0.8 ? '高度匹配' :
                     matchScore >= 0.6 ? '基本匹配' :
                     matchScore >= 0.4 ? '存在差距' : '差距较大'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function getIssueLabel(issueType: string): string {
  const labels: Record<string, string> = {
    'min_greater_than_max': '最小值大于最大值',
    'min_too_low': '最小值过低',
    'max_too_high': '最大值过高'
  }
  return labels[issueType] || issueType
} 