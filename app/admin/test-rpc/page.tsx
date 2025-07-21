'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface RPCTestResult {
  success: boolean
  tests: {
    rpc_test: {
      success: boolean
      error: string | null
      resultCount: number
      results: any[]
    }
    direct_query_test: {
      success: boolean
      error: string | null
      resultCount: number
      results: any[]
    }
  }
  debugInfo: {
    userId: string
    userEmail: string
  }
  error?: string
}

export default function TestRPCPage() {
  const [testResults, setTestResults] = useState<RPCTestResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runTest = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/debug/test-rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      const data = await response.json()
      setTestResults(data)
      console.log('🧪 RPC测试结果:', data)
    } catch (error) {
      console.error('RPC测试失败:', error)
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : '测试失败',
        tests: {
          rpc_test: { success: false, error: null, resultCount: 0, results: [] },
          direct_query_test: { success: false, error: null, resultCount: 0, results: [] }
        },
        debugInfo: { userId: '', userEmail: '' }
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">RPC函数测试</h1>
        <p className="text-gray-600">
          测试search_candidates_with_pgroonga RPC函数是否能正常工作
        </p>
      </div>

      <div className="mb-6">
        <Button 
          onClick={runTest} 
          disabled={isLoading}
          className="w-full md:w-auto"
        >
          {isLoading ? 'RPC测试中...' : '运行RPC函数测试'}
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
                  <div><strong>用户ID:</strong> {testResults.debugInfo.userId}</div>
                  <div><strong>用户邮箱:</strong> {testResults.debugInfo.userEmail}</div>
                </div>
              ) : (
                <div className="text-red-600">
                  测试失败: {testResults.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RPC函数测试结果 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>RPC函数测试 (search_candidates_with_pgroonga)</span>
                <div className="flex items-center gap-2">
                  <Badge variant={testResults.tests.rpc_test.success ? 'default' : 'destructive'}>
                    {testResults.tests.rpc_test.success ? '成功' : '失败'}
                  </Badge>
                  <Badge variant="outline">
                    {testResults.tests.rpc_test.resultCount} 个结果
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.tests.rpc_test.success ? (
                testResults.tests.rpc_test.results.length > 0 ? (
                  <div className="space-y-3">
                    {testResults.tests.rpc_test.results.map((result, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="font-semibold">{result.name}</div>
                        <div className="text-sm text-gray-600">{result.current_title}</div>
                        <div className="text-sm text-gray-600">{result.current_company}</div>
                        {result.similarity && (
                          <Badge variant="outline" className="mt-2">
                            相似度: {(result.similarity * 100).toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">RPC函数调用成功，但没有返回任何候选人</div>
                )
              ) : (
                <div className="text-red-600">
                  RPC错误: {testResults.tests.rpc_test.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 直接查询测试结果 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>直接查询测试 (不通过RPC)</span>
                <div className="flex items-center gap-2">
                  <Badge variant={testResults.tests.direct_query_test.success ? 'default' : 'destructive'}>
                    {testResults.tests.direct_query_test.success ? '成功' : '失败'}
                  </Badge>
                  <Badge variant="outline">
                    {testResults.tests.direct_query_test.resultCount} 个结果
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.tests.direct_query_test.success ? (
                testResults.tests.direct_query_test.results.length > 0 ? (
                  <div className="space-y-3">
                    {testResults.tests.direct_query_test.results.map((result, idx) => (
                      <div key={result.id} className="border rounded-lg p-4">
                        <div className="font-semibold">{result.name}</div>
                        <div className="text-sm text-gray-600">{result.current_title}</div>
                        <div className="text-sm text-gray-600">{result.current_company}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">直接查询成功，但没有找到任何候选人</div>
                )
              ) : (
                <div className="text-red-600">
                  直接查询错误: {testResults.tests.direct_query_test.error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 