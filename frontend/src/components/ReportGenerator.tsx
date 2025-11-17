import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface ReportConfig {
  title: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  includeCharts: boolean;
  includeDetails: boolean;
  includeSentiment: boolean;
  includeWordcloud: boolean;
  maxTigers: number;
  maxVideos: number;
}

const ReportGenerator: React.FC = () => {
  const [config, setConfig] = useState<ReportConfig>({
    title: '令和の虎 コメント分析レポート',
    period: 'monthly',
    includeCharts: true,
    includeDetails: true,
    includeSentiment: true,
    includeWordcloud: false,
    maxTigers: 10,
    maxVideos: 20
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
      // まず統計データを取得
      const statsResponse = await api.get('/api/v1/stats/overview');
      const rankingResponse = await api.get('/api/v1/tigers/ranking');

      // レポート生成データを準備
      const reportData = {
        config: config,
        stats_data: {
          ...statsResponse.data,
          tiger_rankings: rankingResponse.data.slice(0, config.maxTigers),
          period: config.period,
          mention_rate: (statsResponse.data.tiger_mentions / statsResponse.data.total_comments * 100) || 0,
          positive_rate: 65.0 // サンプル値
        },
        format: format
      };

      // レポート生成APIを呼び出し
      const response = await api.post('/api/v1/reports/generate', reportData);

      if (response.data.report_url) {
        setReportUrl(response.data.report_url);
        setSuccess(true);
      } else {
        // Blobとしてレポートを受信
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

  const downloadReport = () => {
    if (!reportUrl) return;

    const link = document.createElement('a');
    link.href = reportUrl;
    link.download = `report_${new Date().toISOString().split('T')[0]}.${config.includeCharts ? 'html' : 'md'}`;
    link.click();
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
                className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500"
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
                className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500"
              >
                <option value="daily">日次</option>
                <option value="weekly">週次</option>
                <option value="monthly">月次</option>
                <option value="quarterly">四半期</option>
              </select>
            </div>

            {/* 含める項目 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-300">
                含める項目
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.includeCharts}
                    onChange={(e) => setConfig({...config, includeCharts: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">グラフ</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.includeDetails}
                    onChange={(e) => setConfig({...config, includeDetails: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">詳細統計</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.includeSentiment}
                    onChange={(e) => setConfig({...config, includeSentiment: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">感情分析</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.includeWordcloud}
                    onChange={(e) => setConfig({...config, includeWordcloud: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">ワードクラウド</span>
                </label>
              </div>
            </div>

            {/* 表示件数 */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
                社長表示数（最大）
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.maxTigers}
                onChange={(e) => setConfig({...config, maxTigers: parseInt(e.target.value) || 10})}
                className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
                動画表示数（最大）
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={config.maxVideos}
                onChange={(e) => setConfig({...config, maxVideos: parseInt(e.target.value) || 20})}
                className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500"
              />
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
                <span className="font-semibold">{statsPreview.total_videos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">総コメント数</span>
                <span className="font-semibold">{statsPreview.total_comments?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">社長言及数</span>
                <span className="font-semibold">{statsPreview.tiger_mentions?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">登録社長数</span>
                <span className="font-semibold">{statsPreview.total_tigers}</span>
              </div>
              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-gray-600 dark:text-gray-300">
                  期間: {config.period === 'daily' ? '日次' :
                         config.period === 'weekly' ? '週次' :
                         config.period === 'monthly' ? '月次' : '四半期'}
                </p>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  レポートに含まれる項目:
                </p>
                <ul className="mt-1 text-gray-600 dark:text-gray-300">
                  {config.includeCharts && <li>• グラフ分析</li>}
                  {config.includeDetails && <li>• 詳細統計</li>}
                  {config.includeSentiment && <li>• 感情分析</li>}
                  {config.includeWordcloud && <li>• ワードクラウド</li>}
                </ul>
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
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 成功メッセージ */}
      {success && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          レポートが正常に生成されました！
          {reportUrl && (
            <button
              onClick={downloadReport}
              className="ml-4 text-green-800 underline hover:text-green-900"
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
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {generating ? '生成中...' : 'Markdownレポート生成'}
        </button>
      </div>

      {/* レポートプレビュー */}
      {reportUrl && config.includeCharts && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">
            レポートプレビュー
          </h3>
          <iframe
            src={reportUrl}
            className="w-full h-96 border rounded"
            title="Report Preview"
          />
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;