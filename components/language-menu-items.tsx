'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Check } from 'lucide-react'
import { useLanguage } from '@/lib/context/language-context'

export function LanguageMenuItems() {
  const { language, setLanguage, t } = useLanguage()

  const handleLanguageChange = (newLanguage: 'en' | 'zh-CN') => {
    setLanguage(newLanguage)
  }

  return (
    <>
      <DropdownMenuItem onClick={() => handleLanguageChange('en')}>
        <div className="flex items-center justify-between w-full">
          <span>{t('language.english')}</span>
          {language === 'en' && <Check className="h-4 w-4" />}
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleLanguageChange('zh-CN')}>
        <div className="flex items-center justify-between w-full">
          <span>{t('language.chinese')}</span>
          {language === 'zh-CN' && <Check className="h-4 w-4" />}
        </div>
      </DropdownMenuItem>
    </>
  )
} 