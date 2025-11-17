import React, { useState } from 'react';
import SentimentAnalysis from '../components/SentimentAnalysis';

const Sentiment: React.FC = () => {
  const [analysisType, setAnalysisType] = useState<'overall' | 'video' | 'tiger'>('overall');
  const [selectedId, setSelectedId] = useState<string>('');

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">
        感情分析
      </h1>

      {/* 分析タイプ選択 */}
      <div className="mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setAnalysisType('overall')}
            className={`px-4 py-2 rounded ${analysisType === 'overall' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            全体分析
          </button>
          <button
            onClick={() => setAnalysisType('video')}
            className={`px-4 py-2 rounded ${analysisType === 'video' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            動画別分析
          </button>
          <button
            onClick={() => setAnalysisType('tiger')}
            className={`px-4 py-2 rounded ${analysisType === 'tiger' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            社長別分析
          </button>
        </div>

        {analysisType === 'video' && (
          <div className="mt-4">
            <input
              type="text"
              placeholder="動画IDを入力"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-4 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        )}

        {analysisType === 'tiger' && (
          <div className="mt-4">
            <input
              type="text"
              placeholder="社長IDを入力"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-4 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        )}
      </div>

      {/* 感情分析コンポーネント */}
      <SentimentAnalysis
        videoId={analysisType === 'video' ? selectedId : undefined}
        tigerId={analysisType === 'tiger' ? selectedId : undefined}
      />
    </div>
  );
};

export default Sentiment;