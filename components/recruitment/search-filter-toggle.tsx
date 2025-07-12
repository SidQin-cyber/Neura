'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import { SearchFilters } from '@/lib/types/recruitment'
import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import { Filter, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface SearchFilterToggleProps {
  searchType: 'candidate' | 'job'
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
}

export function SearchFilterToggle({
  searchType,
  filters,
  onFiltersChange
}: SearchFilterToggleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters)

  useEffect(() => {
    const savedFilterState = getCookie('recruitment-filters-enabled')
    if (savedFilterState !== null) {
      setShowFilters(savedFilterState === 'true')
    }
  }, [])

  const handleFilterToggle = (pressed: boolean) => {
    setShowFilters(pressed)
    setCookie('recruitment-filters-enabled', pressed.toString())
    
    if (!pressed) {
      // 清空筛选条件
      const emptyFilters: SearchFilters = {}
      setLocalFilters(emptyFilters)
      onFiltersChange(emptyFilters)
    }
  }

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleRemoveFilter = (key: keyof SearchFilters) => {
    const newFilters = { ...localFilters }
    delete newFilters[key]
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const clearAllFilters = () => {
    const emptyFilters: SearchFilters = {}
    setLocalFilters(emptyFilters)
    onFiltersChange(emptyFilters)
  }

  const getActiveFiltersCount = () => {
    return Object.keys(localFilters).filter(key => {
      const value = localFilters[key as keyof SearchFilters]
      return value !== undefined && value !== null && value !== ''
    }).length
  }

  const activeFiltersCount = getActiveFiltersCount()

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-1">
          <Toggle
            aria-label="Toggle advanced filters"
            pressed={showFilters}
            onPressedChange={handleFilterToggle}
            variant="outline"
            className={cn(
              'gap-1 px-3 border border-input text-muted-foreground bg-background',
              'data-[state=on]:bg-accent-blue',
              'data-[state=on]:text-accent-blue-foreground',
              'data-[state=on]:border-accent-blue-border',
              'hover:bg-accent hover:text-accent-foreground rounded-full'
            )}
          >
            <Filter className="size-4" />
            <span className="text-xs">筛选</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
                {activeFiltersCount}
              </Badge>
            )}
          </Toggle>
          {showFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 h-8 w-8 rounded-full"
            >
              <Filter className="size-3" />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      
      {showFilters && (
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">高级筛选</h4>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-xs"
                >
                  清空全部
                </Button>
              )}
            </div>
            
            <Separator />
            
            {/* 地点筛选 */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">
                地点
              </Label>
              <div className="flex gap-2">
                <Input
                  id="location"
                  placeholder="如：北京、上海、深圳"
                  value={localFilters.location || ''}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="flex-1"
                />
                {localFilters.location && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFilter('location')}
                    className="px-2"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* 经验筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                工作经验 {localFilters.experience_min || localFilters.experience_max ? 
                  `(${localFilters.experience_min || 0}-${localFilters.experience_max || 20}年)` : 
                  ''}
              </Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="最低年限"
                    value={localFilters.experience_min || ''}
                    onChange={(e) => handleFilterChange('experience_min', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="最高年限"
                    value={localFilters.experience_max || ''}
                    onChange={(e) => handleFilterChange('experience_max', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* 薪资筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {searchType === 'candidate' ? '期望薪资' : '职位薪资'} 
                {localFilters.salary_min || localFilters.salary_max ? 
                  ` (${localFilters.salary_min || 0}-${localFilters.salary_max || 100}K)` : 
                  ''}
              </Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="最低薪资(K)"
                    value={localFilters.salary_min || ''}
                    onChange={(e) => handleFilterChange('salary_min', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="最高薪资(K)"
                    value={localFilters.salary_max || ''}
                    onChange={(e) => handleFilterChange('salary_max', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* 技能筛选 */}
            <div className="space-y-2">
              <Label htmlFor="skills" className="text-sm font-medium">
                技能要求
              </Label>
              <div className="flex gap-2">
                <Input
                  id="skills"
                  placeholder="如：JavaScript, React, Node.js"
                  value={localFilters.skills?.join(', ') || ''}
                  onChange={(e) => handleFilterChange('skills', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                  className="flex-1"
                />
                {localFilters.skills && localFilters.skills.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFilter('skills')}
                    className="px-2"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* 工作类型筛选 (仅职位搜索) */}
            {searchType === 'job' && (
              <div className="space-y-2">
                <Label htmlFor="employment_type" className="text-sm font-medium">
                  工作类型
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="employment_type"
                    placeholder="如：全职、兼职、远程"
                    value={localFilters.employment_type || ''}
                    onChange={(e) => handleFilterChange('employment_type', e.target.value)}
                    className="flex-1"
                  />
                  {localFilters.employment_type && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFilter('employment_type')}
                      className="px-2"
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 活跃筛选条件显示 */}
            {activeFiltersCount > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-blue-600">
                  当前筛选条件
                </Label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(localFilters).map(([key, value]) => {
                    if (!value) return null
                    const displayValue = Array.isArray(value) ? value.join(', ') : value.toString()
                    return (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="text-xs flex items-center gap-1"
                      >
                        {key}: {displayValue}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFilter(key as keyof SearchFilters)}
                          className="p-0 h-3 w-3"
                        >
                          <X className="size-2" />
                        </Button>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      )}
    </Popover>
  )
} 