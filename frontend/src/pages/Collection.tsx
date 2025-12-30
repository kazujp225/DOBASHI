import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analysisApi } from '../services/api'
import { Download, CheckCircle, XCircle, Loader, Link as LinkIcon, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import LogViewer from '../components/LogViewer'

const Collection = () => {
  const [videoUrl, setVideoUrl] = useState('')
  const [progress, setProgress] = useState<any>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const collectMutation = useMutation({
    mutationFn: (params: { video_url: string }) => analysisApi.collect(params),
    onSuccess: (data) => {
      setProgress(data)
      if (data.status === 'collecting') {
        pollProgress(data.video_id)
      }
      toast.success('コメント収集を開始しました')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'コメント収集の開始に失敗しました')
    },
  })

  const pollProgress = async (videoId: string) => {
    let retryCount = 0
    const maxRetries = 3

    const interval = setInterval(async () => {
      try {
        const status = await analysisApi.getCollectionStatus(videoId)
        retryCount = 0
        setProgress(status)

        if (status.status === 'completed') {
          clearInterval(interval)
          queryClient.invalidateQueries({ queryKey: ['videos'] })
          toast.success('収集が完了しました！')
        } else if (status.status === 'error') {
          clearInterval(interval)
          toast.error(status.message || '収集中にエラーが発生しました')
        }
      } catch (error: any) {
        console.error('Error polling progress:', error)
        retryCount++

        if (retryCount >= maxRetries) {
          clearInterval(interval)
          if (error.response?.status === 404) {
            queryClient.invalidateQueries({ queryKey: ['videos'] })
            setProgress((prev: any) => prev ? {
              ...prev,
              status: 'completed',
              message: '収集が完了しました（ステータス取得タイムアウト）'
            } : null)
            toast.success('収集が完了しました')
          } else {
            setProgress((prev: any) => prev ? {
              ...prev,
              status: 'error',
              message: 'ステータスの取得に失敗しました。ページを更新してください。'
            } : null)
            toast.error('ステータスの取得に失敗しました')
          }
        }
      }
    }, 2000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl.trim()) {
      toast.error('URLを入力してください')
      return
    }

    collectMutation.mutate({ video_url: videoUrl })
  }

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
                  className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100"
                  disabled={collectMutation.isPending}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                令和の虎のYouTube動画URLを入力してください
              </p>
            </div>

            <button
              type="submit"
              disabled={!videoUrl.trim() || collectMutation.isPending}
              className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-md"
            >
              <Download size={20} />
              <span>{collectMutation.isPending ? '収集中...' : 'コメントを収集'}</span>
            </button>
          </form>
        </div>
      </div>

      {progress && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">収集状況</h2>
          </div>

          <div className="p-6">
            <div className="flex items-start space-x-4">
              {progress.status === 'collecting' && (
                <Loader className="text-blue-500 animate-spin flex-shrink-0" size={24} />
              )}
              {progress.status === 'completed' && (
                <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
              )}
              {progress.status === 'error' && (
                <XCircle className="text-red-500 flex-shrink-0" size={24} />
              )}

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {progress.status === 'collecting' && 'コメント収集中...'}
                    {progress.status === 'completed' && '収集完了！'}
                    {progress.status === 'error' && '収集エラー'}
                  </h3>
                  {progress.status === 'collecting' && progress.total_comments && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {progress.collected_comments} / {progress.total_comments}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{progress.message}</p>

                {progress.status === 'collecting' && progress.total_comments && (
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(progress.collected_comments / progress.total_comments) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {progress.status === 'completed' && (
                  <div className="mt-4 space-y-3">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-800 dark:text-green-300">
                        {progress.collected_comments}件のコメントを収集しました。
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(`/analysis?video=${progress.video_id}`)}
                      className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all transform hover:scale-105 shadow-md"
                    >
                      <span>動画分析ページへ移動</span>
                      <ArrowRight size={20} />
                    </button>
                  </div>
                )}

                {progress.status === 'error' && (
                  <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">
                      エラーが発生しました。URLを確認して再度お試しください。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ログビューアー */}
      {progress && progress.logs && progress.logs.length > 0 && (
        <LogViewer logs={progress.logs} title="コメント収集ログ" />
      )}

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 mb-2">使い方</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>令和の虎のYouTube動画URLをコピーして上のフォームに貼り付けます</li>
          <li>「コメントを収集」ボタンをクリックすると、収集が開始されます</li>
          <li>収集完了後、「動画分析」ページで社長別の言及分析ができます</li>
          <li>YouTube APIの制限により、1日あたりの収集数には上限があります</li>
        </ol>
      </div>
    </div>
  )
}

export default Collection
