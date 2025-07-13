'use client'

import { getCookie, setCookie } from '@/lib/utils/cookies'
import { Check, ChevronsUpDown, Users, Briefcase } from 'lucide-react'
import { useEffect, useState } from 'react'
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
    }
  }, [])

  const handleModeSelect = (selectedMode: SearchMode) => {
    setMode(selectedMode)
    setCookie('searchMode', selectedMode)
    setOpen(false)
    onModeChange?.(selectedMode)
  }

  const currentMode = searchModes.find(m => m.id === mode)
  const CurrentIcon = currentMode?.icon || Users

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="h-auto px-3 py-2 bg-transparent border-none rounded-full text-base font-medium transition-all duration-200 hover:bg-gray-100/80 active:bg-gray-200/80 focus:bg-gray-100/80 focus:outline-none focus:ring-2 focus:ring-gray-300/50 shadow-none"
        >
          <div className="flex items-center space-x-2">
            <CurrentIcon className="h-4 w-4" />
            <span className="text-sm font-medium">
              {currentMode?.label || '寻找候选人'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command className="rounded-2xl">
          <CommandList>
            <CommandEmpty>No mode found.</CommandEmpty>
            <CommandGroup heading={t('mode.searchMode')} className="p-2">
              {searchModes.map(modeOption => {
                const Icon = modeOption.icon
                  return (
                    <CommandItem
                    key={modeOption.id}
                    value={modeOption.id}
                    onSelect={() => handleModeSelect(modeOption.id)}
                    className="flex justify-between p-3 mx-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                    <div className="flex items-center space-x-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {modeOption.label}
                      </span>
                    </div>
                      <Check
                        className={`h-4 w-4 ${
                        mode === modeOption.id ? 'opacity-100' : 'opacity-0'
                        }`}
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
