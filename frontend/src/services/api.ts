import axios from 'axios';
import type {
  Tiger,
  Video,
  VideoWithStats,
  VideoStats,
  RankingStats,
  CollectionRequest,
  CollectionProgress,
  AnalysisRequest,
  AnalysisResult,
  AnalyzedComment,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 画像URLを絶対URLに変換
 * ローカルパス (/static/...) の場合はバックエンドのURLを追加
 */
export const getImageUrl = (imageUrl?: string): string | undefined => {
  if (!imageUrl) return undefined;

  if (imageUrl.startsWith('/static/')) {
    return `${API_BASE_URL}${imageUrl}`;
  }

  return imageUrl;
};

export const tigersApi = {
  getAll: async (): Promise<Tiger[]> => {
    const { data } = await api.get('/api/v1/tigers');
    return data;
  },

  getById: async (tigerId: string): Promise<Tiger> => {
    const { data } = await api.get(`/api/v1/tigers/${tigerId}`);
    return data;
  },

  create: async (tiger: Omit<Tiger, 'tiger_id'>): Promise<Tiger> => {
    const { data } = await api.post('/api/v1/tigers', tiger);
    return data;
  },

  update: async (tigerId: string, tiger: Partial<Tiger>): Promise<Tiger> => {
    const { data } = await api.put(`/api/v1/tigers/${tigerId}`, tiger);
    return data;
  },

  delete: async (tigerId: string): Promise<void> => {
    await api.delete(`/api/v1/tigers/${tigerId}`);
  },

  getAliases: async (tigerId: string): Promise<{ tiger_id: string; display_name: string; aliases: Array<{ alias: string; type: string; priority: number }> }> => {
    const { data } = await api.get(`/api/v1/tigers/${tigerId}/aliases`);
    return data;
  },

  addAlias: async (tigerId: string, alias: { alias: string; type: string; priority: number }): Promise<any> => {
    const { data } = await api.post(`/api/v1/tigers/${tigerId}/aliases`, alias);
    return data;
  },

  deleteAlias: async (tigerId: string, alias: string): Promise<any> => {
    const { data } = await api.delete(`/api/v1/tigers/${tigerId}/aliases/${encodeURIComponent(alias)}`);
    return data;
  },
};

export const videosApi = {
  getAll: async (): Promise<Video[]> => {
    const { data } = await api.get('/api/v1/videos');
    return data;
  },

  getById: async (videoId: string): Promise<VideoWithStats> => {
    const { data } = await api.get(`/api/v1/videos/${videoId}`);
    return data;
  },
};

export const analysisApi = {
  collect: async (request: CollectionRequest): Promise<CollectionProgress> => {
    const { data } = await api.post('/api/v1/analysis/collect', request);
    return data;
  },

  getCollectionStatus: async (videoId: string): Promise<CollectionProgress> => {
    const { data } = await api.get(`/api/v1/analysis/collect/${videoId}`);
    return data;
  },

  analyze: async (request: AnalysisRequest): Promise<AnalysisResult> => {
    const { data } = await api.post('/api/v1/analysis/analyze', request);
    return data;
  },

  getComments: async (videoId: string, tigerId?: string): Promise<AnalyzedComment[]> => {
    const params = tigerId ? { tiger_id: tigerId } : {};
    const { data } = await api.get(`/api/v1/analysis/comments/${videoId}`, { params });
    return data;
  },
};

export const statsApi = {
  getVideoStats: async (videoId: string): Promise<VideoStats> => {
    const { data } = await api.get(`/api/v1/stats/video/${videoId}`);
    return data;
  },

  getRanking: async (period: string = 'all'): Promise<RankingStats> => {
    const { data } = await api.get(`/api/v1/stats/ranking?period=${period}`);
    return data;
  },
};

export { api };
export default api;
