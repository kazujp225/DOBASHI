import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { videosApi, tigersApi, analysisApi, statsApi } from '../services/api'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Search, Download, Video, MessageCircle, AtSign, Percent, PieChart as PieChartIcon, Trophy, MessageSquare, Filter, ThumbsUp, Check, TrendingUp, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportToCSV, formatVideoStatsForCSV } from '../utils/csv'

const Analysis = () => {
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [commentFilterTigerId, setCommentFilterTigerId] = useState<string>('all')
  const [commentSortOrder, setCommentSortOrder] = useState<'likes' | 'newest'>('likes')
  const [isExtracting, setIsExtracting] = useState(false)

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
      toast.success('分析が完了しました')
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (Array.isArray(detail)) {
        toast.error(detail[0]?.msg || '分析に失敗しました')
      } else {
        toast.error(detail || '分析に失敗しました')
      }
    },
  })

  // 分析開始ボタン押下時：全社長を自動選択して即分析
  const handleStartAnalysis = () => {
    if (!selectedVideoId) {
      toast.error('動画を選択してください')
      return
    }
    if (!tigers || tigers.length === 0) {
      toast.error('社長マスタが空です。先に社長を登録してください。')
      return
    }

    const allTigerIds = tigers.map((t) => t.tiger_id)
    setIsExtracting(true)

    analyzeMutation.mutate(
      {
        video_id: selectedVideoId,
        tiger_ids: allTigerIds,
      },
      {
        onSettled: () => setIsExtracting(false),
      }
    )
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

  const colors = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#9ca3af']

  // コメントをソート
  const sortedComments = useMemo(() => {
    if (!comments) return []
    const sorted = [...comments]
    if (commentSortOrder === 'likes') {
      sorted.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    } else {
      sorted.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    }
    return sorted
  }, [comments, commentSortOrder])

  // シェア表示用データ（1%未満は「その他社長」に集約）
  const shareData = useMemo(() => {
    if (!videoStats || !videoStats.tiger_stats) return []
    const total = videoStats.tiger_stats.reduce((sum, s) => sum + s.mention_count, 0)
    if (total === 0) return []
    const threshold = total * 0.01
    const major = videoStats.tiger_stats.filter((s) => s.mention_count >= threshold)
    const otherCount = videoStats.tiger_stats
      .filter((s) => s.mention_count < threshold)
      .reduce((sum, s) => sum + s.mention_count, 0)
    if (otherCount > 0) {
      major.push({
        tiger_id: 'others',
        display_name: 'その他社長',
        mention_count: otherCount,
        rate_total: otherCount / total,
        rate_entity: otherCount / total,
        rank: major.length + 1,
      })
    }
    return major
  }, [videoStats])

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
              {videos?.map((video) => {
                const isAnalyzing = isExtracting || analyzeMutation.isPending
                const isDisabled = isAnalyzing && selectedVideoId !== video.video_id
                return (
                <div
                  key={video.video_id}
                  onClick={() => !isDisabled && setSelectedVideoId(video.video_id)}
                  className={`group flex gap-4 p-4 rounded-xl transition-all ${
                    isDisabled
                      ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                      : selectedVideoId === video.video_id
                        ? 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 ring-2 ring-orange-500 shadow-lg cursor-pointer'
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md cursor-pointer'
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
              );
              })}
            </div>
          </div>

          {/* 分析ボタン */}
          <button
            onClick={handleStartAnalysis}
            disabled={!selectedVideoId || isExtracting || analyzeMutation.isPending}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-base font-semibold rounded-xl hover:from-orange-700 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all hover:-translate-y-0.5 disabled:shadow-none disabled:translate-y-0"
          >
            <Search size={20} />
            <span>{isExtracting || analyzeMutation.isPending ? '分析を実行中...' : '分析を開始'}</span>
          </button>
        </div>
      </div>

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
                      data={shareData as any}
                      dataKey="mention_count"
                      nameKey="display_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {shareData.map((_entry, index) => (
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
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                    <MessageSquare size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">言及コメント一覧</h3>
                  {sortedComments.length > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">({sortedComments.length}件)</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* ソート切り替え */}
                  <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                    <button
                      onClick={() => setCommentSortOrder('likes')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        commentSortOrder === 'likes'
                          ? 'bg-white dark:bg-gray-600 text-orange-600 dark:text-orange-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <TrendingUp size={16} />
                      <span>いいね順</span>
                    </button>
                    <button
                      onClick={() => setCommentSortOrder('newest')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        commentSortOrder === 'newest'
                          ? 'bg-white dark:bg-gray-600 text-orange-600 dark:text-orange-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <Clock size={16} />
                      <span>新着順</span>
                    </button>
                  </div>
                  {/* フィルター */}
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
              </div>

              {sortedComments.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {sortedComments.map((comment, index) => (
                    <div
                      key={comment.comment_id}
                      className={`group p-5 rounded-xl hover:shadow-lg transition-all border ${
                        commentSortOrder === 'likes' && index === 0
                          ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-orange-300 dark:border-orange-700 ring-2 ring-orange-400/50'
                          : commentSortOrder === 'likes' && index < 3
                            ? 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700'
                      }`}
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
                        <div className="flex items-center gap-2">
                          {commentSortOrder === 'likes' && index < 3 && (
                            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              index === 0 ? 'bg-yellow-400 text-yellow-900' :
                              index === 1 ? 'bg-gray-300 text-gray-700' :
                              'bg-orange-300 text-orange-800'
                            }`}>
                              {index + 1}
                            </div>
                          )}
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm ${
                            commentSortOrder === 'likes' && index === 0
                              ? 'bg-orange-100 dark:bg-orange-800/50'
                              : 'bg-white dark:bg-gray-600'
                          }`}>
                            <ThumbsUp size={14} className={commentSortOrder === 'likes' && index === 0 ? 'text-orange-600' : 'text-gray-600 dark:text-gray-300'} />
                            <span className={`text-sm font-bold ${
                              commentSortOrder === 'likes' && index === 0 ? 'text-orange-600' : 'text-gray-700 dark:text-gray-200'
                            }`}>{comment.like_count || 0}</span>
                          </div>
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
