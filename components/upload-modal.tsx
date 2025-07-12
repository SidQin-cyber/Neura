'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Upload, FileText, Users, Briefcase } from 'lucide-react'
import { toast } from 'sonner'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
}

type UploadType = 'candidates' | 'jobs'

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [uploadType, setUploadType] = useState<UploadType>('candidates')
  const [jsonContent, setJsonContent] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const jsonFile = files.find(file => file.type === 'application/json' || file.name.endsWith('.json'))
    
    if (jsonFile) {
      try {
        const content = await jsonFile.text()
        setJsonContent(content)
        toast.success('文件读取成功')
      } catch (error) {
        toast.error('文件读取失败')
      }
    } else {
      toast.error('请上传JSON文件')
    }
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        try {
          const content = await file.text()
          setJsonContent(content)
          toast.success('文件读取成功')
        } catch (error) {
          toast.error('文件读取失败')
        }
      } else {
        toast.error('请选择JSON文件')
      }
    }
  }, [])

  const validateAndParseJSON = (content: string) => {
    try {
      const parsed = JSON.parse(content)
      
      // 如果是单个对象，自动转换为数组
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return [parsed]
      }
      
      // 如果是数组，直接返回
      if (Array.isArray(parsed)) {
        return parsed
      }
      
      throw new Error('JSON数据必须是对象或数组格式')
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('JSON格式无效：语法错误')
      }
      throw error
    }
  }

  const handleUpload = async () => {
    if (!jsonContent.trim()) {
      toast.error('请输入或上传JSON数据')
      return
    }

    try {
      setIsUploading(true)
      
      // 验证JSON格式
      const data = validateAndParseJSON(jsonContent)
      
      // 上传到对应的API
      const endpoint = uploadType === 'candidates' ? '/api/upload/candidates' : '/api/upload/jobs'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 包含认证cookie
        body: JSON.stringify({ data }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `上传失败 (${response.status})`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      toast.success(`成功上传 ${result.count} 条${uploadType === 'candidates' ? '人选' : '职位'}数据`)
      
      // 清空内容并关闭模态框
      setJsonContent('')
      onClose()
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClear = () => {
    setJsonContent('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            上传数据
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* 上传类型切换 */}
          <div className="flex gap-2">
            <Button
              variant={uploadType === 'candidates' ? 'default' : 'outline'}
              onClick={() => setUploadType('candidates')}
              className="flex-1"
            >
              <Users className="w-4 h-4 mr-2" />
              上传人选JSON
            </Button>
            <Button
              variant={uploadType === 'jobs' ? 'default' : 'outline'}
              onClick={() => setUploadType('jobs')}
              className="flex-1"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              上传职位JSON
            </Button>
          </div>

          {/* 文件拖拽区域 */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              拖拽JSON文件到此处，或点击选择文件
            </p>
            <p className="text-sm text-muted-foreground">
              支持.json格式文件（单个对象或数组）
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* JSON输入框 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                或直接粘贴JSON数据：
              </label>
              <div className="flex gap-2">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    const exampleUrl = uploadType === 'candidates' 
                      ? '/examples/single-candidate-example.json'
                      : '/examples/single-job-example.json'
                    window.open(exampleUrl, '_blank')
                  }}
                >
                  单个对象示例
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    const exampleUrl = uploadType === 'candidates' 
                      ? '/examples/candidates-example.json'
                      : '/examples/jobs-example.json'
                    window.open(exampleUrl, '_blank')
                  }}
                >
                  数组格式示例
                </Button>
              </div>
            </div>
            <Textarea
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              placeholder={`请输入${uploadType === 'candidates' ? '人选' : '职位'}JSON数据（支持单个对象或数组）...`}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClear} className="flex-1">
              清空
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1">
              取消
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={isUploading || !jsonContent.trim()}
              className="flex-1"
            >
              {isUploading ? '上传中...' : '确认上传'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 