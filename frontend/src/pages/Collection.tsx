import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analysisApi, tigersApi } from '../services/api'
import { Download, CheckCircle, XCircle, Loader, Link as LinkIcon, ArrowRight, Users, ChevronDown, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import LogViewer from '../components/LogViewer'

const Collection = () => {
  const [videoUrl, setVideoUrl] = useState('')
  const [progress, setProgress] = useState<any>(null)
  const [selectedTigerIds, setSelectedTigerIds] = useState<string[]>([])
  const [isTigerSelectorOpen, setIsTigerSelectorOpen] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // 社長マスタを取得
  const { data: tigers } = useQuery({
    queryKey: ['tigers'],
    queryFn: tigersApi.getAll,
  })

  const collectMutation = useMutation({
    mutationFn: (params: { video_url: string; tiger_ids?: string[] }) => analysisApi.collect(params),
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

  // 社長選択のトグル
  const toggleTigerSelection = (tigerId: string) => {
    setSelectedTigerIds(prev =>
      prev.includes(tigerId)
        ? prev.filter(id => id !== tigerId)
        : [...prev, tigerId]
    )
  }

  const pollProgress = async (videoId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await analysisApi.getCollectionStatus(videoId)
        setProgress(status)

        if (status.status === 'completed') {
          clearInterval(interval)
          // 動画一覧を再読み込み
          queryClient.invalidateQueries({ queryKey: ['videos'] })
          toast.success('収集が完了しました！')
        } else if (status.status === 'error') {
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
    if (!videoUrl.trim()) {
      toast.error('URLを入力してください')
      return
    }
    if (selectedTigerIds.length === 0) {
      toast.error('出演社長を1人以上選択してください')
      return
    }

    collectMutation.mutate({ video_url: videoUrl, tiger_ids: selectedTigerIds })
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

            {/* 出演社長選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                出演社長を選択 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTigerSelectorOpen(!isTigerSelectorOpen)}
                  disabled={collectMutation.isPending}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-650 disabled:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-gray-400" />
                    <span className={selectedTigerIds.length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
                      {selectedTigerIds.length > 0
                        ? `${selectedTigerIds.length}名の社長を選択中`
                        : '社長を選択してください'}
                    </span>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-gray-500 transition-transform duration-200 ${isTigerSelectorOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* ドロップダウン */}
                <div
                  className={`absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden transition-all duration-300 ease-in-out ${
                    isTigerSelectorOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 shadow-lg overflow-y-auto max-h-72">
                    {tigers?.map((tiger) => {
                      const isSelected = selectedTigerIds.includes(tiger.tiger_id)
                      return (
                        <button
                          key={tiger.tiger_id}
                          type="button"
                          onClick={() => toggleTigerSelection(tiger.tiger_id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            isSelected
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-orange-500 border-orange-500'
                              : 'border-gray-300 dark:border-gray-500'
                          }`}>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                          <span className="font-medium">{tiger.display_name}</span>
                          {tiger.full_name && tiger.full_name !== tiger.display_name && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">({tiger.full_name})</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 選択済み社長のタグ表示 */}
              {selectedTigerIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTigerIds.map(id => {
                    const tiger = tigers?.find(t => t.tiger_id === id)
                    return tiger ? (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm font-medium"
                      >
                        {tiger.display_name}
                        <button
                          type="button"
                          onClick={() => toggleTigerSelection(id)}
                          className="ml-1 hover:text-orange-900 dark:hover:text-orange-100"
                        >
                          ×
                        </button>
                      </span>
                    ) : null
                  })}
                </div>
              )}

              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                この動画に出演している社長を選択してください。選択した社長のみ分析対象になります。
              </p>
            </div>

            <button
              type="submit"
              disabled={!videoUrl.trim() || selectedTigerIds.length === 0 || collectMutation.isPending}
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
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800">
                        {progress.collected_comments}件のコメントを収集しました。
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/analysis')}
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
        <h3 className="font-medium text-blue-900 mb-2">💡 使い方</h3>
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
