import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface ReportConfig {
  title: string;
  period: 'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  includeCharts: boolean;
}

const ReportGenerator: React.FC = () => {
  const [config, setConfig] = useState<ReportConfig>({
    title: '令和の虎 コメント分析レポート',
    period: 'all',
    includeCharts: true
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [statsPreview, setStatsPreview] = useState<any>(null);

  useEffect(() => {
    fetchStatsPreview();
  }, [config.period]);

  const fetchStatsPreview = async () => {
    try {
      const response = await api.get('/api/v1/stats/overview');
      setStatsPreview(response.data);
    } catch (err) {
      console.error('Failed to fetch stats preview:', err);
    }
  };

  const generateReport = async (format: 'html' | 'markdown') => {
    setGenerating(true);
    setError(null);
    setSuccess(false);
    setReportUrl(null);

    try {
      const statsResponse = await api.get('/api/v1/stats/overview');
      const rankingResponse = await api.get(`/api/v1/stats/ranking?period=${config.period}`);

      const tigerRankings = rankingResponse.data.tiger_rankings || rankingResponse.data || [];
      const reportData = {
        config: {
          title: config.title,
          period: config.period,
          includeCharts: config.includeCharts,
          includeDetails: true,
          includeSentiment: false,
          includeWordcloud: false,
          maxTigers: 9999,
          maxVideos: 9999
        },
        stats_data: {
          ...statsResponse.data,
          tiger_rankings: tigerRankings,
          period: config.period,
          mention_rate: (statsResponse.data.tiger_mentions / statsResponse.data.total_comments * 100) || 0,
          positive_rate: 0
        },
        format: format
      };

      const response = await api.post('/api/v1/reports/generate', reportData);

      if (response.data.report_url) {
        setReportUrl(response.data.report_url);
        setSuccess(true);
      } else {
        const blob = new Blob([response.data], {
          type: format === 'html' ? 'text/html' : 'text/markdown'
        });
        const url = URL.createObjectURL(blob);
        setReportUrl(url);
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'レポート生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = (format: 'html' | 'md') => {
    if (!reportUrl) return;

    const link = document.createElement('a');
    link.href = reportUrl;
    link.download = `report_${new Date().toISOString().split('T')[0]}.${format}`;
    link.click();
  };

  const periodLabel = (p: string) => {
    switch (p) {
      case 'all': return '全期間';
      case 'daily': return '日次';
      case 'weekly': return '週次';
      case 'monthly': return '月次';
      case 'quarterly': return '四半期';
      default: return p;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        レポート生成
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 設定パネル */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
            レポート設定
          </h3>

          <div className="space-y-4">
            {/* タイトル */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
                レポートタイトル
              </label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig({...config, title: e.target.value})}
                className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
              />
            </div>

            {/* 期間 */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
                集計期間
              </label>
              <select
                value={config.period}
                onChange={(e) => setConfig({...config, period: e.target.value as any})}
                className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100"
              >
                <option value="all">全期間</option>
                <option value="daily">日次</option>
                <option value="weekly">週次</option>
                <option value="monthly">月次</option>
                <option value="quarterly">四半期</option>
              </select>
            </div>

            {/* グラフ */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.includeCharts}
                  onChange={(e) => setConfig({...config, includeCharts: e.target.checked})}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">グラフを含める</span>
              </label>
            </div>
          </div>
        </div>

        {/* プレビューパネル */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
            データプレビュー
          </h3>

          {statsPreview ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">総動画数</span>
                <span className="font-semibold dark:text-gray-100">{statsPreview.total_videos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">総コメント数</span>
                <span className="font-semibold dark:text-gray-100">{statsPreview.total_comments?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">社長言及数</span>
                <span className="font-semibold dark:text-gray-100">{statsPreview.tiger_mentions?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">登録社長数</span>
                <span className="font-semibold dark:text-gray-100">{statsPreview.total_tigers}</span>
              </div>
              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-gray-600 dark:text-gray-300">
                  期間: <span className="font-semibold">{periodLabel(config.period)}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              データを読み込み中...
            </div>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 成功メッセージ */}
      {success && (
        <div className="mt-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded flex items-center justify-between">
          <span>レポートが正常に生成されました！</span>
          {reportUrl && (
            <button
              onClick={() => downloadReport(config.includeCharts ? 'html' : 'md')}
              className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              ダウンロード
            </button>
          )}
        </div>
      )}

      {/* 生成ボタン */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => generateReport('html')}
          disabled={generating}
          className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {generating ? '生成中...' : 'HTMLレポート生成'}
        </button>
        <button
          onClick={() => generateReport('markdown')}
          disabled={generating}
          className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {generating ? '生成中...' : 'Markdownレポート生成'}
        </button>
      </div>

      {/* レポートプレビュー */}
      {reportUrl && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">
            プレビュー
          </h3>
          <iframe
            src={reportUrl}
            className="w-full h-[600px] border rounded bg-white"
            title="Report Preview"
          />
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;
