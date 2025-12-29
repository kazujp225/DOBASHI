import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, RadarController, RadialLinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';
import { api } from '../services/api';

// Chart.js の登録
ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  RadarController, RadialLinearScale, PointElement, LineElement, Filler
);

interface VideoComparison {
  video_id: string;
  title: string;
  total_comments: number;
  tiger_mentions: number;
  positive_ratio: number;
  engagement_score: number;
}

interface TigerPerformance {
  tiger_id: string;
  display_name: string;
  total_mentions: number;
  avg_rate_total: number;
  avg_rate_entity: number;
  sentiment_score: number;
  growth_rate: number;
  performance_score: number;
}

interface PeriodComparison {
  period: string;
  metrics: {
    total_mentions: number;
    avg_sentiment: number;
    engagement: number;
  };
}

const ComparisonDashboard: React.FC = () => {
  const [comparisonType, setComparisonType] = useState<'videos' | 'tigers' | 'periods'>('videos');
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [selectedTigers, setSelectedTigers] = useState<string[]>([]);
  const [videoComparisons, setVideoComparisons] = useState<VideoComparison[]>([]);
  const [tigerPerformances, setTigerPerformances] = useState<TigerPerformance[]>([]);
  const [periodComparisons, setPeriodComparisons] = useState<PeriodComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableVideos, setAvailableVideos] = useState<any[]>([]);
  const [availableTigers, setAvailableTigers] = useState<any[]>([]);

  useEffect(() => {
    fetchAvailableData();
  }, []);

  const fetchAvailableData = async () => {
    try {
      const [videosRes, tigersRes] = await Promise.all([
        api.get('/api/v1/videos'),
        api.get('/api/v1/tigers')
      ]);
      setAvailableVideos(videosRes.data.slice(0, 20)); // 最新20件
      setAvailableTigers(tigersRes.data);
    } catch (err: any) {
      console.error('Failed to fetch available data:', err);
    }
  };

  const handleCompare = async () => {
    setLoading(true);
    setError(null);
    try {
      if (comparisonType === 'videos' && selectedVideos.length > 0) {
        const response = await api.post('/api/v1/comparison/videos', {
          video_ids: selectedVideos
        });
        setVideoComparisons(response.data.comparisons);
      } else if (comparisonType === 'tigers' && selectedTigers.length > 0) {
        const params = new URLSearchParams();
        selectedTigers.forEach(id => params.append('tiger_ids', id));
        params.append('period_days', '30');

        const response = await api.get(`/api/v1/comparison/tigers/performance?${params.toString()}`);
        // APIは tigers または performances としてデータを返す
        const performances = response.data.performances || response.data.tigers || [];
        // metrics が入っている場合はフラット化
        const flattenedPerformances = performances.map((t: any) => ({
          tiger_id: t.tiger_id,
          display_name: t.display_name,
          total_mentions: t.metrics?.total_mentions || t.total_mentions || 0,
          avg_rate_total: t.metrics?.avg_rate_total || t.avg_rate_total || 0,
          avg_rate_entity: t.metrics?.avg_rate_entity || t.avg_rate_entity || 0,
          sentiment_score: t.sentiment_score || 0,
          growth_rate: t.growth_rate || 0,
          performance_score: t.performance_score || 0,
        }));
        setTigerPerformances(flattenedPerformances);
      } else if (comparisonType === 'periods' && selectedTigers.length > 0) {
        const response = await api.get(`/api/v1/comparison/periods?tiger_id=${selectedTigers[0]}`);
        setPeriodComparisons(response.data.periods);
      }
    } catch (err: any) {
      setError(err.message || '比較データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getVideoComparisonChart = () => {
    const labels = videoComparisons.map(v => v.title.substring(0, 30) + '...');

    return {
      labels,
      datasets: [
        {
          label: '総コメント数',
          data: videoComparisons.map(v => v.total_comments),
          backgroundColor: 'rgba(99, 102, 241, 0.5)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: '社長言及数',
          data: videoComparisons.map(v => v.tiger_mentions),
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: 'ポジティブ率(%)',
          data: videoComparisons.map(v => v.positive_ratio),
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
          yAxisID: 'y1'
        }
      ]
    };
  };

  const getTigerPerformanceRadar = () => {
    const labels = ['総言及数', 'Rate_total', 'Rate_entity', '感情スコア', '成長率', 'パフォーマンス'];

    // 正規化のための最大値を計算
    const maxValues = {
      mentions: Math.max(...tigerPerformances.map(t => t.total_mentions)),
      rateTotal: Math.max(...tigerPerformances.map(t => t.avg_rate_total)),
      rateEntity: Math.max(...tigerPerformances.map(t => t.avg_rate_entity)),
      sentiment: 100,
      growth: Math.max(...tigerPerformances.map(t => Math.abs(t.growth_rate))),
      performance: Math.max(...tigerPerformances.map(t => t.performance_score))
    };

    return {
      labels,
      datasets: tigerPerformances.map((tiger, index) => ({
        label: tiger.display_name,
        data: [
          (tiger.total_mentions / maxValues.mentions) * 100,
          (tiger.avg_rate_total / maxValues.rateTotal) * 100,
          (tiger.avg_rate_entity / maxValues.rateEntity) * 100,
          ((tiger.sentiment_score + 100) / 2), // -100 to 100 -> 0 to 100
          ((tiger.growth_rate + maxValues.growth) / (maxValues.growth * 2)) * 100,
          (tiger.performance_score / maxValues.performance) * 100
        ],
        fill: true,
        backgroundColor: `rgba(${99 + index * 30}, ${102 + index * 20}, ${241 - index * 30}, 0.2)`,
        borderColor: `rgba(${99 + index * 30}, ${102 + index * 20}, ${241 - index * 30}, 1)`,
        pointBackgroundColor: `rgba(${99 + index * 30}, ${102 + index * 20}, ${241 - index * 30}, 1)`,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: `rgba(${99 + index * 30}, ${102 + index * 20}, ${241 - index * 30}, 1)`
      }))
    };
  };

  const getPeriodComparisonChart = () => {
    return {
      labels: periodComparisons.map(p => p.period),
      datasets: [
        {
          label: '総言及数',
          data: periodComparisons.map(p => p.metrics.total_mentions),
          backgroundColor: 'rgba(99, 102, 241, 0.5)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1
        },
        {
          label: '平均感情スコア',
          data: periodComparisons.map(p => p.metrics.avg_sentiment),
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1
        },
        {
          label: 'エンゲージメント',
          data: periodComparisons.map(p => p.metrics.engagement),
          backgroundColor: 'rgba(251, 191, 36, 0.5)',
          borderColor: 'rgba(251, 191, 36, 1)',
          borderWidth: 1
        }
      ]
    };
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        比較分析ダッシュボード
      </h2>

      {/* 比較タイプ選択 */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setComparisonType('videos')}
            className={`px-4 py-2 rounded ${comparisonType === 'videos' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            動画比較
          </button>
          <button
            onClick={() => setComparisonType('tigers')}
            className={`px-4 py-2 rounded ${comparisonType === 'tigers' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            社長パフォーマンス
          </button>
          <button
            onClick={() => setComparisonType('periods')}
            className={`px-4 py-2 rounded ${comparisonType === 'periods' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            期間比較
          </button>
        </div>
      </div>

      {/* 選択UI */}
      <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        {comparisonType === 'videos' && (
          <div>
            <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-200">
              比較する動画を選択（最大5件）
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {availableVideos.map(video => (
                <label key={video.video_id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedVideos.includes(video.video_id)}
                    onChange={(e) => {
                      if (e.target.checked && selectedVideos.length < 5) {
                        setSelectedVideos([...selectedVideos, video.video_id]);
                      } else if (!e.target.checked) {
                        setSelectedVideos(selectedVideos.filter(id => id !== video.video_id));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {video.title.substring(0, 50)}...
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {comparisonType === 'tigers' && (
          <div>
            <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-200">
              比較する社長を選択（最大5名）
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto">
              {availableTigers.map(tiger => {
                const tigerId = tiger.tiger_id || tiger.id;
                const isSelected = selectedTigers.includes(tigerId);
                return (
                  <label
                    key={tigerId}
                    className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-orange-100 dark:bg-orange-900/30 border border-orange-400'
                        : 'bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked && selectedTigers.length < 5) {
                          setSelectedTigers([...selectedTigers, tigerId]);
                        } else if (!e.target.checked) {
                          setSelectedTigers(selectedTigers.filter(id => id !== tigerId));
                        }
                      }}
                      className="mr-2 w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200">
                      {tiger.display_name}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedTigers.length > 0 && (
              <p className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                {selectedTigers.length}名選択中
              </p>
            )}
          </div>
        )}

        {comparisonType === 'periods' && (
          <div>
            <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-200">
              社長を選択して期間比較
            </h3>
            <select
              value={selectedTigers[0] || ''}
              onChange={(e) => setSelectedTigers([e.target.value])}
              className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500"
            >
              <option value="">選択してください</option>
              {availableTigers.map(tiger => {
                const tigerId = tiger.tiger_id || tiger.id;
                return (
                  <option key={tigerId} value={tigerId}>
                    {tiger.display_name}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <button
          onClick={handleCompare}
          disabled={
            (comparisonType === 'videos' && selectedVideos.length === 0) ||
            (comparisonType === 'tigers' && selectedTigers.length === 0) ||
            (comparisonType === 'periods' && selectedTigers.length === 0) ||
            loading
          }
          className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? '比較中...' : '比較実行'}
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* グラフ表示 */}
      {!loading && !error && (
        <div className="mt-6">
          {comparisonType === 'videos' && videoComparisons.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <Bar
                data={getVideoComparisonChart()}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                    },
                    title: {
                      display: true,
                      text: '動画別比較'
                    }
                  },
                  scales: {
                    y: {
                      type: 'linear' as const,
                      display: true,
                      position: 'left' as const,
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      grid: {
                        drawOnChartArea: false,
                      },
                    },
                  },
                }}
              />
            </div>
          )}

          {comparisonType === 'tigers' && tigerPerformances.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                比較結果: {tigerPerformances.map(t => t.display_name).join(' vs ')}
              </h3>
              <Radar
                data={getTigerPerformanceRadar()}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                    },
                    title: {
                      display: true,
                      text: '社長パフォーマンス比較'
                    }
                  },
                  scales: {
                    r: {
                      angleLines: {
                        display: true
                      },
                      suggestedMin: 0,
                      suggestedMax: 100
                    }
                  }
                }}
              />
              {/* 詳細テーブル */}
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-600">
                      <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">社長名</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">言及数</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Rate Total</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">Rate Entity</th>
                      <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">スコア</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tigerPerformances.map((t, i) => (
                      <tr key={t.tiger_id} className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-100 dark:bg-gray-700'}>
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{t.display_name}</td>
                        <td className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{t.total_mentions}</td>
                        <td className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{(t.avg_rate_total * 100).toFixed(1)}%</td>
                        <td className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{(t.avg_rate_entity * 100).toFixed(1)}%</td>
                        <td className="text-right py-2 px-3 text-orange-600 dark:text-orange-400 font-semibold">{t.performance_score.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {comparisonType === 'periods' && periodComparisons.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <Bar
                data={getPeriodComparisonChart()}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                    },
                    title: {
                      display: true,
                      text: '期間別推移'
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComparisonDashboard;
