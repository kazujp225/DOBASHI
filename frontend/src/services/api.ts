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
  AvailableMonths,
  MonthlyStats,
} from '../types';

// Prefer explicit env; fallback to same-origin to avoid mixed-content in HTTPS
const getApiBaseUrl = (): string => {
  try {
    // Vite environment variable
    if (import.meta.env?.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
  } catch {
    // import.meta not available
  }
  // Fallback to same-origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

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

  importCsv: async (csvData: Array<{tiger_id: string; display_name: string; full_name?: string; category?: string; description?: string}>, mode: 'add' | 'update' | 'replace' = 'add'): Promise<{message: string; results: {added: number; updated: number; skipped: number; errors: string[]}}> => {
    const { data } = await api.post('/api/v1/tigers/import/csv', { data: csvData, mode });
    return data;
  },

  exportCsv: async (): Promise<{data: Array<{tiger_id: string; display_name: string; full_name: string; category: string; description: string}>; total: number}> => {
    const { data } = await api.get('/api/v1/tigers/export/csv');
    return data;
  },
};

export interface AnalyzedVideo extends Video {
  total_mentions: number;
  tiger_count: number;
}

export const videosApi = {
  getAll: async (): Promise<Video[]> => {
    const { data } = await api.get('/api/v1/videos');
    return data;
  },

  getAnalyzed: async (): Promise<AnalyzedVideo[]> => {
    const { data } = await api.get('/api/v1/videos/analyzed');
    return data;
  },

  getById: async (videoId: string): Promise<VideoWithStats> => {
    const { data } = await api.get(`/api/v1/videos/${videoId}`);
    return data;
  },

  delete: async (videoId: string): Promise<{ status: string; message: string; video_id: string; deleted_comments: number }> => {
    const { data } = await api.delete(`/api/v1/videos/${videoId}`);
    return data;
  },

  resetAll: async (): Promise<{ status: string; message: string }> => {
    const { data } = await api.delete('/api/v1/videos/reset-all/confirm');
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

  getVideoTigers: async (videoId: string): Promise<{ video_id: string; tigers: Tiger[]; has_registered: boolean }> => {
    const { data } = await api.get(`/api/v1/analysis/video-tigers/${videoId}`);
    return data;
  },

  extractTigers: async (videoId: string): Promise<{
    success: boolean;
    video_id: string;
    video_title: string;
    total_tigers_found: number;
    newly_added: number;
    tigers: Array<{ tiger_id: string; display_name: string; source: string }>;
    unmatched_names: string[];
  }> => {
    const { data } = await api.post(`/api/v1/tigers/extract/video/${videoId}`);
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

  getAvailableMonths: async (): Promise<AvailableMonths> => {
    const { data } = await api.get('/api/v1/stats/monthly');
    return data;
  },

  getMonthlyStats: async (year: number, month: number): Promise<MonthlyStats> => {
    const { data } = await api.get(`/api/v1/stats/monthly/${year}/${month}`);
    return data;
  },
};

export { api };
export default api;
