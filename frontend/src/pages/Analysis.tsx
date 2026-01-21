import { useState } from 'react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { videosApi, analysisApi, statsApi } from '../services/api'
import { Download, Trash2, ChevronDown, ChevronUp, Users, MessageSquare, BarChart3, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

  const { data: analyzedVideos, isLoading: isLoadingVideos } = useQuery({
    queryKey: ['analyzedVideos'],
    queryFn: videosApi.getAnalyzed,
  })

  const videoTigersQueries = useQueries({
    queries: (analyzedVideos || []).map((video) => ({
      queryKey: ['video-tigers', video.video_id],
      queryFn: () => analysisApi.getVideoTigers(video.video_id),
      enabled: !!analyzedVideos,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const videoStatsQueries = useQueries({
    queries: (analyzedVideos || []).map((video) => ({
      queryKey: ['videoStats', video.video_id],
      queryFn: () => statsApi.getVideoStats(video.video_id),
      enabled: !!analyzedVideos,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const { data: comments, isLoading: isLoadingComments } = useQuery({
    queryKey: ['comments', selectedVideo?.video_id, selectedTigerId],
    queryFn: () => analysisApi.getComments(selectedVideo!.video_id, selectedTigerId || undefined),
    enabled: !!selectedVideo,
    staleTime: 5 * 60 * 1000,
  })

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

  const isStatsLoading = videoStatsQueries.some(q => q.isLoading) || videoTigersQueries.some(q => q.isLoading)
  const hasStatsData = videoStatsQueries.some(q => q.data) && videoTigersQueries.some(q => q.data)

  const handleExportCSV = () => {
    if (!analyzedVideos || analyzedVideos.length === 0) {
      toast.error('エクスポートするデータがありません')
      return
    }

    if (isStatsLoading) {
      toast.error('データを読み込み中です。しばらくお待ちください')
      return
    }

    const headers = ['動画ID', '動画タイトル', '総コメント数', '社長ID', '社長名', '言及コメント数', '言及率(%)']
    const rows: string[][] = []

    analyzedVideos.forEach((video, index) => {
      const statsData = videoStatsQueries[index]?.data as VideoStats | undefined
      const tigersData = videoTigersQueries[index]?.data

      if (!statsData || !tigersData) return

      const registeredTigerIds = tigersData.tigers.map(t => t.tiger_id)

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

  const handleExportVideoCSV = (videoIndex: number) => {
    if (!analyzedVideos) return

    const video = analyzedVideos[videoIndex]
    const statsData = videoStatsQueries[videoIndex]?.data as VideoStats | undefined
    const tigersData = videoTigersQueries[videoIndex]?.data

    if (!statsData || !tigersData) {
      toast.error('データを読み込み中です')
      return
    }

    const headers = ['動画ID', '動画タイトル', '総コメント数', '社長ID', '社長名', '言及コメント数', '言及率(%)']
    const rows: string[][] = []

    const registeredTigerIds = tigersData.tigers.map(t => t.tiger_id)

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

    if (rows.length === 0) {
      toast.error('出力するデータがありません')
      return
    }

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${video.video_id}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success('CSVをエクスポートしました')
  }

  const openVideoDetail = (video: { video_id: string; title: string; thumbnail_url?: string }) => {
    setSelectedVideo(video)
    setSelectedTigerId(null)
  }

  const closeVideoDetail = () => {
    setSelectedVideo(null)
    setSelectedTigerId(null)
  }

  const getSelectedVideoIndex = () => {
    if (!selectedVideo || !analyzedVideos) return -1
    return analyzedVideos.findIndex(v => v.video_id === selectedVideo.video_id)
  }

  if (isLoadingVideos) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  const selectedVideoIndex = getSelectedVideoIndex()
  const selectedVideoStats = selectedVideoIndex >= 0 ? videoStatsQueries[selectedVideoIndex]?.data as VideoStats | undefined : undefined
  const selectedVideoTigers = selectedVideoIndex >= 0 ? videoTigersQueries[selectedVideoIndex]?.data : undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">動画分析</h1>
          <p className="text-muted-foreground">
            収集・分析済みの動画一覧（{analyzedVideos?.length || 0}件）
          </p>
        </div>
        {analyzedVideos && analyzedVideos.length > 0 && (
          <Button
            onClick={handleExportCSV}
            disabled={isStatsLoading || !hasStatsData}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            {isStatsLoading ? '読み込み中...' : 'CSVエクスポート'}
          </Button>
        )}
      </div>

      {/* Video List */}
      {analyzedVideos && analyzedVideos.length > 0 ? (
        <Card>
          {/* Mobile Cards */}
          <div className="sm:hidden divide-y">
            {analyzedVideos.map((video, index) => {
              const statsData = videoStatsQueries[index]?.data as VideoStats | undefined
              const tigersData = videoTigersQueries[index]?.data
              const isExpanded = expandedVideoId === video.video_id

              const registeredTigerIds = tigersData?.tigers.map(t => t.tiger_id) || []
              const filteredStats = statsData?.tiger_stats
                .filter(stat => registeredTigerIds.includes(stat.tiger_id))
                .sort((a, b) => b.rate_total - a.rate_total) || []

              return (
                <div key={video.video_id} className="p-4">
                  <div
                    className="flex gap-3 cursor-pointer"
                    onClick={() => openVideoDetail(video)}
                  >
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-28 h-16 object-cover rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">
                        {video.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {statsData?.total_comments?.toLocaleString() || '-'}件
                      </p>
                    </div>
                  </div>

                  {filteredStats.length > 0 && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-1">
                        {(isExpanded ? filteredStats : filteredStats.slice(0, 4)).map((stat, i) => (
                          <Badge key={stat.tiger_id} variant={i === 0 ? 'default' : 'secondary'}>
                            {stat.display_name} {(stat.rate_total * 100).toFixed(1)}%
                          </Badge>
                        ))}
                      </div>
                      {filteredStats.length > 4 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedVideoId(isExpanded ? null : video.video_id)
                          }}
                          className="mt-2 h-auto p-0 text-xs"
                        >
                          {isExpanded ? <><ChevronUp className="h-3 w-3 mr-1" />閉じる</> : <><ChevronDown className="h-3 w-3 mr-1" />他{filteredStats.length - 4}名</>}
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t flex justify-between">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openVideoDetail(video)}>
                        <MessageSquare className="h-4 w-4 mr-1" />詳細
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleExportVideoCSV(index) }}>
                        <Download className="h-4 w-4 mr-1" />CSV
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteVideo(video.video_id, video.title)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>動画</TableHead>
                  <TableHead className="w-24 text-center">コメント数</TableHead>
                  <TableHead>出演虎と言及率</TableHead>
                  <TableHead className="w-28 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyzedVideos.map((video, index) => {
                  const statsData = videoStatsQueries[index]?.data as VideoStats | undefined
                  const tigersData = videoTigersQueries[index]?.data
                  const isExpanded = expandedVideoId === video.video_id

                  const registeredTigerIds = tigersData?.tigers.map(t => t.tiger_id) || []
                  const filteredStats = statsData?.tiger_stats
                    .filter(stat => registeredTigerIds.includes(stat.tiger_id))
                    .sort((a, b) => b.rate_total - a.rate_total) || []

                  return (
                    <TableRow
                      key={video.video_id}
                      className="cursor-pointer"
                      onClick={() => openVideoDetail(video)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-20 h-12 object-cover rounded flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                            <p className="text-xs text-muted-foreground">{video.video_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold">{statsData?.total_comments?.toLocaleString() || '-'}</span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {filteredStats.length > 0 ? (
                          <div>
                            <div className="flex flex-wrap gap-1">
                              {(isExpanded ? filteredStats : filteredStats.slice(0, 3)).map((stat, i) => (
                                <Badge key={stat.tiger_id} variant={i === 0 ? 'default' : 'secondary'}>
                                  {stat.display_name} {(stat.rate_total * 100).toFixed(1)}%
                                </Badge>
                              ))}
                            </div>
                            {filteredStats.length > 3 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedVideoId(isExpanded ? null : video.video_id)}
                                className="mt-1 h-auto p-0 text-xs"
                              >
                                {isExpanded ? <><ChevronUp className="h-3 w-3 mr-1" />閉じる</> : <><ChevronDown className="h-3 w-3 mr-1" />他{filteredStats.length - 3}名</>}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {tigersData?.has_registered ? '言及なし' : '出演虎未登録'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openVideoDetail(video)}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleExportVideoCSV(index)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteVideo(video.video_id, video.title)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">分析済みの動画がありません</h3>
            <p className="text-sm text-muted-foreground">
              「データ収集」ページから動画を収集・分析してください
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">表示内容について</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>動画をタップすると詳細なコメントデータを確認できます</li>
            <li>言及率は「総コメント数に対するその社長への言及コメント数の割合」です</li>
            <li>CSVエクスポートで動画毎の生データをダウンロードできます</li>
          </ul>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && closeVideoDetail()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-4">
              {selectedVideo?.thumbnail_url && (
                <img
                  src={selectedVideo.thumbnail_url}
                  alt={selectedVideo?.title}
                  className="w-32 h-20 object-cover rounded flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <DialogTitle className="line-clamp-2">{selectedVideo?.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">
                    {selectedVideoStats?.total_comments?.toLocaleString() || '-'}件のコメント
                  </span>
                  {selectedVideo && (
                    <a
                      href={`https://www.youtube.com/watch?v=${selectedVideo.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      YouTube
                    </a>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          {selectedVideoStats && selectedVideoTigers && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                出演虎別の統計
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedTigerId === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTigerId(null)}
                >
                  全て
                </Button>
                {selectedVideoStats.tiger_stats
                  .filter(stat => selectedVideoTigers.tigers.some(t => t.tiger_id === stat.tiger_id))
                  .sort((a, b) => b.mention_count - a.mention_count)
                  .map((stat) => (
                    <Button
                      key={stat.tiger_id}
                      variant={selectedTigerId === stat.tiger_id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTigerId(stat.tiger_id)}
                    >
                      {stat.display_name}
                      <span className="ml-1 text-xs opacity-70">{stat.mention_count}件</span>
                    </Button>
                  ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {selectedTigerId ? `${selectedVideoStats?.tiger_stats.find(s => s.tiger_id === selectedTigerId)?.display_name}への言及コメント` : '言及コメント'}
              {comments && <span className="text-muted-foreground font-normal">（{comments.length}件）</span>}
            </h3>

            {isLoadingComments ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : comments && comments.length > 0 ? (
              <div className="space-y-2">
                {comments.slice(0, 50).map((comment: AnalyzedComment) => (
                  <div key={comment.comment_id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-medium">{comment.author_name}</span>
                      {comment.like_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {comment.like_count}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{comment.text}</p>
                    {comment.tiger_mentions && comment.tiger_mentions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {comment.tiger_mentions.map((mention) => (
                          <Badge key={mention.tiger_id} variant="secondary" className="text-xs">
                            {mention.display_name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {comments.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    他 {comments.length - 50}件のコメントがあります
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>コメントデータがありません</p>
                <p className="text-xs mt-2">データ収集ページから再収集してください</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Analysis
