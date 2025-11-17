import { useQuery } from '@tanstack/react-query'
import { tigersApi, statsApi } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, Video, MessageSquare, Download } from 'lucide-react'
import { exportToCSV, formatRankingForCSV } from '../utils/csv'
import toast from 'react-hot-toast'
import RealtimeDashboard from '../components/RealtimeDashboard'

const Dashboard = () => {
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

  const handleExportCSV = () => {
    if (!ranking || ranking.tiger_rankings.length === 0) {
      toast.error('エクスポートするデータがありません')
      return
    }

    const csvData = formatRankingForCSV(ranking.tiger_rankings)
    exportToCSV(csvData, `社長別ランキング_${new Date().toISOString().split('T')[0]}`)
    toast.success('CSVをエクスポートしました')
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">ダッシュボード</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">分析結果の概要</p>
        </div>
        {ranking && ranking.tiger_rankings.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 shadow-md"
          >
            <Download size={20} />
            <span>CSVエクスポート</span>
          </button>
        )}
      </div>

      {/* クイックスタッツ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">登録社長数</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {tigers?.length || 0}名
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Video className="text-orange-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">分析動画数</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {ranking?.total_videos || 0}件
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transform transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">総コメント数</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {ranking?.tiger_rankings
                  ?.reduce((sum, t) => sum + t.total_mentions, 0)
                  .toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <MessageSquare className="text-green-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* ランキング */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            社長別ランキング（全期間）
          </h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">読み込み中...</p>
          </div>
        ) : ranking && ranking.tiger_rankings.length > 0 ? (
          <div className="p-6 space-y-6">
            {/* グラフ */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ranking.tiger_rankings.slice(0, 5)}>
                <XAxis dataKey="display_name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_mentions" fill="#f97316">
                  {ranking.tiger_rankings.slice(0, 5).map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* テーブル */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50">
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
                  {ranking.tiger_rankings.map((item, index) => (
                    <tr key={item.tiger_id} className={`${index < 3 ? 'bg-orange-50' : ''} hover:bg-orange-100 transition-colors`}>
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
            <p className="text-gray-500 dark:text-gray-400">データがありません</p>
            <p className="mt-2 text-sm text-gray-400">
              データ収集ページから動画を収集してください
            </p>
          </div>
        )}
      </div>

      {/* リアルタイムダッシュボード */}
      <RealtimeDashboard />
    </div>
  )
}

export default Dashboard
