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
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const tigersApi = {
  getAll: async (): Promise<Tiger[]> => {
    const { data } = await api.get('/api/tigers');
    return data;
  },

  getById: async (tigerId: string): Promise<Tiger> => {
    const { data } = await api.get(`/api/tigers/${tigerId}`);
    return data;
  },

  create: async (tiger: Omit<Tiger, 'tiger_id'>): Promise<Tiger> => {
    const { data } = await api.post('/api/tigers', tiger);
    return data;
  },

  update: async (tigerId: string, tiger: Partial<Tiger>): Promise<Tiger> => {
    const { data } = await api.put(`/api/tigers/${tigerId}`, tiger);
    return data;
  },

  delete: async (tigerId: string): Promise<void> => {
    await api.delete(`/api/tigers/${tigerId}`);
  },
};

export const videosApi = {
  getAll: async (): Promise<Video[]> => {
    const { data } = await api.get('/api/videos');
    return data;
  },

  getById: async (videoId: string): Promise<VideoWithStats> => {
    const { data } = await api.get(`/api/videos/${videoId}`);
    return data;
  },
};

export const analysisApi = {
  collect: async (request: CollectionRequest): Promise<CollectionProgress> => {
    const { data } = await api.post('/api/analysis/collect', request);
    return data;
  },

  getCollectionStatus: async (videoId: string): Promise<CollectionProgress> => {
    const { data } = await api.get(`/api/analysis/collect/${videoId}`);
    return data;
  },

  analyze: async (request: AnalysisRequest): Promise<AnalysisResult> => {
    const { data } = await api.post('/api/analysis/analyze', request);
    return data;
  },
};

export const statsApi = {
  getVideoStats: async (videoId: string): Promise<VideoStats> => {
    const { data } = await api.get(`/api/stats/video/${videoId}`);
    return data;
  },

  getRanking: async (period: string = 'all'): Promise<RankingStats> => {
    const { data } = await api.get(`/api/stats/ranking?period=${period}`);
    return data;
  },
};

export default api;
