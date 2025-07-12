'use client'

import { IconLogo } from '@/components/ui/icons'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import {
  BarChart3,
  Briefcase,
  Home,
  Search,
  Settings,
  Upload,
  Users
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigationItems = [
  {
    title: '概览',
    url: '/',
    icon: Home
  },
  {
    title: '智能搜索',
    url: '/search',
    icon: Search
  },
  {
    title: '候选人管理',
    url: '/candidates',
    icon: Users,
    children: [
      {
        title: '候选人列表',
        url: '/candidates',
        icon: Users
      },
      {
        title: '上传简历',
        url: '/candidates/upload',
        icon: Upload
      }
    ]
  },
  {
    title: '职位管理',
    url: '/jobs',
    icon: Briefcase,
    children: [
      {
        title: '职位列表',
        url: '/jobs',
        icon: Briefcase
      },
      {
        title: '创建职位',
        url: '/jobs/create',
        icon: Briefcase
      }
    ]
  },
  {
    title: '数据分析',
    url: '/analytics',
    icon: BarChart3
  },
  {
    title: '设置',
    url: '/settings',
    icon: Settings
  }
]

export function RecruitmentSidebar() {
  const pathname = usePathname()

  const isActive = (url: string) => {
    if (url === '/') return pathname === '/'
    return pathname.startsWith(url)
  }

  return (
    <Sidebar side="left" variant="sidebar" collapsible="none" className="w-14">
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Neura" size="sm">
              <Link href="/" className="flex items-center justify-center">
                <IconLogo className="size-5" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="flex flex-col px-2 py-4 h-full">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    size="sm"
                    className="h-10 w-10 p-0 flex items-center justify-center"
                  >
                    <Link href={item.url}>
                      <item.icon className="size-4" />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 快捷操作 */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="上传简历" size="sm" className="h-10 w-10 p-0 flex items-center justify-center">
                  <Link href="/candidates/upload">
                    <Upload className="size-4" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="创建职位" size="sm" className="h-10 w-10 p-0 flex items-center justify-center">
                  <Link href="/jobs/create">
                    <Briefcase className="size-4" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="智能搜索" size="sm" className="h-10 w-10 p-0 flex items-center justify-center">
                  <Link href="/search">
                    <Search className="size-4" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
 