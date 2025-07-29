import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">注册成功！</CardTitle>
              <CardDescription>现在可以直接登录</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                您已成功注册账户，现在可以直接使用您的用户名和密码登录。
              </p>
              <a 
                href="/login" 
                className="mt-4 inline-block w-full text-center bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                前往登录
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
