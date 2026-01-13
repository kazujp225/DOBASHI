import { useState } from 'react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { videosApi, analysisApi, statsApi } from '../services/api'
import { Download, MessageCircle, Trash2, ChevronDown, ChevronUp, Users } from 'lucide-react'
import toast from 'react-hot-toast'

interface VideoStats {
  video_id: string
  title: string
  total_comments: number
  tiger_mention_comments: number
  tiger_stats: {
    tiger_id: string
    display_name: string
    mention_count: number
    rate_total: number
    rate_entity: number
    rank: number
  }[]
}

const Analysis = () => {
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // 分析済み動画一覧を取得
  const { data: analyzedVideos, isLoading: isLoadingVideos } = useQuery({
    queryKey: ['analyzedVideos'],
    queryFn: videosApi.getAnalyzed,
  })

  // 各動画の出演虎情報を取得
  const videoTigersQueries = useQueries({
    queries: (analyzedVideos || []).map((video) => ({
      queryKey: ['video-tigers', video.video_id],
      queryFn: () => analysisApi.getVideoTigers(video.video_id),
      enabled: !!analyzedVideos,
      staleTime: 5 * 60 * 1000,
    })),
  })

  // 各動画の統計情報を取得
  const videoStatsQueries = useQueries({
    queries: (analyzedVideos || []).map((video) => ({
      queryKey: ['videoStats', video.video_id],
      queryFn: () => statsApi.getVideoStats(video.video_id),
      enabled: !!analyzedVideos,
      staleTime: 5 * 60 * 1000,
    })),
  })

  // 削除処理
  const handleDeleteVideo = async (videoId: string, videoTitle: string) => {
    if (!window.confirm(`「${videoTitle}」を削除しますか？\n\n関連するコメントと分析結果も全て削除されます。`)) {
      return
    }

    try {
      await videosApi.delete(videoId)
      queryClient.invalidateQueries({ queryKey: ['analyzedVideos'] })
      toast.success('動画を削除しました')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '削除に失敗しました')
    }
  }

  // CSVエクスポート（縦持ち形式）
  const handleExportCSV = () => {
    if (!analyzedVideos || analyzedVideos.length === 0) {
      toast.error('エクスポートするデータがありません')
      return
    }

    const headers = ['video_id', 'video_title', 'total_comments', 'tiger_id', 'tiger_name', 'mention_count', 'rate_total']
    const rows: string[][] = []

    analyzedVideos.forEach((video, index) => {
      const statsData = videoStatsQueries[index]?.data as VideoStats | undefined
      const tigersData = videoTigersQueries[index]?.data

      if (!statsData || !tigersData) return

      // 出演虎のIDリスト
      const registeredTigerIds = tigersData.tigers.map(t => t.tiger_id)

      // 出演虎のみフィルタして出力
      statsData.tiger_stats
        .filter(stat => registeredTigerIds.includes(stat.tiger_id))
        .forEach(stat => {
          rows.push([
            video.video_id,
            `"${video.title.replace(/"/g, '""')}"`,
            String(statsData.total_comments),
            stat.tiger_id,
            stat.display_name,
            String(stat.mention_count),
            (stat.rate_total * 100).toFixed(2)
          ])
        })
    })

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `raw_data_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success('CSVをエクスポートしました')
  }

  // ローディング
  if (isLoadingVideos) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">動画分析</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            収集・分析済みの動画一覧（{analyzedVideos?.length || 0}件）
          </p>
        </div>
        {analyzedVideos && analyzedVideos.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl hover:from-orange-700 hover:to-orange-600 shadow-lg transition-all"
          >
            <Download size={18} />
            <span>CSVエクスポート</span>
          </button>
        )}
      </div>

      {/* 動画一覧テーブル */}
      {analyzedVideos && analyzedVideos.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  動画
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-28">
                  コメント数
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  出演虎と言及率
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {analyzedVideos.map((video, index) => {
                const statsData = videoStatsQueries[index]?.data as VideoStats | undefined
                const tigersData = videoTigersQueries[index]?.data
                const isExpanded = expandedVideoId === video.video_id

                // 出演虎のIDリスト
                const registeredTigerIds = tigersData?.tigers.map(t => t.tiger_id) || []

                // 出演虎のみの統計
                const filteredStats = statsData?.tiger_stats
                  .filter(stat => registeredTigerIds.includes(stat.tiger_id))
                  .sort((a, b) => b.rate_total - a.rate_total) || []

                return (
                  <tr
                    key={video.video_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {/* 動画情報 */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-24 h-14 object-cover rounded-lg shadow-sm flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                            {video.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {video.video_id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* コメント数 */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {statsData?.total_comments?.toLocaleString() || '-'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">件</span>
                      </div>
                    </td>

                    {/* 出演虎と言及率 */}
                    <td className="px-6 py-4">
                      {filteredStats.length > 0 ? (
                        <div>
                          {/* メイン表示（上位3名 or 全員） */}
                          <div className="flex flex-wrap gap-2">
                            {(isExpanded ? filteredStats : filteredStats.slice(0, 3)).map((stat, i) => (
                              <span
                                key={stat.tiger_id}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                                  i === 0
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <span>{stat.display_name}</span>
                                <span className="font-bold">{(stat.rate_total * 100).toFixed(1)}%</span>
                              </span>
                            ))}
                          </div>

                          {/* 展開ボタン */}
                          {filteredStats.length > 3 && (
                            <button
                              onClick={() => setExpandedVideoId(isExpanded ? null : video.video_id)}
                              className="mt-2 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp size={14} />
                                  閉じる
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={14} />
                                  他{filteredStats.length - 3}名を表示
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                          {tigersData?.has_registered ? '言及なし' : '出演虎未登録'}
                        </span>
                      )}
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleDeleteVideo(video.video_id, video.title)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="削除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <Users size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            分析済みの動画がありません
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            「データ収集」ページから動画を収集・分析してください
          </p>
        </div>
      )}

      {/* 説明 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">表示内容について</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>出演虎として登録された社長のみ表示されます</li>
          <li>言及率は「総コメント数に対するその社長への言及コメント数の割合」です</li>
          <li>CSVエクスポートで動画毎の生データをダウンロードできます</li>
        </ul>
      </div>
    </div>
  )
}

export default Analysis
