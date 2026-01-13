import { useState } from 'react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { videosApi, analysisApi, statsApi } from '../services/api'
import { Download, Trash2, ChevronDown, ChevronUp, Users, X, MessageSquare, BarChart3, ExternalLink } from 'lucide-react'
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

interface AnalyzedComment {
  comment_id: string
  text: string
  author_name: string
  like_count: number
  tiger_mentions: { tiger_id: string; display_name: string }[]
}

const Analysis = () => {
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<{ video_id: string; title: string; thumbnail_url?: string } | null>(null)
  const [selectedTigerId, setSelectedTigerId] = useState<string | null>(null)
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

  // 選択された動画のコメントを取得
  const { data: comments, isLoading: isLoadingComments } = useQuery({
    queryKey: ['comments', selectedVideo?.video_id, selectedTigerId],
    queryFn: () => analysisApi.getComments(selectedVideo!.video_id, selectedTigerId || undefined),
    enabled: !!selectedVideo,
    staleTime: 5 * 60 * 1000,
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

  // 動画詳細を開く
  const openVideoDetail = (video: { video_id: string; title: string; thumbnail_url?: string }) => {
    setSelectedVideo(video)
    setSelectedTigerId(null)
  }

  // 詳細モーダルを閉じる
  const closeVideoDetail = () => {
    setSelectedVideo(null)
    setSelectedTigerId(null)
  }

  // 選択中の動画のインデックス取得
  const getSelectedVideoIndex = () => {
    if (!selectedVideo || !analyzedVideos) return -1
    return analyzedVideos.findIndex(v => v.video_id === selectedVideo.video_id)
  }

  // ローディング
  if (isLoadingVideos) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  const selectedVideoIndex = getSelectedVideoIndex()
  const selectedVideoStats = selectedVideoIndex >= 0 ? videoStatsQueries[selectedVideoIndex]?.data as VideoStats | undefined : undefined
  const selectedVideoTigers = selectedVideoIndex >= 0 ? videoTigersQueries[selectedVideoIndex]?.data : undefined

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">動画分析</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
            収集・分析済みの動画一覧（{analyzedVideos?.length || 0}件）
          </p>
        </div>
        {analyzedVideos && analyzedVideos.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl hover:from-orange-700 hover:to-orange-600 shadow-lg transition-all w-full sm:w-auto"
          >
            <Download size={18} />
            <span>CSVエクスポート</span>
          </button>
        )}
      </div>

      {/* 動画一覧 */}
      {analyzedVideos && analyzedVideos.length > 0 ? (
        <>
          {/* モバイル: カード表示 */}
          <div className="sm:hidden space-y-3">
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
                <div
                  key={video.video_id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* サムネイルとタイトル（クリック可能） */}
                  <div
                    className="flex gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => openVideoDetail(video)}
                  >
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-28 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                        {video.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {statsData?.total_comments?.toLocaleString() || '-'}件のコメント
                      </p>
                    </div>
                  </div>

                  {/* 出演虎と言及率 */}
                  <div className="px-3 pb-3">
                    {filteredStats.length > 0 ? (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">出演虎と言及率</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(isExpanded ? filteredStats : filteredStats.slice(0, 4)).map((stat, i) => (
                            <span
                              key={stat.tiger_id}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
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
                        {filteredStats.length > 4 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedVideoId(isExpanded ? null : video.video_id)
                            }}
                            className="mt-2 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp size={14} />
                                閉じる
                              </>
                            ) : (
                              <>
                                <ChevronDown size={14} />
                                他{filteredStats.length - 4}名を表示
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {tigersData?.has_registered ? '言及なし' : '出演虎未登録'}
                      </p>
                    )}
                  </div>

                  {/* 詳細・削除ボタン */}
                  <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex justify-between">
                    <button
                      onClick={() => openVideoDetail(video)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <MessageSquare size={14} />
                      コメント詳細
                    </button>
                    <button
                      onClick={() => handleDeleteVideo(video.video_id, video.title)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                      削除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* デスクトップ: テーブル表示 */}
          <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    動画
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">
                    コメント数
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    出演虎と言及率
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">
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
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onClick={() => openVideoDetail(video)}
                    >
                      {/* 動画情報 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-20 h-12 object-cover rounded-lg shadow-sm flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                              {video.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {video.video_id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* コメント数 */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-base font-bold text-gray-900 dark:text-white">
                            {statsData?.total_comments?.toLocaleString() || '-'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">件</span>
                        </div>
                      </td>

                      {/* 出演虎と言及率 */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {filteredStats.length > 0 ? (
                          <div>
                            {/* メイン表示（上位3名 or 全員） */}
                            <div className="flex flex-wrap gap-1.5">
                              {(isExpanded ? filteredStats : filteredStats.slice(0, 3)).map((stat, i) => (
                                <span
                                  key={stat.tiger_id}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
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
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedVideoId(isExpanded ? null : video.video_id)
                                }}
                                className="mt-1.5 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
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
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openVideoDetail(video)}
                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="詳細"
                          >
                            <MessageSquare size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteVideo(video.video_id, video.title)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="削除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 sm:p-16 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <Users size={24} className="text-gray-400 sm:hidden" />
            <Users size={32} className="text-gray-400 hidden sm:block" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
            分析済みの動画がありません
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            「データ収集」ページから動画を収集・分析してください
          </p>
        </div>
      )}

      {/* 説明 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 sm:p-6">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2 text-sm sm:text-base">表示内容について</h3>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-blue-800 dark:text-blue-200">
          <li>動画をタップすると詳細なコメントデータを確認できます</li>
          <li>言及率は「総コメント数に対するその社長への言及コメント数の割合」です</li>
          <li>CSVエクスポートで動画毎の生データをダウンロードできます</li>
        </ul>
      </div>

      {/* 詳細モーダル */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* オーバーレイ */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={closeVideoDetail}
            />

            {/* モーダル */}
            <div className="inline-block w-full max-w-4xl my-8 text-left align-middle transition-all transform bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
              {/* ヘッダー */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex items-start gap-4">
                <img
                  src={selectedVideo.thumbnail_url}
                  alt={selectedVideo.title}
                  className="w-24 sm:w-32 h-14 sm:h-20 object-cover rounded-lg flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                    {selectedVideo.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {selectedVideoStats?.total_comments?.toLocaleString() || '-'}件のコメント
                    </span>
                    <a
                      href={`https://www.youtube.com/watch?v=${selectedVideo.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      YouTube
                    </a>
                  </div>
                </div>
                <button
                  onClick={closeVideoDetail}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* コンテンツ */}
              <div className="px-4 sm:px-6 py-4 max-h-[70vh] overflow-y-auto">
                {/* 虎別統計 */}
                {selectedVideoStats && selectedVideoTigers && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <BarChart3 size={16} />
                      出演虎別の統計
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      <button
                        onClick={() => setSelectedTigerId(null)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedTigerId === null
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        全て
                      </button>
                      {selectedVideoStats.tiger_stats
                        .filter(stat => selectedVideoTigers.tigers.some(t => t.tiger_id === stat.tiger_id))
                        .sort((a, b) => b.mention_count - a.mention_count)
                        .map((stat) => (
                          <button
                            key={stat.tiger_id}
                            onClick={() => setSelectedTigerId(stat.tiger_id)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                              selectedTigerId === stat.tiger_id
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            <div className="truncate">{stat.display_name}</div>
                            <div className="text-xs opacity-80">{stat.mention_count}件</div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* コメント一覧 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <MessageSquare size={16} />
                    {selectedTigerId ? `${selectedVideoStats?.tiger_stats.find(s => s.tiger_id === selectedTigerId)?.display_name}への言及コメント` : '言及コメント'}
                    {comments && <span className="text-gray-500 font-normal">（{comments.length}件）</span>}
                  </h3>

                  {isLoadingComments ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
                    </div>
                  ) : comments && comments.length > 0 ? (
                    <div className="space-y-3">
                      {comments.slice(0, 50).map((comment: AnalyzedComment) => (
                        <div
                          key={comment.comment_id}
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {comment.author_name}
                            </span>
                            {comment.like_count > 0 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ❤️ {comment.like_count}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                            {comment.text}
                          </p>
                          {comment.tiger_mentions && comment.tiger_mentions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {comment.tiger_mentions.map((mention) => (
                                <span
                                  key={mention.tiger_id}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                                >
                                  {mention.display_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {comments.length > 50 && (
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                          他 {comments.length - 50}件のコメントがあります
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>コメントデータがありません</p>
                      <p className="text-xs mt-2">データ収集ページから再収集してください</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Analysis
