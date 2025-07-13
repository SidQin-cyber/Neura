'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function FixSearchPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [diagnosis, setDiagnosis] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  
  const supabase = createClient()

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const diagnoseProblem = async () => {
    setIsLoading(true)
    setLogs([])
    setDiagnosis(null)
    
    try {
      addLog('🔧 开始诊断搜索问题...')
      
      // 1. 检查用户认证
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        addLog('❌ 用户未认证')
        return
      }
      
      addLog(`✅ 用户认证成功: ${user.email}`)
      
      // 2. 检查数据状态
      addLog('📊 检查数据状态...')
      
      const { data: userData, error: userError } = await supabase
        .from('resumes')
        .select('id, name, owner_id, embedding, status')
        .eq('owner_id', user.id)
      
      if (userError) {
        addLog(`❌ 查询用户数据失败: ${userError.message}`)
        return
      }
      
      const totalCount = userData?.length || 0
      const withEmbedding = userData?.filter(item => item.embedding !== null).length || 0
      const activeCount = userData?.filter(item => item.status === 'active').length || 0
      
      addLog(`📈 数据统计:`)
      addLog(`- 总记录数: ${totalCount}`)
      addLog(`- 有embedding的记录: ${withEmbedding}`)
      addLog(`- 活跃状态的记录: ${activeCount}`)
      
      // 3. 测试搜索功能
      addLog('🧪 测试搜索功能...')
      
      const testEmbedding = '[' + Array(1536).fill(0.1).join(',') + ']'
      
      const { data: testResult, error: testError } = await supabase.rpc('search_candidates_rpc', {
        query_embedding: testEmbedding,
        similarity_threshold: 0.0,
        match_count: 10,
        status_filter: 'active',
        user_id: user.id
      })
      
      if (testError) {
        addLog(`❌ 搜索测试失败: ${testError.message}`)
      } else {
        addLog(`✅ 搜索测试成功: 返回 ${testResult?.length || 0} 条记录`)
      }
      
      // 4. 生成诊断结果
      const diagnosisResult = {
        userId: user.id,
        userEmail: user.email,
        totalRecords: totalCount,
        recordsWithEmbedding: withEmbedding,
        activeRecords: activeCount,
        searchTestError: testError?.message || null,
        searchTestResults: testResult?.length || 0,
        userData: userData?.map(item => ({
          id: item.id,
          name: item.name,
          hasEmbedding: item.embedding !== null,
          status: item.status
        }))
      }
      
      setDiagnosis(diagnosisResult)
      
      // 5. 生成建议
      if (totalCount === 0) {
        addLog('💡 建议: 没有找到任何简历数据，请先上传简历文件')
      } else if (withEmbedding === 0) {
        addLog('💡 建议: 数据存在但没有embedding向量，需要重新上传简历文件')
      } else if (activeCount === 0) {
        addLog('💡 建议: 没有活跃状态的简历，请检查数据状态')
      } else if (testError) {
        addLog('💡 建议: 数据库函数签名不匹配，需要更新数据库函数')
      } else if (testResult?.length === 0) {
        addLog('💡 建议: 搜索函数正常但返回0结果，可能是相似度阈值过高')
      } else {
        addLog('🎉 搜索功能正常工作!')
      }
      
    } catch (error) {
      addLog(`💥 诊断过程中出错: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const fixEmbeddings = async () => {
    if (!diagnosis) return
    
    addLog('🔧 开始修复embedding问题...')
    
    try {
      // 这里可以添加重新生成embedding的逻辑
      // 或者提供重新上传文件的指导
      addLog('💡 请重新上传简历文件以生成embedding向量')
      
    } catch (error) {
      addLog(`❌ 修复失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>搜索功能诊断工具</CardTitle>
          <CardDescription>
            诊断并修复搜索不返回结果的问题
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={diagnoseProblem} 
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? '诊断中...' : '开始诊断'}
            </Button>
            
            {diagnosis && diagnosis.recordsWithEmbedding === 0 && (
              <Button 
                onClick={fixEmbeddings} 
                variant="outline"
                className="flex-1"
              >
                修复建议
              </Button>
            )}
          </div>
          
          {/* 日志显示 */}
          {logs.length > 0 && (
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">诊断日志:</h3>
              <div className="space-y-1 text-sm font-mono">
                {logs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 诊断结果 */}
          {diagnosis && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">诊断结果:</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>用户:</strong> {diagnosis.userEmail}
                </div>
                <div>
                  <strong>总记录数:</strong> {diagnosis.totalRecords}
                </div>
                <div>
                  <strong>有embedding的记录:</strong> {diagnosis.recordsWithEmbedding}
                </div>
                <div>
                  <strong>活跃记录:</strong> {diagnosis.activeRecords}
                </div>
                <div>
                  <strong>搜索测试结果:</strong> {diagnosis.searchTestResults}
                </div>
                <div>
                  <strong>搜索错误:</strong> {diagnosis.searchTestError || '无'}
                </div>
              </div>
              
              {diagnosis.userData && diagnosis.userData.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">用户数据详情:</h4>
                  <div className="space-y-2">
                    {diagnosis.userData.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center p-2 bg-white rounded">
                        <span>{item.name}</span>
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.hasEmbedding ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {item.hasEmbedding ? '有embedding' : '无embedding'}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 