import React, { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Download, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { videosApi, analysisApi, statsApi } from '../services/api';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface VideoStats {
  video_id: string;
  title: string;
  total_comments: number;
  tiger_mention_comments: number;
  tiger_stats: {
    tiger_id: string;
    display_name: string;
    mention_count: number;
    rate_total: number;
    rate_entity: number;
    rank: number;
  }[];
}

const ReportGenerator: React.FC = () => {
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);

  const { data: analyzedVideos, isLoading: isLoadingVideos } = useQuery({
    queryKey: ['analyzedVideos'],
    queryFn: videosApi.getAnalyzed,
  });

  const videoTigersQueries = useQueries({
    queries: (analyzedVideos || []).map((video) => ({
      queryKey: ['video-tigers', video.video_id],
      queryFn: () => analysisApi.getVideoTigers(video.video_id),
      enabled: !!analyzedVideos,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const videoStatsQueries = useQueries({
    queries: (analyzedVideos || []).map((video) => ({
      queryKey: ['videoStats', video.video_id],
      queryFn: () => statsApi.getVideoStats(video.video_id),
      enabled: !!analyzedVideos,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isStatsLoading = videoStatsQueries.some(q => q.isLoading) || videoTigersQueries.some(q => q.isLoading);
  const hasStatsData = videoStatsQueries.some(q => q.data) && videoTigersQueries.some(q => q.data);

  const handleExportAllCSV = () => {
    if (!analyzedVideos || analyzedVideos.length === 0) {
      toast.error('エクスポートするデータがありません');
      return;
    }

    if (isStatsLoading) {
      toast.error('データを読み込み中です。しばらくお待ちください');
      return;
    }

    const headers = ['動画ID', '動画タイトル', '総コメント数', '社長ID', '社長名', '言及コメント数', '言及率(%)'];
    const rows: string[][] = [];

    analyzedVideos.forEach((video, index) => {
      const statsData = videoStatsQueries[index]?.data as VideoStats | undefined;
      const tigersData = videoTigersQueries[index]?.data;

      if (!statsData || !tigersData) return;

      const registeredTigerIds = tigersData.tigers.map(t => t.tiger_id);

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
          ]);
        });
    });

    if (rows.length === 0) {
      toast.error('出力するデータがありません');
      return;
    }

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `全動画分析_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('CSVをエクスポートしました');
  };

  const handleExportVideoCSV = (videoIndex: number) => {
    if (!analyzedVideos) return;

    const video = analyzedVideos[videoIndex];
    const statsData = videoStatsQueries[videoIndex]?.data as VideoStats | undefined;
    const tigersData = videoTigersQueries[videoIndex]?.data;

    if (!statsData || !tigersData) {
      toast.error('データを読み込み中です');
      return;
    }

    const headers = ['動画ID', '動画タイトル', '総コメント数', '社長ID', '社長名', '言及コメント数', '言及率(%)'];
    const rows: string[][] = [];

    const registeredTigerIds = tigersData.tigers.map(t => t.tiger_id);

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
        ]);
      });

    if (rows.length === 0) {
      toast.error('出力するデータがありません');
      return;
    }

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${video.video_id}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('CSVをエクスポートしました');
  };

  const totalComments = videoStatsQueries.reduce((sum, q) => {
    const data = q.data as VideoStats | undefined;
    return sum + (data?.total_comments || 0);
  }, 0);

  const totalMentions = videoStatsQueries.reduce((sum, q) => {
    const data = q.data as VideoStats | undefined;
    if (!data?.tiger_stats) return sum;
    return sum + data.tiger_stats.reduce((s, stat) => s + stat.mention_count, 0);
  }, 0);

  if (isLoadingVideos) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const stats = [
    { label: '分析動画数', value: analyzedVideos?.length || 0 },
    { label: '総コメント数', value: totalComments.toLocaleString() },
    { label: '社長言及数', value: totalMentions.toLocaleString() },
    { label: '言及率', value: totalComments > 0 ? `${((totalMentions / totalComments) * 100).toFixed(1)}%` : '0%' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          分析データをCSV形式でエクスポートできます
        </p>
        {analyzedVideos && analyzedVideos.length > 0 && (
          <Button
            onClick={handleExportAllCSV}
            disabled={isStatsLoading || !hasStatsData}
          >
            <Download className="mr-2 h-4 w-4" />
            {isStatsLoading ? '読み込み中...' : '全動画CSVエクスポート'}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Video List */}
      {analyzedVideos && analyzedVideos.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              動画別データ
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              個別の動画データをCSVでエクスポートできます
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {analyzedVideos.map((video, index) => {
                const statsData = videoStatsQueries[index]?.data as VideoStats | undefined;
                const tigersData = videoTigersQueries[index]?.data;
                const isExpanded = expandedVideoId === video.video_id;
                const isLoading = videoStatsQueries[index]?.isLoading || videoTigersQueries[index]?.isLoading;

                const registeredTigerIds = tigersData?.tigers.map(t => t.tiger_id) || [];
                const filteredStats = statsData?.tiger_stats
                  .filter(stat => registeredTigerIds.includes(stat.tiger_id))
                  .sort((a, b) => b.rate_total - a.rate_total) || [];

                return (
                  <div key={video.video_id} className="p-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-24 h-14 object-cover rounded flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">
                          {video.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {statsData?.total_comments?.toLocaleString() || '-'}件のコメント
                          {filteredStats.length > 0 && ` • ${filteredStats.length}名の出演虎`}
                        </p>

                        {filteredStats.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(isExpanded ? filteredStats : filteredStats.slice(0, 3)).map((stat, i) => (
                              <Badge key={stat.tiger_id} variant={i === 0 ? 'default' : 'secondary'}>
                                {stat.display_name} {(stat.rate_total * 100).toFixed(1)}%
                              </Badge>
                            ))}
                            {filteredStats.length > 3 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedVideoId(isExpanded ? null : video.video_id)}
                                className="h-auto p-0 text-xs"
                              >
                                {isExpanded ? (
                                  <><ChevronUp className="h-3 w-3 mr-1" />閉じる</>
                                ) : (
                                  <><ChevronDown className="h-3 w-3 mr-1" />他{filteredStats.length - 3}名</>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportVideoCSV(index)}
                        disabled={isLoading || !statsData}
                        className="flex-shrink-0"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        CSV
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">分析データがありません</h3>
            <p className="text-sm text-muted-foreground">
              「データ収集」ページから動画を収集・分析してください
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">CSVエクスポートについて</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>「全動画CSVエクスポート」で全ての分析データを一括ダウンロード</li>
            <li>各動画の「CSV」ボタンで個別にダウンロード可能</li>
            <li>出力形式: 動画ID、動画タイトル、総コメント数、社長ID、社長名、言及コメント数、言及率(%)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportGenerator;
