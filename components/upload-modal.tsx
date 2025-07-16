'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, Users, Briefcase, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/context/language-context'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
}

type UploadType = 'candidates' | 'jobs'

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { t } = useLanguage()
  const [uploadType, setUploadType] = useState<UploadType>('candidates')
  const [jsonContent, setJsonContent] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success'>('idle')
  const [dataSize, setDataSize] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentProgressRef = useRef(0) // 追踪实际进度值

  // 清理定时器
  useEffect(() => {
    return () => {
      clearProgressAnimation()
    }
  }, [])

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

  // 清理进度动画
  const clearProgressAnimation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  // 平滑进度动画 - 只能向前，不能回退
  const animateProgress = (targetProgress: number, duration: number = 1000) => {
    clearProgressAnimation()
    
    // 确保目标进度不能小于当前进度（防止回退）
    const safeTargetProgress = Math.max(targetProgress, currentProgressRef.current)
    const startProgress = currentProgressRef.current
    const progressDiff = safeTargetProgress - startProgress
    
    // 如果没有进度差异，直接设置目标值
    if (progressDiff <= 0) {
      setUploadProgress(safeTargetProgress)
      currentProgressRef.current = safeTargetProgress
      return
    }
    
    const stepTime = 30 // 更频繁的更新，更平滑
    const steps = duration / stepTime
    const stepProgress = progressDiff / steps

    let currentStep = 0
    
    progressIntervalRef.current = setInterval(() => {
      currentStep++
      const newProgress = Math.min(startProgress + (stepProgress * currentStep), safeTargetProgress)
      const roundedProgress = Math.round(newProgress)
      
      setUploadProgress(roundedProgress)
      currentProgressRef.current = newProgress
      
      if (currentStep >= steps || newProgress >= safeTargetProgress) {
        clearProgressAnimation()
        setUploadProgress(safeTargetProgress)
        currentProgressRef.current = safeTargetProgress
      }
    }, stepTime)
  }

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
      setUploadStatus('parsing')
      
      // 重置进度并开始平滑上升
      currentProgressRef.current = 0
      setUploadProgress(0)
      
      // 立即开始到5%，给用户即时反馈
      animateProgress(5, 200)
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // 解析阶段：5% → 30%
      const data = validateAndParseJSON(jsonContent)
      setDataSize(data.length)
      animateProgress(30, 1200)
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      // 上传准备阶段：30% → 45%
      setUploadStatus('uploading')
      animateProgress(45, 600)
      await new Promise(resolve => setTimeout(resolve, 600))
      
      const endpoint = uploadType === 'candidates' ? '/api/upload/candidates' : '/api/upload/jobs'
      
      // 网络传输阶段：45% → 80%
      animateProgress(80, 1800)
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ data }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `上传失败 (${response.status})`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      // 服务器处理：80% → 95%
      animateProgress(95, 600)
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // 完成阶段：95% → 100%
      animateProgress(100, 400)
      await new Promise(resolve => setTimeout(resolve, 400))
      
      // 成功时立即清空输入框，避免用户看到文字突然消失
      setUploadStatus('success')
      setJsonContent('') // 立即清空输入框
      setDataSize(0) // 立即清空数据计数
      toast.success(`成功上传 ${result.count} 条${uploadType === 'candidates' ? '人选' : '职位'}数据`)
      
      // 短暂显示成功状态后重置进度条
      setTimeout(() => {
        setUploadProgress(0)
        setUploadStatus('idle')
        currentProgressRef.current = 0
        // 不调用 onClose() - 保持模态框开启
      }, 800)
      
    } catch (error) {
      clearProgressAnimation()
      setUploadProgress(0)
      setUploadStatus('idle')
      setDataSize(0)
      currentProgressRef.current = 0
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClear = () => {
    clearProgressAnimation()
    setJsonContent('')
    setUploadProgress(0)
    setUploadStatus('idle')
    setDataSize(0)
    currentProgressRef.current = 0
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {t('upload.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* 上传类型切换 */}
          <div className="flex gap-2">
            <Button
              variant={uploadType === 'candidates' ? 'default' : 'outline'}
              onClick={() => setUploadType('candidates')}
              className="flex-1"
            >
              <Users className="w-4 h-4 mr-2" />
              {t('upload.candidates')}
            </Button>
            <Button
              variant={uploadType === 'jobs' ? 'default' : 'outline'}
              onClick={() => setUploadType('jobs')}
              className="flex-1"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              {t('upload.jobs')}
            </Button>
          </div>

          {/* 文件拖拽区域 */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-base font-medium mb-1">
              {t('upload.dragText')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('upload.supportText')}
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
                {t('upload.pasteText')}
              </label>
              {dataSize > 0 && (
                <span className="text-xs text-muted-foreground">
                  {dataSize} 条记录
                </span>
              )}
            </div>
            <div className="relative">
              <Textarea
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                placeholder={t(uploadType === 'candidates' ? 'upload.placeholder.candidates' : 'upload.placeholder.jobs')}
                className="min-h-[240px] font-mono text-sm border-2 border-muted-foreground/20 hover:border-primary/40 focus:border-primary focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 ease-in-out resize-none"
                disabled={isUploading}
              />
              {isUploading && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-md transition-opacity duration-300">
                  <div className="text-center space-y-3">
                    <div className="relative">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
                      {uploadStatus === 'success' && (
                        <CheckCircle className="w-10 h-10 mx-auto text-green-500 absolute inset-0" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {uploadStatus === 'parsing' && '正在解析JSON数据...'}
                        {uploadStatus === 'uploading' && '正在上传到服务器...'}
                        {uploadStatus === 'success' && '上传完成!'}
                      </p>
                      {dataSize > 0 && uploadStatus !== 'success' && (
                        <p className="text-xs text-muted-foreground">
                          处理 {dataSize} 条记录
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 进度条区域 - 仅在上传时显示 */}
            {isUploading && (
              <div className="space-y-2">
                <Progress 
                  value={uploadProgress} 
                  gradient={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 - 固定在底部 */}
        <div className="flex gap-2 pt-3 border-t mt-2">
          <Button 
            variant="outline" 
            onClick={handleClear} 
            className="flex-1"
            disabled={isUploading}
          >
            {t('upload.clear')}
          </Button>
          <Button 
            onClick={onClose} 
            variant="outline" 
            className="flex-1"
            disabled={isUploading}
          >
            {t('upload.cancel')}
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={isUploading || !jsonContent.trim()}
            className="flex-1"
          >
            {isUploading ? (uploadStatus === 'success' ? '完成' : '处理中...') : t('upload.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 