'use client'

import { cn } from '@/lib/utils'
import Image from 'next/image'

function IconLogo({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      fill="currentColor"
      viewBox="0 0 256 256"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <circle cx="128" cy="128" r="120" fill="currentColor" opacity="0.1"></circle>
      <circle cx="128" cy="128" r="120" fill="none" stroke="currentColor" strokeWidth="8"></circle>
      <circle cx="102" cy="128" r="12" fill="currentColor"></circle>
      <circle cx="154" cy="128" r="12" fill="currentColor"></circle>
    </svg>
  )
}

// 新的Logo组件，使用实际的logo.svg文件
function Logo({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('h-20 w-20 flex items-center justify-center', className)}
      {...props}
    >
      <Image
        src="/logo.svg"
        alt="Neura Logo"
        width={80}
        height={80}
        className="h-full w-full object-contain"
      />
    </div>
  )
}

export { IconLogo, Logo }
