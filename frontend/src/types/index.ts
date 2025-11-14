export interface Tiger {
  tiger_id: string;
  display_name: string;
  full_name: string;
  description?: string;
  image_url?: string;
}

export interface Video {
  video_id: string;
  title: string;
  published_at: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  thumbnail_url?: string;
}

export interface VideoWithStats extends Video {
  tiger_stats?: TigerStat[];
}

export interface Comment {
  comment_id: string;
  video_id: string;
  author_name: string;
  text: string;
  like_count: number;
  published_at: string;
  normalized_text?: string;
}

export interface TigerMention {
  tiger_id: string;
  display_name: string;
  matched_text: string;
}

export interface AnalyzedComment extends Comment {
  tiger_mentions: TigerMention[];
}

export interface AnalysisRequest {
  video_id: string;
  tiger_ids: string[];
}

export interface AnalysisResult {
  video_id: string;
  total_comments: number;
  analyzed_comments: number;
  tiger_mentions: Record<string, number>;
  processing_time: number;
}

export interface TigerStat {
  tiger_id: string;
  display_name: string;
  mention_count: number;
  rate_total: number;
  rate_entity: number;
  rank: number;
}

export interface VideoStats {
  video_id: string;
  title: string;
  total_comments: number;
  tiger_mention_comments: number;
  tiger_stats: TigerStat[];
}

export interface RankingStats {
  period: string;
  total_videos: number;
  tiger_rankings: RankingItem[];
}

export interface RankingItem {
  tiger_id: string;
  display_name: string;
  total_mentions: number;
  total_videos: number;
  avg_rate_total: number;
  avg_rate_entity: number;
  rank: number;
}

export interface CollectionRequest {
  video_url: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  emoji?: string;
}

export interface CollectionProgress {
  status: 'collecting' | 'completed' | 'error';
  video_id: string;
  collected_comments: number;
  total_comments?: number;
  message?: string;
  logs: LogEntry[];
}
