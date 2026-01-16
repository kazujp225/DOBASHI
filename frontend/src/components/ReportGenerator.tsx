import React, { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Download, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { videosApi, analysisApi, statsApi } from '../services/api';
import toast from 'react-hot-toast';

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

  // 分析済み動画一覧を取得
  const { data: analyzedVideos, isLoading: isLoadingVideos } = useQuery({
    queryKey: ['analyzedVideos'],
    queryFn: videosApi.getAnalyzed,
  });

  // 各動画の出演虎情報を取得
  const videoTigersQueries = useQueries({
    queries: (analyzedVideos || []).map((video) => ({
      queryKey: ['video-tigers', video.video_id],
      queryFn: () => analysisApi.getVideoTigers(video.video_id),
      enabled: !!analyzedVideos,
      staleTime: 5 * 60 * 1000,
    })),
  });

  // 各動画の統計情報を取得
  const videoStatsQueries = useQueries({
    queries: (analyzedVideos || []).map((video) => ({
      queryKey: ['videoStats', video.video_id],
      queryFn: () => statsApi.getVideoStats(video.video_id),
      enabled: !!analyzedVideos,
      staleTime: 5 * 60 * 1000,
    })),
  });

  // 統計データのロード状態を確認
  const isStatsLoading = videoStatsQueries.some(q => q.isLoading) || videoTigersQueries.some(q => q.isLoading);
  const hasStatsData = videoStatsQueries.some(q => q.data) && videoTigersQueries.some(q => q.data);

  // 全体CSVエクスポート
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

  // 動画毎のCSVエクスポート
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

  // 集計サマリー計算
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <p className="text-gray-600 dark:text-gray-400">
            分析データをCSV形式でエクスポートできます
          </p>
        </div>
        {analyzedVideos && analyzedVideos.length > 0 && (
          <button
            onClick={handleExportAllCSV}
            disabled={isStatsLoading || !hasStatsData}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-lg transition-all ${
              isStatsLoading || !hasStatsData
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600'
            }`}
          >
            <Download size={18} />
            <span>{isStatsLoading ? '読み込み中...' : '全動画CSVエクスポート'}</span>
          </button>
        )}
      </div>

      {/* 集計サマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{analyzedVideos?.length || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">分析動画数</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalComments.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">総コメント数</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalMentions.toLocaleString()}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">社長言及数</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {totalComments > 0 ? ((totalMentions / totalComments) * 100).toFixed(1) : 0}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">言及率</p>
        </div>
      </div>

      {/* 動画一覧 */}
      {analyzedVideos && analyzedVideos.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText size={20} />
              動画別データ
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              個別の動画データをCSVでエクスポートできます
            </p>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
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
                <div key={video.video_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <div className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      {/* サムネイル */}
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-24 h-14 object-cover rounded-lg flex-shrink-0"
                      />

                      {/* 動画情報 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                          {video.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {statsData?.total_comments?.toLocaleString() || '-'}件のコメント
                          {filteredStats.length > 0 && ` • ${filteredStats.length}名の出演虎`}
                        </p>

                        {/* 出演虎タグ（縮小表示） */}
                        {filteredStats.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(isExpanded ? filteredStats : filteredStats.slice(0, 3)).map((stat, i) => (
                              <span
                                key={stat.tiger_id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                  i === 0
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {stat.display_name}
                                <span className="font-bold">{(stat.rate_total * 100).toFixed(1)}%</span>
                              </span>
                            ))}
                            {!isExpanded && filteredStats.length > 3 && (
                              <button
                                onClick={() => setExpandedVideoId(video.video_id)}
                                className="text-xs text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-0.5"
                              >
                                <ChevronDown size={14} />
                                他{filteredStats.length - 3}名
                              </button>
                            )}
                            {isExpanded && filteredStats.length > 3 && (
                              <button
                                onClick={() => setExpandedVideoId(null)}
                                className="text-xs text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-0.5"
                              >
                                <ChevronUp size={14} />
                                閉じる
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* CSVボタン */}
                      <button
                        onClick={() => handleExportVideoCSV(index)}
                        disabled={isLoading || !statsData}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all flex-shrink-0 ${
                          isLoading || !statsData
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                        }`}
                      >
                        <Download size={16} />
                        CSV
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <FileText size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            分析データがありません
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            「データ収集」ページから動画を収集・分析してください
          </p>
        </div>
      )}

      {/* 説明 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">CSVエクスポートについて</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>「全動画CSVエクスポート」で全ての分析データを一括ダウンロード</li>
          <li>各動画の「CSV」ボタンで個別にダウンロード可能</li>
          <li>出力形式: 動画ID、動画タイトル、総コメント数、社長ID、社長名、言及コメント数、言及率(%)</li>
        </ul>
      </div>
    </div>
  );
};

export default ReportGenerator;
