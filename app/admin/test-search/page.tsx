'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TestResult {
  query: string
  success: boolean
  count: number
  error?: string
  results?: Array<{
    id: string
    name: string
    current_company: string
    current_title: string
    similarity: number
    location: string
  }>
}

interface TestResponse {
  success: boolean
  testResults: TestResult[]
  summary: {
    totalTests: number
    successfulTests: number
    totalCandidatesFound: number
  }
  error?: string
}

export default function TestSearchPage() {
  const [testResults, setTestResults] = useState<TestResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runTest = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/debug/test-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      const data = await response.json()
      setTestResults(data)
      console.log('🧪 测试结果:', data)
    } catch (error) {
      console.error('测试失败:', error)
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : '测试失败',
        testResults: [],
        summary: { totalTests: 0, successfulTests: 0, totalCandidatesFound: 0 }
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">硬编码搜索测试</h1>
        <p className="text-gray-600">
          绕过Neura Spark，直接测试底层向量搜索功能是否正常工作
        </p>
      </div>

      <div className="mb-6">
        <Button 
          onClick={runTest} 
          disabled={isLoading}
          className="w-full md:w-auto"
        >
          {isLoading ? '测试中...' : '开始硬编码搜索测试'}
        </Button>
      </div>

      {testResults && (
        <div className="space-y-6">
          {/* 测试总结 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                测试总结
                <Badge variant={testResults.success ? 'default' : 'destructive'}>
                  {testResults.success ? '成功' : '失败'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.success ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {testResults.summary.totalTests}
                    </div>
                    <div className="text-sm text-gray-600">总测试数</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.summary.successfulTests}
                    </div>
                    <div className="text-sm text-gray-600">成功测试数</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {testResults.summary.totalCandidatesFound}
                    </div>
                    <div className="text-sm text-gray-600">总找到候选人数</div>
                  </div>
                </div>
              ) : (
                <div className="text-red-600">
                  测试失败: {testResults.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 详细测试结果 */}
          {testResults.success && testResults.testResults.map((result, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>测试 {index + 1}: {result.query}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={result.success ? 'default' : 'destructive'}>
                      {result.success ? '成功' : '失败'}
                    </Badge>
                    {result.success && (
                      <Badge variant="outline">
                        {result.count} 个结果
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.success ? (
                  result.results && result.results.length > 0 ? (
                    <div className="space-y-3">
                      {result.results.map((candidate, idx) => (
                        <div key={candidate.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">{candidate.name}</h4>
                              <p className="text-sm text-gray-600">{candidate.current_title}</p>
                            </div>
                            <Badge variant="outline">
                              相似度: {(candidate.similarity * 100).toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="text-sm space-y-1">
                            <div><strong>公司:</strong> {candidate.current_company}</div>
                            <div><strong>地点:</strong> {candidate.location}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500">没有找到候选人</div>
                  )
                ) : (
                  <div className="text-red-600">
                    错误: {result.error}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
} 