import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import * as d3 from 'd3';
import cloud from 'd3-cloud';

interface WordData {
  word: string;
  count: number;
  size?: number;
}

interface Props {
  videoId?: string;
  tigerId?: string;
  trending?: boolean;
  hours?: number;
}

const WordCloud: React.FC<Props> = ({ videoId, tigerId, trending = false, hours = 24 }) => {
  const [words, setWords] = useState<WordData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<'cloud' | 'list'>('cloud');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWordCloudData();
  }, [videoId, tigerId, trending, hours]);

  useEffect(() => {
    if (words.length > 0 && format === 'cloud') {
      drawWordCloud();
    }
  }, [words, format]);

  const fetchWordCloudData = async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      if (videoId) {
        response = await api.get(`/api/v1/wordcloud/video/${videoId}`);
      } else if (tigerId) {
        response = await api.get(`/api/v1/wordcloud/tiger/${tigerId}`);
      } else if (trending) {
        response = await api.get(`/api/v1/wordcloud/trending?hours=${hours}`);
      } else {
        response = await api.get('/api/v1/wordcloud/trending?hours=24');
      }
      setWords(response.data.words || []);
    } catch (err: any) {
      setError(err.message || 'ワードクラウドデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const drawWordCloud = () => {
    if (!svgRef.current || !containerRef.current || words.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 400;

    // Clear previous cloud
    d3.select(svgRef.current).selectAll('*').remove();

    // Scale font sizes
    const maxCount = Math.max(...words.map(w => w.count));
    const minCount = Math.min(...words.map(w => w.count));
    const fontScale = d3.scaleLinear()
      .domain([minCount, maxCount])
      .range([12, 60]);

    // Prepare words with sizes
    const wordsWithSize = words.map(w => ({
      ...w,
      size: fontScale(w.count)
    }));

    // Create layout
    const layout = cloud()
      .size([width, height])
      .words(wordsWithSize as any)
      .padding(5)
      .rotate(() => ~~(Math.random() * 2) * 90)
      .font('Arial')
      .fontSize((d: any) => d.size)
      .on('end', draw);

    layout.start();

    function draw(words: any[]) {
      const svg = d3.select(svgRef.current)
        .attr('width', width)
        .attr('height', height);

      const g = svg.append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

      // Color scale
      const color = d3.scaleOrdinal(d3.schemeCategory10);

      g.selectAll('text')
        .data(words)
        .enter().append('text')
        .style('font-size', (d: any) => `${d.size}px`)
        .style('font-family', 'Arial')
        .style('fill', (d: any, i: number) => color(i.toString()))
        .attr('text-anchor', 'middle')
        .attr('transform', (d: any) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .text((d: any) => d.word || d.text)
        .on('mouseover', function(event: any, d: any) {
          d3.select(this)
            .transition()
            .duration(200)
            .style('font-size', `${d.size * 1.2}px`)
            .style('cursor', 'pointer');

          // Show tooltip
          const tooltip = d3.select('body').append('div')
            .attr('class', 'word-cloud-tooltip')
            .style('position', 'absolute')
            .style('padding', '8px')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('opacity', 0);

          tooltip.html(`${d.word || d.text}: ${d.count}回`)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .transition()
            .duration(200)
            .style('opacity', 1);
        })
        .on('mouseout', function(event: any, d: any) {
          d3.select(this)
            .transition()
            .duration(200)
            .style('font-size', `${d.size}px`);

          // Remove tooltip
          d3.selectAll('.word-cloud-tooltip').remove();
        });
    }
  };

  const downloadSVG = () => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wordcloud.svg';
    link.click();
    URL.revokeObjectURL(url);
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            ワードクラウド
            {trending && <span className="text-sm font-normal ml-2">（過去{hours}時間）</span>}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat('cloud')}
              className={`px-3 py-1 rounded ${format === 'cloud' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              クラウド
            </button>
            <button
              onClick={() => setFormat('list')}
              className={`px-3 py-1 rounded ${format === 'list' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              リスト
            </button>
            {format === 'cloud' && (
              <button
                onClick={downloadSVG}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                SVG保存
              </button>
            )}
          </div>
        </div>

        {trending && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => fetchWordCloudData()}
              className={`px-3 py-1 rounded ${hours === 24 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              24時間
            </button>
            <button
              onClick={() => {
                setWords([]);
                setTimeout(() => fetchWordCloudData(), 100);
              }}
              className={`px-3 py-1 rounded ${hours === 48 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              48時間
            </button>
            <button
              onClick={() => {
                setWords([]);
                setTimeout(() => fetchWordCloudData(), 100);
              }}
              className={`px-3 py-1 rounded ${hours === 168 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              1週間
            </button>
          </div>
        )}
      </div>

      {format === 'cloud' ? (
        <div ref={containerRef} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 min-h-[400px]">
          <svg ref={svgRef}></svg>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-600">
              <tr>
                <th className="text-left p-2 text-gray-700 dark:text-gray-200">順位</th>
                <th className="text-left p-2 text-gray-700 dark:text-gray-200">キーワード</th>
                <th className="text-right p-2 text-gray-700 dark:text-gray-200">出現回数</th>
              </tr>
            </thead>
            <tbody>
              {words.map((word, index) => (
                <tr key={word.word} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-2 text-gray-600 dark:text-gray-300">{index + 1}</td>
                  <td className="p-2 font-semibold text-gray-800 dark:text-gray-100">
                    {word.word}
                  </td>
                  <td className="p-2 text-right text-gray-600 dark:text-gray-300">
                    {word.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {words.length === 0 && !loading && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          表示するデータがありません
        </div>
      )}
    </div>
  );
};

export default WordCloud;