'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DualSearchFilters,
  DualSearchOptions,
  DualSearchResult,
  dualSearchTool
} from '@/lib/tools/dual-search'
import {
  BarChart3,
  Briefcase,
  RefreshCw,
  Search,
  Settings,
  Target,
  Users,
  Zap
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface DualSearchPanelProps {
  onResults?: (results: DualSearchResult[], type: 'candidates' | 'jobs') => void
}

export function DualSearchPanel({ onResults }: DualSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<'candidates' | 'jobs'>(
    'candidates'
  )
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<DualSearchResult[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [processingEmbeddings, setProcessingEmbeddings] = useState(false)

  // 搜索配置
  const [filters, setFilters] = useState<DualSearchFilters>({})
  const [options, setOptions] = useState<DualSearchOptions>({
    similarityThresholdSmall: 0.6,
    similarityThresholdLarge: 0.7,
    firstStageCount: 20,
    finalCount: 10,
    enableDualStage: true
  })

  // 加载统计数据
  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const statsData = await dualSearchTool.getDualSearchStats()
      setStats(statsData)
    } catch (error) {
      console.error('Failed to load stats:', error)
      toast.error('无法加载统计数据')
    } finally {
      setLoadingStats(false)
    }
  }

  // 执行搜索
  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('请输入搜索关键词')
      return
    }

    setLoading(true)
    try {
      let searchResults: DualSearchResult[] = []

      if (searchType === 'candidates') {
        searchResults = await dualSearchTool.searchCandidatesDualStage(
          query,
          filters,
          options
        )
      } else {
        searchResults = await dualSearchTool.searchJobsDualStage(
          query,
          filters,
          options
        )
      }

      setResults(searchResults)
      onResults?.(searchResults, searchType)

      toast.success(
        `找到 ${searchResults.length} 个${
          searchType === 'candidates' ? '候选人' : '职位'
        }`
      )
    } catch (error) {
      console.error('Search error:', error)
      toast.error('搜索失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 批量处理embeddings
  const handleBatchProcessEmbeddings = async (
    tableName: 'resumes' | 'jobs'
  ) => {
    setProcessingEmbeddings(true)
    try {
      const result = await dualSearchTool.batchProcessLargeEmbeddings(
        tableName,
        5
      )

      if (result.processed > 0) {
        toast.success(
          `成功处理 ${result.processed} 个${
            tableName === 'resumes' ? '简历' : '职位'
          }`
        )
        await loadStats() // 刷新统计
      } else {
        toast.info('没有需要处理的记录')
      }

      if (result.errors && result.errors.length > 0) {
        console.error('Processing errors:', result.errors)
      }
    } catch (error) {
      console.error('Batch processing error:', error)
      toast.error('批量处理失败')
    } finally {
      setProcessingEmbeddings(false)
    }
  }

  // 组件挂载时加载统计
  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Zap className="h-6 w-6" />
          双模型智能搜索
        </h2>
        <p className="text-muted-foreground">
          使用text-embedding-3-small +
          text-embedding-3-large两阶段查询，提供更精准的搜索结果
        </p>
      </div>

      <Tabs
        value={searchType}
        onValueChange={value => setSearchType(value as 'candidates' | 'jobs')}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="candidates" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            候选人搜索
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            职位搜索
          </TabsTrigger>
        </TabsList>

        {/* 搜索界面 */}
        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder={`输入${
                  searchType === 'candidates' ? '候选人' : '职位'
                }相关关键词...`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              搜索
            </Button>
          </div>

          {/* 搜索配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                搜索配置
              </CardTitle>
              <CardDescription>调整搜索参数以获得最佳结果</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Switch
                      checked={options.enableDualStage}
                      onCheckedChange={checked =>
                        setOptions({ ...options, enableDualStage: checked })
                      }
                    />
                    启用双阶段查询
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {options.enableDualStage
                      ? '使用两阶段查询获得更精准结果'
                      : '仅使用小模型进行快速搜索'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>最终结果数量: {options.finalCount}</Label>
                  <Slider
                    value={[options.finalCount || 10]}
                    onValueChange={([value]) =>
                      setOptions({ ...options, finalCount: value })
                    }
                    min={5}
                    max={50}
                    step={5}
                  />
                </div>
              </div>

              {options.enableDualStage && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      小模型阈值: {options.similarityThresholdSmall?.toFixed(2)}
                    </Label>
                    <Slider
                      value={[options.similarityThresholdSmall || 0.6]}
                      onValueChange={([value]) =>
                        setOptions({
                          ...options,
                          similarityThresholdSmall: value
                        })
                      }
                      min={0.3}
                      max={0.9}
                      step={0.05}
                    />
                    <p className="text-xs text-muted-foreground">
                      粗筛阶段的相似度阈值
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      大模型阈值: {options.similarityThresholdLarge?.toFixed(2)}
                    </Label>
                    <Slider
                      value={[options.similarityThresholdLarge || 0.7]}
                      onValueChange={([value]) =>
                        setOptions({
                          ...options,
                          similarityThresholdLarge: value
                        })
                      }
                      min={0.4}
                      max={0.95}
                      step={0.05}
                    />
                    <p className="text-xs text-muted-foreground">
                      精排阶段的相似度阈值
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 统计信息 */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Embedding 覆盖率统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.total_resumes}
                  </div>
                  <div className="text-sm text-muted-foreground">总简历数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.total_jobs}
                  </div>
                  <div className="text-sm text-muted-foreground">总职位数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.resumes_with_both_embeddings}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    双模型简历
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.jobs_with_both_embeddings}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    双模型职位
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    总体覆盖率
                  </span>
                  <span className="text-sm font-medium">
                    {stats.embedding_coverage_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stats.embedding_coverage_percentage}%` }}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBatchProcessEmbeddings('resumes')}
                  disabled={processingEmbeddings}
                >
                  {processingEmbeddings ? '处理中...' : '批量处理简历'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBatchProcessEmbeddings('jobs')}
                  disabled={processingEmbeddings}
                >
                  {processingEmbeddings ? '处理中...' : '批量处理职位'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadStats}
                  disabled={loadingStats}
                >
                  {loadingStats ? '刷新中...' : '刷新统计'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 搜索结果 */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                搜索结果 ({results.length})
              </CardTitle>
              <CardDescription>双模型查询结果，按综合评分排序</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div key={result.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold">
                          {result.name || result.title}
                        </h3>
                        {result.company && (
                          <p className="text-sm text-muted-foreground">
                            {result.company}
                          </p>
                        )}
                        {result.location && (
                          <p className="text-sm text-muted-foreground">
                            {result.location}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        {result.final_score && (
                          <Badge variant="secondary" className="text-xs">
                            综合: {(result.final_score * 100).toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">
                        小模型: {(result.similarity_small * 100).toFixed(1)}%
                      </Badge>
                      {result.similarity_large && (
                        <Badge variant="outline">
                          大模型: {(result.similarity_large * 100).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </Tabs>
    </div>
  )
}
 