'use client'

// Auth模板现在由全局模板处理，这里只需要透传
export default function AuthTemplate({
  children
}: {
  children: React.ReactNode
}) {
  console.log('🔐 Auth Template - delegating to global transition')
  
  return (
    <>
      {children}
    </>
  )
}