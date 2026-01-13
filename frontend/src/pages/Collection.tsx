import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analysisApi } from '../services/api'
import { Download, CheckCircle, XCircle, Loader, ArrowRight, Trash2, Play } from 'lucide-react'
import toast from 'react-hot-toast'

interface CollectionJob {
  id: string
  url: string
  videoId: string | null
  status: 'pending' | 'collecting' | 'completed' | 'error'
  message: string
  collectedComments?: number
}

const Collection = () => {
  const [urls, setUrls] = useState('')
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
              message: `${status.collected_comments}件`
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

    // ジョブリストを作成
    const newJobs: CollectionJob[] = urlList.map((url, index) => ({
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
          idx === jobIndex ? { ...j, status: 'error', message: '失敗' } : j
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
    toast.success(`${completedCount}/${urlList.length}件の収集が完了しました`)
  }

  const handleAbort = () => {
    abortRef.current = true
    toast.info('収集を中断しています...')
  }

  const clearJobs = () => {
    setJobs([])
    setUrls('')
  }

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const errorJobs = jobs.filter(j => j.status === 'error')
  const urlCount = urls.split('\n').filter(url => url.trim()).length

  return (
    <div className="space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">データ収集</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">YouTube動画のコメントを収集します</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">動画URL入力</h2>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="urls" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                YouTube動画URL（1行に1つ）
              </label>
              <textarea
                id="urls"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={`https://www.youtube.com/watch?v=xxx
https://www.youtube.com/watch?v=yyy
https://www.youtube.com/watch?v=zzz`}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:bg-gray-100 font-mono text-sm"
                disabled={isProcessing}
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {urlCount}件のURLが入力されています
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!urls.trim() || isProcessing}
                className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-md"
              >
                {isProcessing ? <Loader size={20} className="animate-spin" /> : <Play size={20} />}
                <span>{isProcessing ? '収集中...' : 'コメントを収集'}</span>
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
                className={`px-6 py-3 flex items-center gap-4 ${
                  currentJobIndex === index ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  {job.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />
                  )}
                  {job.status === 'collecting' && (
                    <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                  {job.status === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {job.status === 'error' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {job.videoId || '無効なURL'}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <span className={`text-sm font-medium ${
                    job.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                    job.status === 'error' ? 'text-red-600 dark:text-red-400' :
                    job.status === 'collecting' ? 'text-blue-600 dark:text-blue-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {job.message}
                  </span>
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
          <li>YouTube動画のURLを入力してください（1行に1つ、複数可）</li>
          <li>「コメントを収集」をクリックすると、順番に収集が開始されます</li>
          <li>収集完了後、「動画分析」ページで社長別の言及分析ができます</li>
          <li>YouTube APIの制限により、1日あたりの収集数には上限があります</li>
        </ol>
      </div>
    </div>
  )
}

export default Collection
