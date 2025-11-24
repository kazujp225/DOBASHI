import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Calendar, Video, MessageSquare, Users, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { exportToCSV, formatRankingForCSV } from '../utils/csv'
import toast from 'react-hot-toast'

const MonthlyRanking = () => {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  // 利用可能な月一覧を取得
  const { data: availableMonths, isLoading: monthsLoading } = useQuery({
    queryKey: ['availableMonths'],
    queryFn: statsApi.getAvailableMonths,
  })

  // 最初のデータがロードされたら最新の月を選択
  useEffect(() => {
    if (availableMonths?.months && availableMonths.months.length > 0 && !selectedYear) {
      const latest = availableMonths.months[0]
      setSelectedYear(latest.year)
      setSelectedMonth(latest.month)
    }
  }, [availableMonths, selectedYear])

  // 選択した月の統計を取得
  const { data: monthlyStats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['monthlyStats', selectedYear, selectedMonth],
    queryFn: () => statsApi.getMonthlyStats(selectedYear!, selectedMonth!),
    enabled: !!selectedYear && !!selectedMonth,
  })

  // グラフ用のカラーパレット
  const colors = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5']

  const handleExportCSV = () => {
    if (!monthlyStats || monthlyStats.tiger_rankings.length === 0) {
      toast.error('エクスポートするデータがありません')
      return
    }

    const csvData = formatRankingForCSV(monthlyStats.tiger_rankings)
    exportToCSV(csvData, `社長別ランキング_${selectedYear}年${selectedMonth}月`)
    toast.success('CSVをエクスポートしました')
  }

  // 前月に移動
  const goPrevMonth = () => {
    if (!availableMonths?.months) return
    const currentIndex = availableMonths.months.findIndex(
      m => m.year === selectedYear && m.month === selectedMonth
    )
    if (currentIndex < availableMonths.months.length - 1) {
      const prev = availableMonths.months[currentIndex + 1]
      setSelectedYear(prev.year)
      setSelectedMonth(prev.month)
    }
  }

  // 次月に移動
  const goNextMonth = () => {
    if (!availableMonths?.months) return
    const currentIndex = availableMonths.months.findIndex(
      m => m.year === selectedYear && m.month === selectedMonth
    )
    if (currentIndex > 0) {
      const next = availableMonths.months[currentIndex - 1]
      setSelectedYear(next.year)
      setSelectedMonth(next.month)
    }
  }

  const isFirstMonth = availableMonths?.months?.findIndex(
    m => m.year === selectedYear && m.month === selectedMonth
  ) === (availableMonths?.months?.length || 1) - 1

  const isLastMonth = availableMonths?.months?.findIndex(
    m => m.year === selectedYear && m.month === selectedMonth
  ) === 0

  if (monthsLoading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">読み込み中...</p>
      </div>
    )
  }

  if (!availableMonths?.months || availableMonths.months.length === 0) {
    return (
      <div className="space-y-8 animate-fadeIn">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">月別ランキング</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">月ごとの社長言及ランキング</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Calendar className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-500 dark:text-gray-400">データがありません</p>
          <p className="mt-2 text-sm text-gray-400">
            データ収集ページから動画を収集してください
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">月別ランキング</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">月ごとの社長言及ランキング</p>
        </div>
        {monthlyStats && monthlyStats.tiger_rankings.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 shadow-md"
          >
            <Download size={20} />
            <span>CSVエクスポート</span>
          </button>
        )}
      </div>

      {/* 月選択 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={goPrevMonth}
            disabled={isFirstMonth}
            className={`p-2 rounded-lg transition-colors ${
              isFirstMonth
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <ChevronLeft size={24} />
          </button>

          <div className="flex items-center space-x-4">
            <select
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              {Array.from(new Set(availableMonths.months.map(m => m.year))).map(year => (
                <option key={year} value={year}>{year}年</option>
              ))}
            </select>

            <select
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              {availableMonths.months
                .filter(m => m.year === selectedYear)
                .map(m => (
                  <option key={m.month} value={m.month}>{m.month}月</option>
                ))}
            </select>
          </div>

          <button
            onClick={goNextMonth}
            disabled={isLastMonth}
            className={`p-2 rounded-lg transition-colors ${
              isLastMonth
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {statsLoading ? (
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      ) : statsError ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-red-500">データの取得に失敗しました</p>
        </div>
      ) : monthlyStats ? (
        <>
          {/* 月別サマリー */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">動画数</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {monthlyStats.video_count}本
                  </p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                  <Video className="text-blue-600 dark:text-blue-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">総コメント数</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {monthlyStats.total_comments.toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                  <MessageSquare className="text-green-600 dark:text-green-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">言及コメント数</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {monthlyStats.mention_comments.toLocaleString()}
                  </p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                  <Users className="text-orange-600 dark:text-orange-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">言及率</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {monthlyStats.total_comments > 0
                      ? ((monthlyStats.mention_comments / monthlyStats.total_comments) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                  <Calendar className="text-purple-600 dark:text-purple-400" size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* ランキング */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {monthlyStats.label} 社長別ランキング
              </h2>
            </div>

            {monthlyStats.tiger_rankings.length > 0 ? (
              <div className="p-6 space-y-6">
                {/* グラフ */}
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyStats.tiger_rankings.slice(0, 5)} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="display_name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="total_mentions" fill="#f97316">
                      {monthlyStats.tiger_rankings.slice(0, 5).map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* テーブル */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          順位
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          社長名
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          言及回数
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          出演動画数
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          平均Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {monthlyStats.tiger_rankings.map((item, index) => (
                        <tr
                          key={item.tiger_id}
                          className={`${index < 3 ? 'bg-orange-50 dark:bg-orange-900/20' : ''} hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-lg font-bold ${
                              index === 0 ? 'text-yellow-500' :
                              index === 1 ? 'text-gray-400' :
                              index === 2 ? 'text-orange-700' :
                              'text-gray-900 dark:text-white'
                            }`}>
                              {item.rank}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {item.display_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                            {item.total_mentions.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                            {item.total_videos}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                            {(item.avg_rate_total * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">この月のランキングデータがありません</p>
              </div>
            )}
          </div>

          {/* 動画一覧 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {monthlyStats.label} の動画一覧
              </h2>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {monthlyStats.videos.map((video) => (
                <div key={video.video_id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-start space-x-4">
                    {video.thumbnail_url && (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-32 h-18 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {video.title}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {video.published_at
                          ? new Date(video.published_at).toLocaleDateString('ja-JP')
                          : '日付不明'}
                      </p>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center">
                          <MessageSquare size={12} className="mr-1" />
                          総コメント: {video.total_comments.toLocaleString()}
                        </span>
                        <span className="flex items-center">
                          <Users size={12} className="mr-1" />
                          言及: {video.mention_comments.toLocaleString()}
                        </span>
                        <span>
                          言及率: {video.total_comments > 0
                            ? ((video.mention_comments / video.total_comments) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default MonthlyRanking
