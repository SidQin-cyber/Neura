'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface VectorTestResult {
  success: boolean
  tests: {
    data_fetch: {
      success: boolean
      candidateName: string | null
    }
    vector_generation: {
      success: boolean
      query: string
      dimensions: number
    }
    direct_search: {
      success: boolean
      totalCandidates: number
      resultsWithSimilarity: number
      topResult: any
    }
  }
  results: Array<{
    id: string
    name: string
    current_company: string
    current_title: string
    similarity: number
  }>
  summary: {
    foundBeiwenjin: boolean
    maxSimilarity: number
  }
  error?: string
}

export default function TestVectorPage() {
  const [testResults, setTestResults] = useState<VectorTestResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runTest = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/debug/test-direct-vector', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      const data = await response.json()
      setTestResults(data)
      console.log('🧪 直接向量测试结果:', data)
    } catch (error) {
      console.error('向量测试失败:', error)
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : '测试失败',
        tests: {
          data_fetch: { success: false, candidateName: null },
          vector_generation: { success: false, query: '', dimensions: 0 },
          direct_search: { success: false, totalCandidates: 0, resultsWithSimilarity: 0, topResult: null }
        },
        results: [],
        summary: { foundBeiwenjin: false, maxSimilarity: 0 }
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">直接向量搜索测试</h1>
        <p className="text-gray-600">
          绕过RPC函数，直接测试向量相似度计算是否正常工作
        </p>
      </div>

      <div className="mb-6">
        <Button 
          onClick={runTest} 
          disabled={isLoading}
          className="w-full md:w-auto"
        >
          {isLoading ? '向量测试中...' : '运行直接向量搜索测试'}
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
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <strong>找到贝文瑾:</strong> 
                      <Badge variant={testResults.summary.foundBeiwenjin ? 'default' : 'destructive'} className="ml-2">
                        {testResults.summary.foundBeiwenjin ? '是' : '否'}
                      </Badge>
                    </div>
                    <div>
                      <strong>最高相似度:</strong> {(testResults.summary.maxSimilarity * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-red-600">
                  测试失败: {testResults.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 详细测试步骤 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 数据获取测试 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  步骤1: 数据获取
                  <Badge variant={testResults.tests.data_fetch.success ? 'default' : 'destructive'}>
                    {testResults.tests.data_fetch.success ? '成功' : '失败'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div><strong>候选人:</strong> {testResults.tests.data_fetch.candidateName || 'N/A'}</div>
                </div>
              </CardContent>
            </Card>

            {/* 向量生成测试 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  步骤2: 向量生成
                  <Badge variant={testResults.tests.vector_generation.success ? 'default' : 'destructive'}>
                    {testResults.tests.vector_generation.success ? '成功' : '失败'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div><strong>查询:</strong> {testResults.tests.vector_generation.query}</div>
                  <div><strong>维度:</strong> {testResults.tests.vector_generation.dimensions}</div>
                </div>
              </CardContent>
            </Card>

            {/* 直接搜索测试 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  步骤3: 直接搜索
                  <Badge variant={testResults.tests.direct_search.success ? 'default' : 'destructive'}>
                    {testResults.tests.direct_search.success ? '成功' : '失败'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div><strong>总候选人:</strong> {testResults.tests.direct_search.totalCandidates}</div>
                  <div><strong>计算相似度:</strong> {testResults.tests.direct_search.resultsWithSimilarity}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 搜索结果 */}
          {testResults.results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>搜索结果 (按相似度排序)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testResults.results.map((result, idx) => (
                    <div key={result.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            {result.name}
                            {result.name === '贝文瑾' && (
                              <Badge variant="default">目标候选人</Badge>
                            )}
                          </h4>
                          <p className="text-sm text-gray-600">{result.current_title}</p>
                        </div>
                        <Badge variant="outline">
                          相似度: {(result.similarity * 100).toFixed(2)}%
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <div><strong>公司:</strong> {result.current_company}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
} 