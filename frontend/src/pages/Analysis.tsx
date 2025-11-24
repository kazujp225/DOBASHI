import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { videosApi, tigersApi, analysisApi, statsApi, api } from '../services/api'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Search, Download, Video, Users, MessageCircle, AtSign, Percent, PieChart as PieChartIcon, Trophy, MessageSquare, Filter, ThumbsUp, X, Check, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportToCSV, formatVideoStatsForCSV } from '../utils/csv'

interface ExtractedTiger {
  tiger_id: string
  display_name: string
  full_name?: string
  source: string
}

interface RegisteredTiger {
  tiger_id: string
  display_name: string
  full_name?: string
  image_url?: string
  appearance_order: number
}

const Analysis = () => {
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedTigers, setSelectedTigers] = useState<string[]>([])
  const [commentFilterTigerId, setCommentFilterTigerId] = useState<string>('all')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [extractedTigers, setExtractedTigers] = useState<ExtractedTiger[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [hasRegisteredTigers, setHasRegisteredTigers] = useState(false)

  const { data: videos } = useQuery({
    queryKey: ['videos'],
    queryFn: videosApi.getAll,
  })

  const { data: tigers } = useQuery({
    queryKey: ['tigers'],
    queryFn: tigersApi.getAll,
  })

  const { data: videoStats, refetch } = useQuery({
    queryKey: ['videoStats', selectedVideoId],
    queryFn: () => statsApi.getVideoStats(selectedVideoId),
    enabled: !!selectedVideoId,
  })

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['comments', selectedVideoId, commentFilterTigerId],
    queryFn: () => analysisApi.getComments(
      selectedVideoId,
      commentFilterTigerId === 'all' ? undefined : commentFilterTigerId
    ),
    enabled: !!selectedVideoId && !!videoStats,
  })

  const analyzeMutation = useMutation({
    mutationFn: analysisApi.analyze,
    onSuccess: () => {
      refetch()
      refetchComments()
      setShowConfirmModal(false)
      toast.success('分析が完了しました')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '分析に失敗しました')
    },
  })

  // 分析開始ボタン押下時：まず登録済み社長をチェック、なければ概要欄から抽出
  const handleStartAnalysis = async () => {
    if (!selectedVideoId) {
      toast.error('動画を選択してください')
      return
    }

    setIsExtracting(true)
    try {
      // まず登録済みの社長をチェック
      const registeredResponse = await api.get(`/api/v1/analysis/video-tigers/${selectedVideoId}`)
      const registeredData = registeredResponse.data

      if (registeredData.has_registered && registeredData.tigers.length > 0) {
        // 登録済みの社長がある場合はそれを使用
        const registered = registeredData.tigers as RegisteredTiger[]
        setExtractedTigers(registered.map(t => ({
          tiger_id: t.tiger_id,
          display_name: t.display_name,
          full_name: t.full_name,
          source: 'registered'
        })))
        setSelectedTigers(registered.map((t: RegisteredTiger) => t.tiger_id))
        setHasRegisteredTigers(true)
        setShowConfirmModal(true)
      } else {
        // 登録がない場合は概要欄から抽出
        const response = await api.get(`/api/v1/tigers/extract/preview/${selectedVideoId}`)
        const extracted = response.data.found_tigers || []

        setExtractedTigers(extracted)
        setSelectedTigers(extracted.map((t: ExtractedTiger) => t.tiger_id))
        setHasRegisteredTigers(false)
        setShowConfirmModal(true)
      }
    } catch (error: any) {
      // 動画がDBにない場合は全社長リストから選択
      if (error.response?.status === 404) {
        toast.error('動画情報が見つかりません。先にコメント収集を行ってください。')
      } else {
        toast.error('社長の抽出に失敗しました')
      }
    } finally {
      setIsExtracting(false)
    }
  }

  // 確認後に分析実行
  const handleConfirmAnalysis = () => {
    if (selectedTigers.length === 0) {
      toast.error('少なくとも1人の社長を選択してください')
      return
    }

    analyzeMutation.mutate({
      video_id: selectedVideoId,
      tiger_ids: selectedTigers,
    })
  }

  const handleExportCSV = () => {
    if (!videoStats || !videoStats.tiger_stats || videoStats.tiger_stats.length === 0) {
      toast.error('エクスポートするデータがありません')
      return
    }

    const csvData = formatVideoStatsForCSV(videoStats)
    exportToCSV(csvData, `動画分析結果_${videoStats.video_id}_${new Date().toISOString().split('T')[0]}`)
    toast.success('CSVをエクスポートしました')
  }

  const colors = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5']

  const selectedVideo = videos?.find(v => v.video_id === selectedVideoId)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">動画分析</h1>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">社長別のコメント言及を分析</p>
        </div>
        {videoStats && videoStats.tiger_stats && videoStats.tiger_stats.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl hover:from-orange-700 hover:to-orange-600 shadow-lg shadow-orange-500/30 transition-all hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5"
          >
            <Download size={18} />
            <span>CSV出力</span>
          </button>
        )}
      </div>

      {/* 分析設定 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-8 space-y-6">
          {/* 動画選択 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-4">
              <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Video size={16} className="text-orange-600 dark:text-orange-400" />
              </div>
              <span>動画を選択</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos?.map((video) => (
                <div
                  key={video.video_id}
                  onClick={() => setSelectedVideoId(video.video_id)}
                  className={`group flex gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                    selectedVideoId === video.video_id
                      ? 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 ring-2 ring-orange-500 shadow-lg'
                      : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-36 h-24 object-cover rounded-lg shadow-sm"
                    />
                    {selectedVideoId === video.video_id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-orange-600/20 rounded-lg">
                        <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center shadow-lg">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-orange-600 transition-colors">
                      {video.title}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {video.view_count?.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={14} />
                        {video.comment_count?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 分析ボタン */}
          <button
            onClick={handleStartAnalysis}
            disabled={!selectedVideoId || isExtracting}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-base font-semibold rounded-xl hover:from-orange-700 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all hover:-translate-y-0.5 disabled:shadow-none disabled:translate-y-0"
          >
            <Search size={20} />
            <span>{isExtracting ? '社長を検出中...' : '分析を開始'}</span>
          </button>
        </div>
      </div>

      {/* 確認モーダル */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                    <Users size={20} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">出演社長の確認</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {hasRegisteredTigers ? '前回の分析で登録された社長です' : '概要欄から検出された社長です'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* 動画情報 */}
            {selectedVideo && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                  {selectedVideo.title}
                </p>
              </div>
            )}

            {/* 検出結果 */}
            <div className="p-6 overflow-y-auto max-h-[400px]">
              {extractedTigers.length > 0 ? (
                <div className={`mb-4 p-3 ${hasRegisteredTigers ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'} border rounded-xl`}>
                  <div className={`flex items-center gap-2 ${hasRegisteredTigers ? 'text-blue-700 dark:text-blue-300' : 'text-green-700 dark:text-green-300'}`}>
                    <Check size={16} />
                    <span className="text-sm font-medium">
                      {hasRegisteredTigers
                        ? `${extractedTigers.length}名の社長が登録済みです（変更可能）`
                        : `${extractedTigers.length}名の社長を検出しました`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                    <AlertCircle size={16} />
                    <span className="text-sm font-medium">概要欄から社長を検出できませんでした。手動で選択してください。</span>
                  </div>
                </div>
              )}

              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                分析対象の社長を選択
                <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                  {selectedTigers.length}名選択中
                </span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                {tigers?.map((tiger) => {
                  const isExtracted = extractedTigers.some(t => t.tiger_id === tiger.tiger_id)
                  const isSelected = selectedTigers.includes(tiger.tiger_id)

                  return (
                    <label
                      key={tiger.tiger_id}
                      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 ring-2 ring-orange-500 shadow-md'
                          : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTigers([...selectedTigers, tiger.tiger_id])
                          } else {
                            setSelectedTigers(selectedTigers.filter((id) => id !== tiger.tiger_id))
                          }
                        }}
                        className="w-4 h-4 rounded border-2 border-gray-300 text-orange-600 focus:ring-2 focus:ring-orange-500"
                      />
                      {tiger.image_url ? (
                        <img
                          src={tiger.image_url.startsWith('/static') ? `http://localhost:8000${tiger.image_url}` : tiger.image_url}
                          alt={tiger.display_name}
                          className="w-8 h-8 rounded-full object-cover shadow-sm"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {tiger.display_name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                        {tiger.display_name}
                      </span>
                      {isExtracted && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          hasRegisteredTigers
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        }`}>
                          {hasRegisteredTigers ? '登録済' : '検出'}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* モーダルフッター */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmAnalysis}
                  disabled={selectedTigers.length === 0 || analyzeMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl hover:from-orange-700 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 transition-all"
                >
                  <Check size={18} />
                  <span>{analyzeMutation.isPending ? '分析中...' : 'この社長で分析開始'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 分析結果 */}
      {videoStats && (
        <div className="space-y-6">
          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden group hover:shadow-xl transition-shadow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <MessageCircle size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">総コメント数</p>
                </div>
                <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {videoStats.total_comments.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 p-6 rounded-2xl shadow-lg border border-orange-200 dark:border-orange-800 overflow-hidden group hover:shadow-xl transition-shadow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 dark:bg-orange-500/20 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-orange-200 dark:bg-orange-800/50 rounded-xl">
                    <AtSign size={20} className="text-orange-700 dark:text-orange-300" />
                  </div>
                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">社長言及コメント</p>
                </div>
                <p className="text-4xl font-bold text-orange-700 dark:text-orange-300 tracking-tight">
                  {videoStats.tiger_mention_comments.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden group hover:shadow-xl transition-shadow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 dark:bg-green-500/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-xl">
                    <Percent size={20} className="text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">言及率</p>
                </div>
                <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {((videoStats.tiger_mention_comments / videoStats.total_comments) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* グラフとテーブル */}
          {videoStats.tiger_stats.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 円グラフ */}
              <div className="bg-white dark:bg-gray-800 p-7 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                    <PieChartIcon size={20} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">社長別シェア</h3>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={videoStats.tiger_stats as any}
                      dataKey="mention_count"
                      nameKey="display_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {videoStats.tiger_stats.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* ランキングテーブル */}
              <div className="bg-white dark:bg-gray-800 p-7 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                    <Trophy size={20} className="text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">ランキング</h3>
                </div>
                <div className="space-y-3">
                  {videoStats.tiger_stats.map((stat, index) => (
                    <div
                      key={stat.tiger_id}
                      className={`relative flex items-center justify-between p-5 rounded-xl transition-all ${
                        index === 0
                          ? 'bg-gradient-to-r from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 ring-2 ring-orange-400 shadow-lg'
                          : 'bg-gray-50 dark:bg-gray-700/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl text-lg font-bold shadow-sm ${
                          index === 0 ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white' :
                          index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white' :
                          index === 2 ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white' :
                          'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}>
                          {stat.rank}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-base mb-1">{stat.display_name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <MessageCircle size={14} />
                            {stat.mention_count}件の言及
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {(stat.rate_total * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Rate Total</p>
                      </div>
                      {index === 0 && (
                        <div className="absolute -top-2 -right-2">
                          <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* コメント一覧 */}
          {videoStats && videoStats.tiger_stats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-7 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                    <MessageSquare size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">言及コメント一覧</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-500 dark:text-gray-400" />
                  <select
                    value={commentFilterTigerId}
                    onChange={(e) => setCommentFilterTigerId(e.target.value)}
                    className="px-4 py-2.5 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 shadow-sm transition-all hover:shadow-md"
                  >
                    <option value="all">全ての社長</option>
                    {videoStats.tiger_stats.map((stat) => (
                      <option key={stat.tiger_id} value={stat.tiger_id}>
                        {stat.display_name} ({stat.mention_count}件)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {comments && comments.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {comments.map((comment) => (
                    <div
                      key={comment.comment_id}
                      className="group p-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all border border-gray-100 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                            {(comment.author_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              {comment.author_name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(comment.published_at).toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-600 rounded-lg shadow-sm">
                          <ThumbsUp size={14} className="text-gray-600 dark:text-gray-300" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{comment.like_count || 0}</span>
                        </div>
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed mb-3 whitespace-pre-wrap">
                        {comment.text}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {comment.tiger_mentions.map((mention, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 dark:from-orange-900/30 dark:to-orange-800/20 dark:text-orange-300 rounded-lg border border-orange-200 dark:border-orange-700 shadow-sm"
                          >
                            <AtSign size={12} />
                            {mention.display_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="inline-flex p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                    <MessageSquare size={48} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">表示するコメントがありません</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Analysis
