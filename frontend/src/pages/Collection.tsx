import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analysisApi } from '../services/api'
import { Download, CheckCircle, XCircle, Loader, Link as LinkIcon, ArrowRight, Plus, Trash2, Play, List } from 'lucide-react'
import toast from 'react-hot-toast'
import LogViewer from '../components/LogViewer'

interface CollectionJob {
  id: string
  url: string
  videoId: string | null
  status: 'pending' | 'collecting' | 'completed' | 'error'
  message: string
  collectedComments?: number
  logs?: any[]
}

const Collection = () => {
  const [inputMode, setInputMode] = useState<'single' | 'bulk'>('single')
  const [videoUrl, setVideoUrl] = useState('')
  const [bulkUrls, setBulkUrls] = useState('')
  const [jobs, setJobs] = useState<CollectionJob[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const abortRef = useRef(false)

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
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'コメント収集の開始に失敗しました')
    },
  })

  const pollProgress = (videoId: string): Promise<{ status: string; collectedComments: number; message: string; logs?: any[] }> => {
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
              message: `${status.collected_comments}件のコメントを収集しました`,
              logs: status.logs
            })
          } else if (status.status === 'error') {
            clearInterval(interval)
            resolve({
              status: 'error',
              collectedComments: 0,
              message: status.message || '収集中にエラーが発生しました',
              logs: status.logs
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
                message: '収集完了（ステータス取得タイムアウト）'
              })
            } else {
              resolve({
                status: 'error',
                collectedComments: 0,
                message: 'ステータスの取得に失敗しました'
              })
            }
          }
        }
      }, 2000)
    })
  }

  // 単一URL収集
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl.trim()) {
      toast.error('URLを入力してください')
      return
    }

    const videoId = extractVideoId(videoUrl)
    if (!videoId) {
      toast.error('有効なYouTube URLを入力してください')
      return
    }

    const job: CollectionJob = {
      id: `job-${Date.now()}`,
      url: videoUrl,
      videoId,
      status: 'collecting',
      message: '収集中...'
    }
    setJobs([job])
    setIsProcessing(true)
    setCurrentJobIndex(0)

    try {
      const data = await collectMutation.mutateAsync({ video_url: videoUrl })
      if (data.status === 'collecting') {
        const result = await pollProgress(videoId)
        setJobs([{ ...job, ...result }])
        if (result.status === 'completed') {
          toast.success('収集が完了しました！')
        }
      }
    } catch (error) {
      setJobs([{ ...job, status: 'error', message: '収集に失敗しました' }])
    } finally {
      setIsProcessing(false)
      setCurrentJobIndex(null)
    }
  }

  // 一括URL収集
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const urls = bulkUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)

    if (urls.length === 0) {
      toast.error('URLを入力してください')
      return
    }

    // ジョブリストを作成
    const newJobs: CollectionJob[] = urls.map((url, index) => ({
      id: `job-${Date.now()}-${index}`,
      url,
      videoId: extractVideoId(url),
      status: 'pending' as const,
      message: '待機中'
    }))

    // 無効なURLをチェック
    const invalidJobs = newJobs.filter(job => !job.videoId)
    if (invalidJobs.length > 0) {
      invalidJobs.forEach(job => {
        job.status = 'error'
        job.message = '無効なURL'
      })
    }

    setJobs(newJobs)
    setIsProcessing(true)
    abortRef.current = false

    // 有効なジョブのみ順次処理
    const validJobs = newJobs.filter(job => job.videoId)
    for (let i = 0; i < validJobs.length; i++) {
      if (abortRef.current) break

      const job = validJobs[i]
      const jobIndex = newJobs.findIndex(j => j.id === job.id)
      setCurrentJobIndex(jobIndex)

      // ステータスを更新
      setJobs(prev => prev.map((j, idx) =>
        idx === jobIndex ? { ...j, status: 'collecting', message: '収集中...' } : j
      ))

      try {
        const data = await collectMutation.mutateAsync({ video_url: job.url })
        if (data.status === 'collecting' && job.videoId) {
          const result = await pollProgress(job.videoId)
          setJobs(prev => prev.map((j, idx) =>
            idx === jobIndex ? { ...j, ...result } : j
          ))
        }
      } catch (error) {
        setJobs(prev => prev.map((j, idx) =>
          idx === jobIndex ? { ...j, status: 'error', message: '収集に失敗しました' } : j
        ))
      }

      // 次のジョブまで少し待機
      if (i < validJobs.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setIsProcessing(false)
    setCurrentJobIndex(null)
    queryClient.invalidateQueries({ queryKey: ['videos'] })

    const completedCount = newJobs.filter(j => j.status === 'completed').length
    toast.success(`${completedCount}/${urls.length}件の収集が完了しました`)
  }

  const handleAbort = () => {
    abortRef.current = true
    toast.info('収集を中断しています...')
  }

  const clearJobs = () => {
    setJobs([])
    setVideoUrl('')
    setBulkUrls('')
  }

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const errorJobs = jobs.filter(j => j.status === 'error')

  return (
    <div className="space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">データ収集</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">YouTube動画のコメントを収集します</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">動画URL入力</h2>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button
                onClick={() => setInputMode('single')}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                  inputMode === 'single'
                    ? 'bg-orange-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <LinkIcon size={16} />
                単一
              </button>
              <button
                onClick={() => setInputMode('bulk')}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                  inputMode === 'bulk'
                    ? 'bg-orange-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <List size={16} />
                一括
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {inputMode === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div>
                <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  YouTube動画URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="videoUrl"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:bg-gray-100"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!videoUrl.trim() || isProcessing}
                className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-md"
              >
                <Download size={20} />
                <span>{isProcessing ? '収集中...' : 'コメントを収集'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div>
                <label htmlFor="bulkUrls" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  YouTube動画URL（1行に1つ）
                </label>
                <textarea
                  id="bulkUrls"
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder={`https://www.youtube.com/watch?v=xxx
https://www.youtube.com/watch?v=yyy
https://www.youtube.com/watch?v=zzz`}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:bg-gray-100 font-mono text-sm"
                  disabled={isProcessing}
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {bulkUrls.split('\n').filter(url => url.trim()).length}件のURLが入力されています
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!bulkUrls.trim() || isProcessing}
                  className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-md"
                >
                  <Play size={20} />
                  <span>{isProcessing ? '処理中...' : '一括収集を開始'}</span>
                </button>

                {isProcessing && (
                  <button
                    type="button"
                    onClick={handleAbort}
                    className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-md"
                  >
                    <XCircle size={20} />
                    <span>中断</span>
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 収集状況 */}
      {jobs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">収集状況</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                完了: {completedJobs.length} / エラー: {errorJobs.length} / 合計: {jobs.length}
              </p>
            </div>
            {!isProcessing && (
              <button
                onClick={clearJobs}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 size={16} />
                クリア
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
            {jobs.map((job, index) => (
              <div
                key={job.id}
                className={`px-6 py-4 flex items-center gap-4 ${
                  currentJobIndex === index ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  {job.status === 'pending' && (
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />
                  )}
                  {job.status === 'collecting' && (
                    <Loader className="w-6 h-6 text-blue-500 animate-spin" />
                  )}
                  {job.status === 'completed' && (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  )}
                  {job.status === 'error' && (
                    <XCircle className="w-6 h-6 text-red-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {job.videoId || '無効なURL'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {job.url}
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className={`text-sm font-medium ${
                    job.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                    job.status === 'error' ? 'text-red-600 dark:text-red-400' :
                    job.status === 'collecting' ? 'text-blue-600 dark:text-blue-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {job.message}
                  </p>
                  {job.collectedComments !== undefined && job.collectedComments > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {job.collectedComments}件
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 完了後のアクション */}
          {!isProcessing && completedJobs.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={() => navigate('/analysis')}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all transform hover:scale-105 shadow-md"
              >
                <span>動画分析ページへ移動</span>
                <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">使い方</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li>「単一」モードでは1つのURL、「一括」モードでは複数のURLを入力できます</li>
          <li>一括モードでは、1行に1つのURLを入力してください</li>
          <li>「コメントを収集」または「一括収集を開始」をクリックすると、収集が開始されます</li>
          <li>収集完了後、「動画分析」ページで社長別の言及分析ができます</li>
          <li>YouTube APIの制限により、1日あたりの収集数には上限があります</li>
        </ol>
      </div>
    </div>
  )
}

export default Collection
