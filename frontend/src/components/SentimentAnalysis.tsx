import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import { api } from '../services/api';

// Chart.js の登録
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

interface SentimentData {
  positive: number;
  negative: number;
  neutral: number;
  positive_ratio: number;
  negative_ratio: number;
  neutral_ratio: number;
}

interface SentimentTrend {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
}

interface Props {
  videoId?: string;
  tigerId?: string;
}

const SentimentAnalysis: React.FC<Props> = ({ videoId, tigerId }) => {
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [trendData, setTrendData] = useState<SentimentTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    fetchSentimentData();
  }, [videoId, tigerId, period]);

  const fetchSentimentData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (videoId) {
        // 動画の感情分析
        const response = await api.get(`/api/v1/sentiment/video/${videoId}`);
        setSentimentData(response.data.sentiment_summary);
      } else if (tigerId) {
        // 社長の感情トレンド
        const response = await api.get(`/api/v1/sentiment/tiger/${tigerId}/trend?days=${period}`);
        setSentimentData(response.data.summary);
        setTrendData(response.data.trend);
      } else {
        // 全体の感情分析
        const response = await api.post('/api/v1/sentiment/analyze', {
          text: 'Sample analysis'
        });
        setSentimentData(response.data);
      }
    } catch (err: any) {
      setError(err.message || '感情分析データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const pieData = {
    labels: ['ポジティブ', 'ネガティブ', 'ニュートラル'],
    datasets: [
      {
        data: sentimentData ? [
          sentimentData.positive_ratio,
          sentimentData.negative_ratio,
          sentimentData.neutral_ratio
        ] : [0, 0, 0],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(156, 163, 175, 0.8)'
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(156, 163, 175, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const lineData = {
    labels: trendData.map(d => new Date(d.date).toLocaleDateString('ja-JP')),
    datasets: [
      {
        label: 'ポジティブ',
        data: trendData.map(d => d.positive),
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.1
      },
      {
        label: 'ネガティブ',
        data: trendData.map(d => d.negative),
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.1
      },
      {
        label: 'ニュートラル',
        data: trendData.map(d => d.neutral),
        borderColor: 'rgba(156, 163, 175, 1)',
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        tension: 0.1
      }
    ]
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          感情分析
        </h2>
        {tigerId && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPeriod(7)}
              className={`px-3 py-1 rounded ${period === 7 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              7日間
            </button>
            <button
              onClick={() => setPeriod(30)}
              className={`px-3 py-1 rounded ${period === 30 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              30日間
            </button>
            <button
              onClick={() => setPeriod(90)}
              className={`px-3 py-1 rounded ${period === 90 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              90日間
            </button>
          </div>
        )}
      </div>

      {sentimentData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 円グラフ */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
              感情比率
            </h3>
            <div className="relative h-64">
              <Pie
                data={pieData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        color: 'rgb(156, 163, 175)'
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: (context: any) => {
                          return `${context.label}: ${context.parsed}%`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* 統計情報 */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
              詳細統計
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">ポジティブ</span>
                <span className="font-semibold text-green-600">
                  {sentimentData.positive} ({sentimentData.positive_ratio.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">ネガティブ</span>
                <span className="font-semibold text-red-600">
                  {sentimentData.negative} ({sentimentData.negative_ratio.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">ニュートラル</span>
                <span className="font-semibold text-gray-600 dark:text-gray-400">
                  {sentimentData.neutral} ({sentimentData.neutral_ratio.toFixed(1)}%)
                </span>
              </div>
              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">総コメント数</span>
                  <span className="font-semibold">
                    {sentimentData.positive + sentimentData.negative + sentimentData.neutral}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* トレンドグラフ（社長分析の場合） */}
      {trendData.length > 0 && (
        <div className="mt-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
            感情トレンド
          </h3>
          <div className="relative h-64">
            <Line
              data={lineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      color: 'rgb(156, 163, 175)'
                    }
                  }
                },
                scales: {
                  x: {
                    ticks: {
                      color: 'rgb(156, 163, 175)'
                    }
                  },
                  y: {
                    ticks: {
                      color: 'rgb(156, 163, 175)'
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SentimentAnalysis;