'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Language, getTranslation, TranslationKey } from '@/lib/i18n'

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>('zh-CN')

  // 从localStorage读取保存的语言设置
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'zh-CN')) {
      setLanguageState(savedLanguage)
    }
  }, [])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    localStorage.setItem('language', newLanguage)
  }

  const t = (key: TranslationKey, params?: Record<string, string | number>) => {
    return getTranslation(language, key, params)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
} 