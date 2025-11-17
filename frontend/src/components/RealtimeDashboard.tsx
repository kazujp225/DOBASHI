import React, { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Activity, TrendingUp, Users, MessageSquare } from 'lucide-react'

interface RealtimeStats {
  timestamp: string
  total_videos: number
  total_comments: number
  top_tigers: Array<{
    tiger_id: string
    display_name: string
    mentions: number
  }>
  recent_sentiment: {
    positive: number
    negative: number
    neutral: number
  }
  latest_videos: Array<{
    video_id: string
    title: string
    comment_count: number
  }>
}

export default function RealtimeDashboard() {
  const [stats, setStats] = useState<RealtimeStats | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    // WebSocket接続
    const wsUrl = `ws://localhost:8000/ws`

    try {
      ws.current = new WebSocket(wsUrl)

      ws.current.onopen = () => {
        console.log('WebSocket接続成功')
        setIsConnected(true)
        setConnectionError(null)

        // 更新の購読開始
        ws.current?.send(JSON.stringify({
          type: 'subscribe_updates'
        }))
      }

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'stats_update' || data.type === 'connection_established') {
          setStats(data.data)
        }
      }

      ws.current.onerror = (error) => {
        console.error('WebSocketエラー:', error)
        setConnectionError('接続エラーが発生しました')
        setIsConnected(false)
      }

      ws.current.onclose = () => {
        console.log('WebSocket接続が切断されました')
        setIsConnected(false)
      }
    } catch (error) {
      console.error('WebSocket接続失敗:', error)
      setConnectionError('WebSocket接続に失敗しました')
    }

    // クリーンアップ
    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])

  // 感情分析の円グラフ用データ
  const getSentimentPercentage = (sentiment: 'positive' | 'negative' | 'neutral') => {
    if (!stats?.recent_sentiment) return 0
    const total = stats.recent_sentiment.positive + stats.recent_sentiment.negative + stats.recent_sentiment.neutral
    if (total === 0) return 0
    return Math.round((stats.recent_sentiment[sentiment] / total) * 100)
  }

  return (
    <div className="space-y-6">
      {/* 接続状態表示 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">リアルタイムダッシュボード</h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isConnected ? '接続中' : '切断'}
          </span>
        </div>
      </div>

      {connectionError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{connectionError}</p>
        </div>
      )}

      {stats && (
        <>
          {/* 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総動画数</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_videos}</div>
                <p className="text-xs text-muted-foreground">
                  最新動画を含む
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総コメント数</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.total_comments.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  全動画の合計
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ポジティブ率</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getSentimentPercentage('positive')}%</div>
                <p className="text-xs text-muted-foreground">
                  最新コメントの感情
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">注目社長</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.top_tigers[0]?.display_name || '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  言及数: {stats.top_tigers[0]?.mentions || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* トップ社長ランキング */}
          <Card>
            <CardHeader>
              <CardTitle>🏆 社長ランキング（リアルタイム）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.top_tigers.map((tiger, index) => (
                  <div key={tiger.tiger_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-white font-bold
                        ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-600'}
                      `}>
                        {index + 1}
                      </div>
                      <span className="font-medium">{tiger.display_name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{tiger.mentions} 回</div>
                      <div className="text-sm text-gray-500">言及</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 最新動画 */}
          <Card>
            <CardHeader>
              <CardTitle>📹 最新動画</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.latest_videos.map((video) => (
                  <div key={video.video_id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium line-clamp-1">{video.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        コメント数: {video.comment_count.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 更新時刻 */}
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            最終更新: {new Date(stats.timestamp).toLocaleTimeString('ja-JP')}
          </div>
        </>
      )}
    </div>
  )
}