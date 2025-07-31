'use client'

// Login模板现在由全局模板处理，这里只需要透传
export default function LoginTemplate({
  children
}: {
  children: React.ReactNode
}) {
  console.log('🔑 Login Template - delegating to global transition')
  
  return (
    <>
      {children}
    </>
  )
}