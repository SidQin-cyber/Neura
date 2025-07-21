'use client'

import { getCookie, setCookie } from '@/lib/utils/cookies'
import { Check, ChevronsUpDown, Users, Briefcase } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useLanguage } from '@/lib/context/language-context'
import { Button } from './ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

export type SearchMode = 'candidates' | 'jobs'

interface SearchModeOption {
  id: SearchMode
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

interface ModeSwitcherProps {
  onModeChange?: (mode: SearchMode) => void
}

export function ModeSwitcher({ onModeChange }: ModeSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<SearchMode>('candidates')
  const { t } = useLanguage()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const searchModes: SearchModeOption[] = [
    {
      id: 'candidates',
      label: t('mode.candidates'),
      description: '',
      icon: Users
    },
    {
      id: 'jobs',
      label: t('mode.jobs'),
      description: '',
      icon: Briefcase
    }
  ]

  useEffect(() => {
    const savedMode = getCookie('searchMode') as SearchMode
    if (savedMode && (savedMode === 'candidates' || savedMode === 'jobs')) {
      setMode(savedMode)
      // 确保同步调用onModeChange，以防父组件需要同步状态
      onModeChange?.(savedMode)
    }
  }, [])

  // 新增：监听onModeChange变化，在组件外部状态变化时同步本地状态
  useEffect(() => {
    const savedMode = getCookie('searchMode') as SearchMode
    if (savedMode && savedMode !== mode) {
      setMode(savedMode)
    }
  }, [onModeChange, mode])

  const handleModeSelect = (selectedMode: SearchMode) => {
    setMode(selectedMode)
    setCookie('searchMode', selectedMode)
    setOpen(false)
    onModeChange?.(selectedMode)
    
    // 立即移除焦点，避免保持激活状态
    setTimeout(() => {
      buttonRef.current?.blur()
    }, 50)
  }

  const currentMode = searchModes.find(m => m.id === mode)
  const CurrentIcon = currentMode?.icon || Users

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="h-auto px-3 py-1.5 w-[120px] bg-transparent border-none rounded-full text-base font-medium transition-all duration-200 hover:bg-gray-100/80 active:bg-gray-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300/50 shadow-none"
        >
          <div className="flex items-center justify-center space-x-2 w-full">
            <CurrentIcon className="h-4 w-4" />
            <span className="text-sm font-medium">
              {currentMode?.label || '寻找人选'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1 z-[200]" align="start">
        <Command className="rounded-xl">
          <CommandList>
            <CommandEmpty>No mode found.</CommandEmpty>
            <CommandGroup className="p-1">
              {searchModes.map(modeOption => {
                const Icon = modeOption.icon
                const isSelected = mode === modeOption.id
                  return (
                    <CommandItem
                    key={modeOption.id}
                    value={modeOption.id}
                    onSelect={() => handleModeSelect(modeOption.id)}
                    className={`flex justify-between px-3 py-1.5 mx-1 my-0.5 rounded-full hover:bg-gray-50 transition-all duration-200 cursor-pointer ${
                      isSelected 
                        ? 'bg-gray-100 border border-gray-200 shadow-sm' 
                        : 'border border-transparent'
                    }`}
                    >
                    <div className="flex items-center space-x-2">
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-gray-700' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                        {modeOption.label}
                      </span>
                    </div>
                      <Check
                        className={`h-4 w-4 text-gray-600 ${
                        isSelected ? 'opacity-100' : 'opacity-0'
                        } transition-opacity duration-200`}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
