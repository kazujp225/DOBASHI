import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { tigersApi, statsApi } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, Video, MessageSquare, Download } from 'lucide-react'

const Dashboard = () => {
  const navigate = useNavigate()

  const { data: tigers, isLoading: tigersLoading } = useQuery({
    queryKey: ['tigers'],
    queryFn: tigersApi.getAll,
  })

  const { data: ranking, isLoading: rankingLoading } = useQuery({
    queryKey: ['ranking'],
    queryFn: () => statsApi.getRanking('all'),
  })

  const isLoading = tigersLoading || rankingLoading

  // グラフ用のカラーパレット
  const colors = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5']

  // CSVエクスポートは動画分析ページへ誘導
  const handleExportCSV = () => {
    navigate('/analysis')
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn w-full">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">ダッシュボード</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">分析結果の概要</p>
        </div>
        {ranking && ranking.tiger_rankings.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all transform hover:scale-105 shadow-md text-sm sm:text-base w-full sm:w-auto"
          >
            <Download size={18} />
            <span>CSVエクスポート（動画分析へ）</span>
          </button>
        )}
      </div>

      {/* クイックスタッツ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">登録社長数</p>
              <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {tigers?.length || 0}名
              </p>
            </div>
            <div className="bg-orange-100 p-2 sm:p-3 rounded-full">
              <Video className="text-orange-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">分析動画数</p>
              <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {ranking?.total_videos || 0}件
              </p>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
              <TrendingUp className="text-blue-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">総コメント数</p>
              <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {ranking?.tiger_rankings
                  ?.reduce((sum, t) => sum + t.total_mentions, 0)
                  .toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-full">
              <MessageSquare className="text-green-600" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* ランキング */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            社長別ランキング（全期間）
          </h2>
        </div>

        {isLoading ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-orange-500"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 text-sm sm:text-base">読み込み中...</p>
          </div>
        ) : ranking && ranking.tiger_rankings.length > 0 ? (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* グラフ */}
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ranking.tiger_rankings.slice(0, 5)} margin={{ left: -20, right: 10 }}>
                <XAxis
                  dataKey="display_name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total_mentions" fill="#f97316">
                  {ranking.tiger_rankings.slice(0, 5).map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* モバイル: カード表示 */}
            <div className="sm:hidden space-y-3">
              {ranking.tiger_rankings.map((item, index) => {
                const cardStyle =
                  index === 0
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                    : index === 1
                      ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                      : index === 2
                        ? 'bg-orange-50 dark:bg-orange-900/15 border-orange-200 dark:border-orange-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'

                const rankStyle =
                  index === 0
                    ? 'bg-amber-500 text-white'
                    : index === 1
                      ? 'bg-gray-400 text-white'
                      : index === 2
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'

                return (
                  <div
                    key={item.tiger_id}
                    className={`${cardStyle} border rounded-lg p-3`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${rankStyle}`}>
                        {item.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {item.display_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.total_videos}動画出演
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {item.total_mentions.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(item.avg_rate_total * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* デスクトップ: テーブル表示 */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      順位
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      社長名
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      言及回数
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      出演動画数
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      平均Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {ranking.tiger_rankings.map((item, index) => {
                    const rowStyle =
                      index === 0
                        ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                        : index === 1
                          ? 'bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          : index === 2
                            ? 'bg-orange-50 dark:bg-orange-900/15 hover:bg-orange-100 dark:hover:bg-orange-900/25'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'

                    const rankStyle =
                      index === 0
                        ? 'bg-amber-500 text-white'
                        : index === 1
                          ? 'bg-gray-400 text-white'
                          : index === 2
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'

                    return (
                      <tr
                        key={item.tiger_id}
                        className={`${rowStyle} transition-colors`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${rankStyle}`}>
                            {item.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.display_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {item.total_mentions.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                          {item.total_videos}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                          {(item.avg_rate_total * 100).toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 sm:p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">データがありません</p>
            <p className="mt-2 text-sm text-gray-400">
              データ収集ページから動画を収集してください
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
