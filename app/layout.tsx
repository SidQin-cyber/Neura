import ArtifactRoot from '@/components/artifact/artifact-root'
import Header from '@/components/header'
import { SimpleSidebar } from '@/components/simple-sidebar'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'
import './globals.css'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans'
})

const title = 'Neura'
const description =
  'AI-powered recruitment platform with intelligent candidate matching and semantic search.'

export const metadata: Metadata = {
  metadataBase: new URL('https://morphic.sh'),
  title,
  description,
  openGraph: {
    title,
    description
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image',
    creator: '@miiura'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  let user = null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = await createClient()
    const {
      data: { user: supabaseUser }
    } = await supabase.auth.getUser()
    user = supabaseUser
  }

  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={cn(
          'h-full font-sans antialiased',
          fontSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {user ? (
            // Authenticated layout - show sidebar and header
            <div className="flex min-h-screen">
              <SimpleSidebar />
              <div className="flex flex-col flex-1 ml-12">
                <Header user={user} />
                <main className="flex flex-1">
                  <ArtifactRoot>{children}</ArtifactRoot>
                </main>
              </div>
            </div>
          ) : (
            // Unauthenticated layout - full screen without sidebar/header
            <div className="min-h-screen">
              {children}
            </div>
          )}
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
