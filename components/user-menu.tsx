'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Link2, LogOut, Languages } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ExternalLinkItems } from './external-link-items'
import { LanguageMenuItems } from './language-menu-items'
import { Button } from './ui/button'
import { useLanguage } from '@/lib/context/language-context'

interface UserMenuProps {
  user: User
  variant?: 'default' | 'sidebar'
}

export default function UserMenu({ user, variant = 'default' }: UserMenuProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const userName =
    user.user_metadata?.full_name || user.user_metadata?.name || 'User'
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture

  const getInitials = (name: string, email: string | undefined) => {
    if (name && name !== 'User') {
      const names = name.split(' ')
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.split('@')[0].substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const buttonSize = variant === 'sidebar' ? 'h-8 w-8' : 'h-6 w-6'
  const avatarSize = variant === 'sidebar' ? 'h-8 w-8' : 'h-6 w-6'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={`relative ${buttonSize} rounded-md hover:bg-accent hover:text-accent-foreground transition-colors`}>
          <Avatar className={avatarSize}>
            <AvatarImage src={avatarUrl} alt={userName} />
            <AvatarFallback>{getInitials(userName, user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">
              {userName}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="mr-2 h-4 w-4" />
            <span>{t('menu.language')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <LanguageMenuItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Link2 className="mr-2 h-4 w-4" />
            <span>{t('menu.links')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ExternalLinkItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('menu.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
