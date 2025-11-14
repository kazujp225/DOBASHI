import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { analysisApi } from '../services/api'
import { Download, CheckCircle, XCircle, Loader } from 'lucide-react'

const Collection = () => {
  const [videoUrl, setVideoUrl] = useState('')
  const [progress, setProgress] = useState<any>(null)

  const collectMutation = useMutation({
    mutationFn: analysisApi.collect,
    onSuccess: (data) => {
      setProgress(data)
      // ポーリングして進捗を確認
      if (data.status === 'collecting') {
        pollProgress(data.video_id)
      }
    },
  })

  const pollProgress = async (videoId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await analysisApi.getCollectionStatus(videoId)
        setProgress(status)

        if (status.status === 'completed' || status.status === 'error') {
          clearInterval(interval)
        }
      } catch (error) {
        console.error('Error polling progress:', error)
        clearInterval(interval)
      }
    }, 2000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl) return

    collectMutation.mutate({ video_url: videoUrl })
  }

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">データ収集</h1>
        <p className="mt-2 text-gray-600">YouTube動画のコメントを収集します</p>
      </div>

      {/* 収集フォーム */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">動画URL入力</h2>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 mb-2">
                YouTube動画URL
              </label>
              <input
                type="text"
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={collectMutation.isPending}
              />
              <p className="mt-2 text-sm text-gray-500">
                令和の虎のYouTube動画URLを入力してください
              </p>
            </div>

            <button
              type="submit"
              disabled={!videoUrl || collectMutation.isPending}
              className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={20} />
              <span>{collectMutation.isPending ? '収集中...' : 'コメントを収集'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* 進捗表示 */}
      {progress && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">収集状況</h2>
          </div>

          <div className="p-6">
            <div className="flex items-start space-x-4">
              {progress.status === 'collecting' && (
                <Loader className="text-blue-500 animate-spin" size={24} />
              )}
              {progress.status === 'completed' && (
                <CheckCircle className="text-green-500" size={24} />
              )}
              {progress.status === 'error' && (
                <XCircle className="text-red-500" size={24} />
              )}

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">
                    {progress.status === 'collecting' && 'コメント収集中...'}
                    {progress.status === 'completed' && '収集完了！'}
                    {progress.status === 'error' && '収集エラー'}
                  </h3>
                  {progress.status === 'collecting' && progress.total_comments && (
                    <span className="text-sm text-gray-500">
                      {progress.collected_comments} / {progress.total_comments}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-gray-600">{progress.message}</p>

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
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      {progress.collected_comments}件のコメントを収集しました。
                      次は「動画分析」ページで社長別の言及を分析してください。
                    </p>
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

      {/* 使い方 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
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
