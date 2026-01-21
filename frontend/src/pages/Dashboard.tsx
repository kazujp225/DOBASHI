import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { tigersApi, statsApi } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, Video, MessageSquare, Download, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

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

  // グラフ用のカラーパレット（落ち着いた色調）
  const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

  const handleExportCSV = () => {
    navigate('/analysis')
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">1位</Badge>
    if (rank === 2) return <Badge className="bg-slate-400 hover:bg-slate-400 text-white">2位</Badge>
    if (rank === 3) return <Badge className="bg-orange-600 hover:bg-orange-600 text-white">3位</Badge>
    return <Badge variant="secondary">{rank}位</Badge>
  }

  const stats = [
    {
      title: '登録社長数',
      value: `${tigers?.length || 0}名`,
      icon: Video,
    },
    {
      title: '分析動画数',
      value: `${ranking?.total_videos || 0}件`,
      icon: TrendingUp,
    },
    {
      title: '総コメント数',
      value: ranking?.tiger_rankings
        ?.reduce((sum, t) => sum + t.total_mentions, 0)
        .toLocaleString() || '0',
      icon: MessageSquare,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-muted-foreground">分析結果の概要</p>
        </div>
        {ranking && ranking.tiger_rankings.length > 0 && (
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            CSVエクスポート
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            社長別ランキング（全期間）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[250px] w-full" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : ranking && ranking.tiger_rankings.length > 0 ? (
            <div className="space-y-6">
              {/* Chart */}
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ranking.tiger_rankings.slice(0, 5)} margin={{ left: -20, right: 10 }}>
                  <XAxis dataKey="display_name" tick={{ fontSize: 12 }} interval={0} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="total_mentions" radius={[4, 4, 0, 0]}>
                    {ranking.tiger_rankings.slice(0, 5).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Mobile Cards */}
              <div className="space-y-2 sm:hidden">
                {ranking.tiger_rankings.map((item) => (
                  <div
                    key={item.tiger_id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {getRankBadge(item.rank)}
                      <div>
                        <p className="font-medium">{item.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.total_videos}動画出演
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{item.total_mentions.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {(item.avg_rate_total * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">順位</TableHead>
                      <TableHead>社長名</TableHead>
                      <TableHead className="text-right">言及回数</TableHead>
                      <TableHead className="text-right">出演動画数</TableHead>
                      <TableHead className="text-right">平均Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.tiger_rankings.map((item) => (
                      <TableRow key={item.tiger_id}>
                        <TableCell>{getRankBadge(item.rank)}</TableCell>
                        <TableCell className="font-medium">{item.display_name}</TableCell>
                        <TableCell className="text-right">
                          {item.total_mentions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.total_videos}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(item.avg_rate_total * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">データがありません</p>
              <p className="mt-2 text-sm text-muted-foreground">
                データ収集ページから動画を収集してください
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
