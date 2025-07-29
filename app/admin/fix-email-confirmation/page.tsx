'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'
import { toast } from 'sonner'

export default function FixEmailConfirmationPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const handleFixEmailConfirmation = async () => {
    setIsLoading(true)
    setResults([])
    
    try {
      const response = await fetch('/api/admin/fix-email-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(data.message)
        setResults(data.results || [])
      } else {
        toast.error(data.error || '修复失败')
      }
    } catch (error) {
      console.error('Fix email confirmation error:', error)
      toast.error('修复失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>修复用户邮箱确认</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            此工具用于批量确认所有未验证邮箱的用户账户。
          </p>
          
          <Button 
            onClick={handleFixEmailConfirmation}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? '正在修复...' : '确认所有未验证邮箱'}
          </Button>
          
          {results.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-4">修复结果：</h3>
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded border ${
                      result.status === 'confirmed' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono">{result.email}</span>
                      <span className={`px-2 py-1 rounded text-sm ${
                        result.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {result.status === 'confirmed' ? '✅ 已确认' : '❌ 失败'}
                      </span>
                    </div>
                    {result.error && (
                      <p className="text-sm text-red-600 mt-1">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 