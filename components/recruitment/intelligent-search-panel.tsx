'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SearchFilters } from '@/lib/types/recruitment'
import {
  Briefcase,
  Filter,
  Loader2,
  Search,
  Settings,
  Sparkles,
  Users,
  X
} from 'lucide-react'
import { useState } from 'react'
import Textarea from 'react-textarea-autosize'

interface SearchPanelProps {
  onSearch: (query: string, filters?: SearchFilters) => void
  searchType: 'candidate' | 'job'
  onSearchTypeChange: (type: 'candidate' | 'job') => void
  isLoading?: boolean
  placeholder?: string
  suggestions?: string[]
}

export function IntelligentSearchPanel({
  onSearch,
  searchType,
  onSearchTypeChange,
  isLoading = false,
  placeholder,
  suggestions = []
}: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim(), filters)
    }
  }

  const handleClear = () => {
    setQuery('')
    setFilters({})
  }

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const getPlaceholderText = () => {
    if (placeholder) return placeholder

    if (searchType === 'candidate') {
      return '描述你要找的候选人，例如：5年Java开发经验，熟悉Spring框架，在北京...'
    } else {
      return '描述你要匹配的职位，例如：高级前端工程师，React开发，15-25K...'
    }
  }

  const getSuggestions = () => {
    if (suggestions.length > 0) return suggestions

    if (searchType === 'candidate') {
      return [
        '高级Java开发工程师，3-5年经验',
        '前端开发，熟悉React和Vue',
        '产品经理，有B端产品经验',
        '数据分析师，SQL和Python'
      ]
    } else {
      return [
        '全栈开发工程师，创业公司',
        '高级UI设计师，电商行业',
        '技术总监，管理经验',
        '运营专员，社交媒体运营'
      ]
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* 搜索类型切换 */}
      <div className="flex items-center justify-center gap-2 p-1 bg-muted rounded-lg">
        <Button
          variant={searchType === 'candidate' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onSearchTypeChange('candidate')}
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          候选人搜索
        </Button>
        <Button
          variant={searchType === 'job' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onSearchTypeChange('job')}
          className="flex items-center gap-2"
        >
          <Briefcase className="h-4 w-4" />
          职位搜索
        </Button>
      </div>

      {/* 主搜索面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            智能搜索
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 搜索输入框 */}
            <div className="relative">
              <Textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={getPlaceholderText()}
                className="min-h-[100px] w-full resize-none border-2 border-border focus:border-primary rounded-lg px-4 py-3 text-sm"
                maxRows={6}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="h-8 w-8 p-0"
                >
                  <Filter className="h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!query.trim() || isLoading}
                  className="h-8 px-3"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* 搜索建议 */}
            {query.length === 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">搜索建议</Label>
                <div className="flex flex-wrap gap-2">
                  {getSuggestions().map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setQuery(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 快速操作 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="advanced-filters"
                    checked={showFilters}
                    onCheckedChange={setShowFilters}
                  />
                  <Label htmlFor="advanced-filters" className="text-sm">
                    高级筛选
                  </Label>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                清空
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 高级筛选面板 */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              高级筛选
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 地点筛选 */}
              <div className="space-y-2">
                <Label htmlFor="location">地点</Label>
                <input
                  id="location"
                  type="text"
                  value={filters.location || ''}
                  onChange={e => handleFilterChange('location', e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm"
                  placeholder="例如：北京，上海"
                />
              </div>

              {/* 经验筛选 */}
              <div className="space-y-2">
                <Label>工作经验</Label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.experience_min || ''}
                    onChange={e =>
                      handleFilterChange(
                        'experience_min',
                        parseInt(e.target.value) || undefined
                      )
                    }
                    className="w-full h-10 px-3 border border-border rounded-md text-sm"
                    placeholder="最少"
                  />
                  <input
                    type="number"
                    value={filters.experience_max || ''}
                    onChange={e =>
                      handleFilterChange(
                        'experience_max',
                        parseInt(e.target.value) || undefined
                      )
                    }
                    className="w-full h-10 px-3 border border-border rounded-md text-sm"
                    placeholder="最多"
                  />
                </div>
              </div>

              {/* 薪资筛选 */}
              {searchType === 'candidate' && (
                <div className="space-y-2">
                  <Label>期望薪资 (千元)</Label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={filters.salary_min || ''}
                      onChange={e =>
                        handleFilterChange(
                          'salary_min',
                          parseInt(e.target.value) * 1000 || undefined
                        )
                      }
                      className="w-full h-10 px-3 border border-border rounded-md text-sm"
                      placeholder="最低"
                    />
                    <input
                      type="number"
                      value={filters.salary_max || ''}
                      onChange={e =>
                        handleFilterChange(
                          'salary_max',
                          parseInt(e.target.value) * 1000 || undefined
                        )
                      }
                      className="w-full h-10 px-3 border border-border rounded-md text-sm"
                      placeholder="最高"
                    />
                  </div>
                </div>
              )}

              {/* 工作类型筛选 */}
              {searchType === 'job' && (
                <div className="space-y-2">
                  <Label htmlFor="employment-type">工作类型</Label>
                  <select
                    id="employment-type"
                    value={filters.employment_type || ''}
                    onChange={e =>
                      handleFilterChange('employment_type', e.target.value)
                    }
                    className="w-full h-10 px-3 border border-border rounded-md text-sm"
                  >
                    <option value="">全部</option>
                    <option value="full_time">全职</option>
                    <option value="part_time">兼职</option>
                    <option value="contract">合同工</option>
                    <option value="internship">实习</option>
                    <option value="remote">远程</option>
                  </select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
