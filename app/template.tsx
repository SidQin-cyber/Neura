'use client'

import { GlobalPageTransition } from '@/components/global-page-transition'

export default function RootTemplate({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <GlobalPageTransition>
      {children}
    </GlobalPageTransition>
  )
}