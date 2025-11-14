import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { videosApi, tigersApi, analysisApi, statsApi } from '../services/api'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Search, TrendingUp } from 'lucide-react'

const Analysis = () => {
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedTigers, setSelectedTigers] = useState<string[]>([])

  const { data: videos } = useQuery({
    queryKey: ['videos'],
    queryFn: videosApi.getAll,
  })

  const { data: tigers } = useQuery({
    queryKey: ['tigers'],
    queryFn: tigersApi.getAll,
  })

  const { data: videoStats } = useQuery({
    queryKey: ['videoStats', selectedVideoId],
    queryFn: () => statsApi.getVideoStats(selectedVideoId),
    enabled: !!selectedVideoId,
  })

  const analyzeMutation = useMutation({
    mutationFn: analysisApi.analyze,
    onSuccess: () => {
      // 統計を再取得
      if (selectedVideoId) {
        statsApi.getVideoStats(selectedVideoId)
      }
    },
  })

  const handleAnalyze = () => {
    if (!selectedVideoId || selectedTigers.length === 0) return

    analyzeMutation.mutate({
      video_id: selectedVideoId,
      tiger_ids: selectedTigers,
    })
  }

  const colors = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5']

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">動画分析</h1>
        <p className="mt-2 text-gray-600">収集済み動画のコメントを社長別に分析します</p>
      </div>

      {/* 分析設定 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">分析設定</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* 動画選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分析する動画を選択
            </label>
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">動画を選択してください</option>
              {videos?.map((video) => (
                <option key={video.video_id} value={video.video_id}>
                  {video.title}
                </option>
              ))}
            </select>
          </div>

          {/* 社長選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              出演社長を選択（複数選択可）
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {tigers?.map((tiger) => (
                <label
                  key={tiger.tiger_id}
                  className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTigers.includes(tiger.tiger_id)
                      ? 'bg-orange-50 border-orange-500'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTigers.includes(tiger.tiger_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTigers([...selectedTigers, tiger.tiger_id])
                      } else {
                        setSelectedTigers(selectedTigers.filter((id) => id !== tiger.tiger_id))
                      }
                    }}
                    className="rounded text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium">{tiger.display_name}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!selectedVideoId || selectedTigers.length === 0 || analyzeMutation.isPending}
            className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Search size={20} />
            <span>{analyzeMutation.isPending ? '分析中...' : '分析を開始'}</span>
          </button>
        </div>
      </div>

      {/* 分析結果 */}
      {videoStats && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">分析結果</h2>
          </div>

          <div className="p-6 space-y-6">
            {/* サマリー */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">総コメント数</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {videoStats.total_comments.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">社長言及コメント</p>
                <p className="mt-1 text-2xl font-bold text-orange-600">
                  {videoStats.tiger_mention_comments.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">言及率</p>
                <p className="mt-1 text-2xl font-bold text-blue-600">
                  {((videoStats.tiger_mention_comments / videoStats.total_comments) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* グラフ */}
            {videoStats.tiger_stats.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-4">社長別言及数</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={videoStats.tiger_stats}
                      dataKey="mention_count"
                      nameKey="display_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {videoStats.tiger_stats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 詳細テーブル */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">順位</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">社長名</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">言及数</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate_total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate_entity</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {videoStats.tiger_stats.map((stat) => (
                    <tr key={stat.tiger_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {stat.rank}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {stat.display_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {stat.mention_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                        {(stat.rate_total * 100).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                        {(stat.rate_entity * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Analysis
