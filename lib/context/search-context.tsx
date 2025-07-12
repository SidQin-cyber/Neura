'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { SearchMode } from '@/components/model-selector'
import { FilterState } from '@/components/compact-filter-panel'
import { getCookie, setCookie } from '@/lib/utils/cookies'

interface SearchContextType {
  searchMode: SearchMode
  setSearchMode: (mode: SearchMode) => void
  filters: FilterState
  setFilters: (filters: FilterState) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  resetSearchState: () => void
}

// 假设这些类型已经存在，如果不存在需要先定义
interface CandidateSearchResult {
  id: string
  name: string
  title: string
  experience: string
  skills: string[]
  location: string
  avatar_url?: string
  phone?: string
  email?: string
  match_score?: number
  created_at?: string
}

interface JobSearchResult {
  id: string
  title: string
  company: string
  location: string
  salary_range: string
  experience_required: string
  skills_required: string[]
  description: string
  match_score?: number
  created_at?: string
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

interface SearchProviderProps {
  children: ReactNode
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [searchMode, setSearchModeState] = useState<SearchMode>('candidates')
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    location: '',
    salaryMin: '',
    salaryMax: '',
    education: 'none',
    specialReq: ''
  })

  useEffect(() => {
    const savedMode = getCookie('searchMode') as SearchMode
    if (savedMode && (savedMode === 'candidates' || savedMode === 'jobs')) {
      setSearchModeState(savedMode)
    }
  }, [])

  const setSearchMode = (mode: SearchMode) => {
    setSearchModeState(mode)
    setCookie('searchMode', mode)
  }

  const resetSearchState = () => {
    setSearchModeState('candidates')
    setFilters({
      location: '',
      salaryMin: '',
      salaryMax: '',
      education: 'none',
      specialReq: ''
    })
    setIsLoading(false)
    setCookie('searchMode', 'candidates')
  }

  const value: SearchContextType = {
    searchMode,
    setSearchMode,
    filters,
    setFilters,
    isLoading,
    setIsLoading,
    resetSearchState
  }

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}

// 导出类型以供其他组件使用
export type { CandidateSearchResult, JobSearchResult } 