'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Filter } from 'lucide-react'
import { useState } from 'react'

export interface FilterState {
  location: string
  salaryMin: string
  salaryMax: string
  education: string
  specialReq: string
}

interface CompactFilterPanelProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  searchMode?: 'candidates' | 'jobs'
}

const educationOptions = [
  { value: 'none', label: '不限' },
  { value: 'college', label: '大专' },
  { value: 'bachelor', label: '本科' },
  { value: 'master', label: '硕士' },
  { value: 'phd', label: '博士' }
]

export function CompactFilterPanel({ 
  filters, 
  onFiltersChange, 
  searchMode = 'candidates' 
}: CompactFilterPanelProps) {
  const [open, setOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<FilterState>(filters)

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleApply = () => {
    onFiltersChange(localFilters)
    setOpen(false)
  }

  const handleReset = () => {
    const resetFilters: FilterState = {
      location: '',
      salaryMin: '',
      salaryMax: '',
      education: 'none',
      specialReq: ''
    }
    setLocalFilters(resetFilters)
    onFiltersChange(resetFilters)
  }

  const getSalaryLabel = () => {
    return searchMode === 'candidates' 
      ? '薪酬预期 (月薪, K)' 
      : '薪资范围 (月薪, K)'
  }

  const getSpecialReqPlaceholder = () => {
    return searchMode === 'candidates'
      ? '例如：要求985/211背景、有海外工作经验、需要立即到岗等...'
      : '例如：提供五险一金、远程办公、弹性工作时间等...'
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-auto px-3 py-2 bg-transparent border-none rounded-full text-xs font-medium transition-all duration-200 hover:bg-gray-100/80 active:bg-gray-200/80 focus:bg-gray-100/80 focus:outline-none focus:ring-2 focus:ring-gray-300/50 shadow-none gap-2"
        >
          <Filter className="h-4 w-4" />
          高级筛选
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          {/* 地点和学历 - 紧凑布局 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-xs font-medium text-gray-600">
                地点
              </Label>
              <Input
                id="location"
                value={localFilters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">
                学历
              </Label>
              <Select
                value={localFilters.education}
                onValueChange={(value) => handleFilterChange('education', value)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="不限" />
                </SelectTrigger>
                <SelectContent>
                  {educationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 薪资范围 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">
              {getSalaryLabel()}
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                value={localFilters.salaryMin}
                onChange={(e) => handleFilterChange('salaryMin', e.target.value)}
                type="number"
                className="h-8 text-sm flex-1"
              />
              <span className="text-xs text-muted-foreground">-</span>
              <Input
                value={localFilters.salaryMax}
                onChange={(e) => handleFilterChange('salaryMax', e.target.value)}
                type="number"
                className="h-8 text-sm flex-1"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              className="flex-1 h-8 text-xs"
            >
              重置
            </Button>
            <Button 
              size="sm" 
              onClick={handleApply}
              className="flex-1 h-8 text-xs"
            >
              应用筛选
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 