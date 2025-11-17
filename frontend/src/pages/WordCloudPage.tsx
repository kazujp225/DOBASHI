import React, { useState } from 'react';
import WordCloud from '../components/WordCloud';

const WordCloudPage: React.FC = () => {
  const [viewType, setViewType] = useState<'trending' | 'video' | 'tiger'>('trending');
  const [selectedId, setSelectedId] = useState<string>('');
  const [hours, setHours] = useState<number>(24);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">
        ワードクラウド
      </h1>

      {/* 表示タイプ選択 */}
      <div className="mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setViewType('trending')}
            className={`px-4 py-2 rounded ${viewType === 'trending' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            トレンドワード
          </button>
          <button
            onClick={() => setViewType('video')}
            className={`px-4 py-2 rounded ${viewType === 'video' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            動画別
          </button>
          <button
            onClick={() => setViewType('tiger')}
            className={`px-4 py-2 rounded ${viewType === 'tiger' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            社長別
          </button>
        </div>

        {viewType === 'trending' && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setHours(24)}
              className={`px-3 py-1 rounded ${hours === 24 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              24時間
            </button>
            <button
              onClick={() => setHours(48)}
              className={`px-3 py-1 rounded ${hours === 48 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              48時間
            </button>
            <button
              onClick={() => setHours(168)}
              className={`px-3 py-1 rounded ${hours === 168 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              1週間
            </button>
          </div>
        )}

        {viewType === 'video' && (
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

        {viewType === 'tiger' && (
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

      {/* ワードクラウドコンポーネント */}
      <WordCloud
        videoId={viewType === 'video' ? selectedId : undefined}
        tigerId={viewType === 'tiger' ? selectedId : undefined}
        trending={viewType === 'trending'}
        hours={hours}
      />
    </div>
  );
};

export default WordCloudPage;