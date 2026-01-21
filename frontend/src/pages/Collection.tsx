import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analysisApi } from '../services/api'
import { CheckCircle, XCircle, Loader, ArrowRight, Trash2, Play, Users, AlertTriangle, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ExtractedTiger {
  tiger_id: string
  display_name: string
  source: string
}

interface CollectionJob {
  id: string
  url: string
  videoId: string | null
  status: 'pending' | 'collecting' | 'extracting' | 'selecting' | 'analyzing' | 'completed' | 'error'
  message: string
  collectedComments?: number
  extractedTigers?: ExtractedTiger[]
  selectedTigerIds?: string[]
  unmatchedNames?: string[]
}

const Collection = () => {
  const [urls, setUrls] = useState('')
  const [jobs, setJobs] = useState<CollectionJob[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState<number | null>(null)
  const [selectingJobIndex, setSelectingJobIndex] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const abortRef = useRef(false)
  const jobsRef = useRef<CollectionJob[]>([])

  const updateJobs = (updater: CollectionJob[] | ((prev: CollectionJob[]) => CollectionJob[])) => {
    if (typeof updater === 'function') {
      setJobs(prev => {
        const newJobs = updater(prev)
        jobsRef.current = newJobs
        return newJobs
      })
    } else {
      jobsRef.current = updater
      setJobs(updater)
    }
  }

  const extractVideoId = (url: string): string | null => {
    try {
      if (url.includes('youtube.com/watch?v=')) {
        return url.split('v=')[1].split('&')[0]
      } else if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1].split('?')[0]
      }
      return null
    } catch {
      return null
    }
  }

  const collectMutation = useMutation({
    mutationFn: (params: { video_url: string }) => analysisApi.collect(params),
  })

  const extractMutation = useMutation({
    mutationFn: (videoId: string) => analysisApi.extractTigers(videoId),
  })

  const analyzeMutation = useMutation({
    mutationFn: (params: { video_id: string; tiger_ids: string[] }) => analysisApi.analyze(params),
  })

  const pollProgress = (videoId: string): Promise<{ status: string; collectedComments: number; message: string }> => {
    return new Promise((resolve) => {
      let retryCount = 0
      const maxRetries = 3

      const interval = setInterval(async () => {
        if (abortRef.current) {
          clearInterval(interval)
          resolve({ status: 'error', collectedComments: 0, message: '中断されました' })
          return
        }

        try {
          const status = await analysisApi.getCollectionStatus(videoId)
          retryCount = 0

          if (status.status === 'completed') {
            clearInterval(interval)
            queryClient.invalidateQueries({ queryKey: ['videos'] })
            resolve({
              status: 'completed',
              collectedComments: status.collected_comments || 0,
              message: `${status.collected_comments}件収集`
            })
          } else if (status.status === 'error') {
            clearInterval(interval)
            resolve({
              status: 'error',
              collectedComments: 0,
              message: status.message || 'エラー'
            })
          }
        } catch (error: any) {
          retryCount++
          if (retryCount >= maxRetries) {
            clearInterval(interval)
            if (error.response?.status === 404) {
              queryClient.invalidateQueries({ queryKey: ['videos'] })
              resolve({
                status: 'completed',
                collectedComments: 0,
                message: '完了'
              })
            } else {
              resolve({
                status: 'error',
                collectedComments: 0,
                message: '取得失敗'
              })
            }
          }
        }
      }, 2000)
    })
  }

  const runAnalysis = async (jobIndex: number, tigerIds: string[], collectedComments: number) => {
    const job = jobsRef.current[jobIndex]
    if (!job?.videoId) return

    updateJobs(prev => prev.map((j, idx) =>
      idx === jobIndex ? {
        ...j,
        status: 'analyzing',
        message: `${tigerIds.length}名で分析中...`,
        selectedTigerIds: tigerIds
      } : j
    ))

    try {
      await analyzeMutation.mutateAsync({
        video_id: job.videoId,
        tiger_ids: tigerIds
      })
      updateJobs(prev => prev.map((j, idx) =>
        idx === jobIndex ? {
          ...j,
          status: 'completed',
          message: `${collectedComments}件 → ${tigerIds.length}名分析完了`
        } : j
      ))
    } catch (analyzeError) {
      updateJobs(prev => prev.map((j, idx) =>
        idx === jobIndex ? {
          ...j,
          status: 'completed',
          message: `${collectedComments}件（分析エラー）`
        } : j
      ))
    }
  }

  const handleTigerSelection = async (jobIndex: number, selectedIds: string[]) => {
    const job = jobsRef.current[jobIndex]
    setSelectingJobIndex(null)
    await runAnalysis(jobIndex, selectedIds, job?.collectedComments || 0)
    continueProcessing(jobIndex + 1)
  }

  const continueProcessing = async (startIndex: number) => {
    for (let i = startIndex; i < jobsRef.current.length; i++) {
      if (abortRef.current) break
      const job = jobsRef.current[i]
      if (!job?.videoId || job.status !== 'pending') continue

      await processJob(i)

      if (jobsRef.current[i]?.status === 'selecting') {
        return
      }
    }

    setIsProcessing(false)
    setCurrentJobIndex(null)
    queryClient.invalidateQueries({ queryKey: ['videos'] })
    queryClient.invalidateQueries({ queryKey: ['analyzedVideos'] })

    const completedCount = jobsRef.current.filter(j => j.status === 'completed').length
    if (completedCount > 0) {
      toast.success(`${completedCount}件の処理が完了しました`)
    }
  }

  const processJob = async (jobIndex: number) => {
    const job = jobsRef.current[jobIndex]
    if (!job?.videoId) return

    setCurrentJobIndex(jobIndex)

    updateJobs(prev => prev.map((j, idx) =>
      idx === jobIndex ? { ...j, status: 'collecting', message: '収集中...' } : j
    ))

    try {
      const data = await collectMutation.mutateAsync({ video_url: job.url })

      if (data.status === 'collecting' && job.videoId) {
        const result = await pollProgress(job.videoId)

        if (result.status === 'completed') {
          updateJobs(prev => prev.map((j, idx) =>
            idx === jobIndex ? { ...j, status: 'extracting', message: '出演虎を検出中...' } : j
          ))

          try {
            const extractResult = await extractMutation.mutateAsync(job.videoId)
            const extractedTigers = extractResult.tigers || []
            const unmatchedNames = extractResult.unmatched_names || []

            if (extractedTigers.length === 0) {
              updateJobs(prev => prev.map((j, idx) =>
                idx === jobIndex ? {
                  ...j,
                  status: 'completed',
                  message: `${result.collectedComments}件（出演虎が検出できませんでした）`,
                  collectedComments: result.collectedComments,
                  extractedTigers: [],
                  unmatchedNames
                } : j
              ))
            } else if (extractedTigers.length <= 5) {
              const warningMsg = extractedTigers.length < 5
                ? `（${extractedTigers.length}人分しか検出できませんでした）`
                : ''

              updateJobs(prev => prev.map((j, idx) =>
                idx === jobIndex ? {
                  ...j,
                  collectedComments: result.collectedComments,
                  extractedTigers,
                  unmatchedNames
                } : j
              ))

              await runAnalysis(jobIndex, extractedTigers.map(t => t.tiger_id), result.collectedComments)

              if (warningMsg) {
                updateJobs(prev => prev.map((j, idx) =>
                  idx === jobIndex ? {
                    ...j,
                    message: j.message + warningMsg
                  } : j
                ))
              }
            } else {
              updateJobs(prev => prev.map((j, idx) =>
                idx === jobIndex ? {
                  ...j,
                  status: 'selecting',
                  message: `${extractedTigers.length}人の虎が検出されました。出演した虎を選択してください`,
                  collectedComments: result.collectedComments,
                  extractedTigers,
                  unmatchedNames
                } : j
              ))
              setSelectingJobIndex(jobIndex)
              return
            }
          } catch (extractError) {
            updateJobs(prev => prev.map((j, idx) =>
              idx === jobIndex ? {
                ...j,
                status: 'completed',
                message: `${result.collectedComments}件（虎抽出エラー）`,
                collectedComments: result.collectedComments
              } : j
            ))
          }
        } else {
          updateJobs(prev => prev.map((j, idx) =>
            idx === jobIndex ? { ...j, status: 'error', message: result.message } : j
          ))
        }
      }
    } catch (error) {
      updateJobs(prev => prev.map((j, idx) =>
        idx === jobIndex ? { ...j, status: 'error', message: '収集失敗' } : j
      ))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)

    if (urlList.length === 0) {
      toast.error('URLを入力してください')
      return
    }

    const newJobs: CollectionJob[] = urlList.map((url, index) => ({
      id: `job-${Date.now()}-${index}`,
      url,
      videoId: extractVideoId(url),
      status: 'pending' as const,
      message: '待機中'
    }))

    const invalidJobs = newJobs.filter(job => !job.videoId)
    if (invalidJobs.length > 0) {
      invalidJobs.forEach(job => {
        job.status = 'error'
        job.message = '無効なURL'
      })
    }

    updateJobs(newJobs)
    setIsProcessing(true)
    abortRef.current = false

    for (let i = 0; i < newJobs.length; i++) {
      if (abortRef.current) break
      const job = newJobs[i]
      if (!job.videoId) continue

      await processJob(i)

      if (newJobs[i]?.status === 'selecting') {
        return
      }

      if (i < newJobs.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    if (!newJobs.some(j => j.status === 'selecting')) {
      setIsProcessing(false)
      setCurrentJobIndex(null)
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['analyzedVideos'] })

      const completedCount = newJobs.filter(j => j.status === 'completed').length
      toast.success(`${completedCount}/${urlList.length}件の処理が完了しました`)
    }
  }

  const handleAbort = () => {
    abortRef.current = true
    toast('処理を中断しています...')
  }

  const clearJobs = () => {
    updateJobs([])
    setUrls('')
    setSelectingJobIndex(null)
  }

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const errorJobs = jobs.filter(j => j.status === 'error')
  const urlCount = urls.split('\n').filter(url => url.trim()).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">データ収集</h1>
        <p className="text-muted-foreground">YouTube動画のコメントを収集し、出演虎を自動検出して分析します</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>動画URL入力</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="urls" className="block text-sm font-medium mb-2">
                YouTube動画URL（1行に1つ）
              </label>
              <textarea
                id="urls"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={`https://www.youtube.com/watch?v=xxx
https://www.youtube.com/watch?v=yyy
https://www.youtube.com/watch?v=zzz`}
                rows={5}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                disabled={isProcessing}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                {urlCount}件のURL入力中
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={!urls.trim() || isProcessing}>
                {isProcessing ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                {isProcessing ? '処理中...' : '収集 & 自動分析'}
              </Button>

              {isProcessing && (
                <Button type="button" variant="destructive" onClick={handleAbort}>
                  <XCircle className="mr-2 h-4 w-4" />
                  中断
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {jobs.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>処理状況</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                完了: {completedJobs.length} / エラー: {errorJobs.length} / 合計: {jobs.length}
              </p>
            </div>
            {!isProcessing && !selectingJobIndex && (
              <Button variant="ghost" size="sm" onClick={clearJobs}>
                <Trash2 className="mr-2 h-4 w-4" />
                クリア
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {jobs.map((job, index) => (
                <div key={job.id}>
                  <div className={`px-6 py-3 flex items-center gap-4 ${
                    currentJobIndex === index ? 'bg-muted/50' : ''
                  } ${selectingJobIndex === index ? 'bg-primary/5' : ''}`}>
                    <div className="flex-shrink-0">
                      {job.status === 'pending' && <div className="w-5 h-5 rounded-full bg-muted" />}
                      {(job.status === 'collecting' || job.status === 'extracting' || job.status === 'analyzing') && (
                        <Loader className="w-5 h-5 text-primary animate-spin" />
                      )}
                      {job.status === 'selecting' && <Users className="w-5 h-5 text-amber-500" />}
                      {job.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                      {job.status === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{job.videoId || '無効なURL'}</p>
                      {job.extractedTigers && job.extractedTigers.length > 0 && job.status === 'completed' && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {job.selectedTigerIds?.length || job.extractedTigers.length}名の出演虎で分析
                        </p>
                      )}
                      {job.unmatchedNames && job.unmatchedNames.length > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          未登録: {job.unmatchedNames.join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      <span className={`text-sm font-medium ${
                        job.status === 'completed' ? 'text-green-600' :
                        job.status === 'error' ? 'text-destructive' :
                        job.status === 'selecting' ? 'text-amber-600' :
                        (job.status === 'collecting' || job.status === 'extracting' || job.status === 'analyzing') ? 'text-primary' :
                        'text-muted-foreground'
                      }`}>
                        {job.message}
                      </span>
                    </div>
                  </div>

                  {selectingJobIndex === index && job.extractedTigers && (
                    <TigerSelector
                      tigers={job.extractedTigers}
                      onConfirm={(selectedIds) => handleTigerSelection(index, selectedIds)}
                      onCancel={() => {
                        setSelectingJobIndex(null)
                        updateJobs(prev => prev.map((j, idx) =>
                          idx === index ? {
                            ...j,
                            status: 'completed',
                            message: `${job.collectedComments}件（虎選択をスキップ）`
                          } : j
                        ))
                        continueProcessing(index + 1)
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {!isProcessing && !selectingJobIndex && completedJobs.length > 0 && (
              <div className="p-6 border-t bg-muted/30 space-y-3">
                {jobs.some(j => j.unmatchedNames && j.unmatchedNames.length > 0) && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        登録されていない社長が検出されました
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        社長マスタに登録してから再分析してください
                      </p>
                    </div>
                  </div>
                )}
                <Button className="w-full" onClick={() => navigate('/analysis')}>
                  動画分析ページへ移動
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">使い方</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>YouTube動画のURLを入力してください（1行に1つ、複数可）</li>
            <li>「収集 & 自動分析」をクリックすると、以下が自動で実行されます：</li>
          </ol>
          <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-sm text-muted-foreground">
            <li>コメントの収集</li>
            <li>動画の概要欄から出演虎を自動検出（5名を想定）</li>
            <li>5名を超える虎が検出された場合は選択画面が表示されます</li>
            <li>検出された虎で言及分析を実行</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            完了後、「動画分析」ページで結果を確認できます
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

const TigerSelector = ({
  tigers,
  onConfirm,
  onCancel
}: {
  tigers: ExtractedTiger[]
  onConfirm: (selectedIds: string[]) => void
  onCancel: () => void
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(tigers.slice(0, 5).map(t => t.tiger_id)))

  const toggle = (tigerId: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(tigerId)) {
      newSelected.delete(tigerId)
    } else {
      newSelected.add(tigerId)
    }
    setSelected(newSelected)
  }

  return (
    <div className="px-6 py-4 bg-primary/5 border-t">
      <p className="text-sm font-medium mb-3">
        出演した虎を選択してください（{selected.size}名選択中）
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {tigers.map(tiger => (
          <Button
            key={tiger.tiger_id}
            variant={selected.has(tiger.tiger_id) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggle(tiger.tiger_id)}
          >
            {selected.has(tiger.tiger_id) && <Check className="mr-1 h-3 w-3" />}
            {tiger.display_name}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onConfirm(Array.from(selected))} disabled={selected.size === 0}>
          {selected.size}名で分析開始
        </Button>
        <Button variant="outline" onClick={onCancel}>
          スキップ
        </Button>
      </div>
    </div>
  )
}

export default Collection
