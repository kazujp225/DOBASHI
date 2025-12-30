"""
Pydantic Schemas for API Request/Response
"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
from datetime import datetime


# ========== Tiger (社長) Schemas ==========

class TigerBase(BaseModel):
    """社長の基本情報"""
    tiger_id: str
    display_name: str
    full_name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    category: str = "other"  # regular / semi_regular / other


class TigerCreate(TigerBase):
    """社長作成リクエスト"""
    pass


class Tiger(TigerBase):
    """社長レスポンス"""

    class Config:
        from_attributes = True


class TigerAlias(BaseModel):
    """社長の別名"""
    alias: str
    alias_type: str
    priority: int


# ========== Video Schemas ==========

class VideoBase(BaseModel):
    """動画の基本情報"""
    video_id: str
    title: str
    published_at: str
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    comment_count: Optional[int] = None
    thumbnail_url: Optional[str] = None


class VideoCreate(VideoBase):
    """動画作成リクエスト"""
    pass


class Video(VideoBase):
    """動画レスポンス"""

    class Config:
        from_attributes = True


class VideoWithStats(Video):
    """統計情報付き動画"""
    tiger_stats: Optional[List[Dict]] = None


# ========== Comment Schemas ==========

class CommentBase(BaseModel):
    """コメントの基本情報"""
    comment_id: str
    video_id: str
    author_name: str
    text: str
    like_count: int
    published_at: str


class Comment(CommentBase):
    """コメントレスポンス"""
    normalized_text: Optional[str] = None

    class Config:
        from_attributes = True


class CommentWithMentions(Comment):
    """言及情報付きコメント"""
    mentioned_tigers: List[str] = Field(default_factory=list)


# ========== Analysis Schemas ==========

class AnalysisRequest(BaseModel):
    """分析リクエスト"""
    video_id: str
    tiger_ids: List[str] = Field(..., min_items=1, max_items=500)


class AnalysisResult(BaseModel):
    """分析結果"""
    video_id: str
    total_comments: int
    analyzed_comments: int
    tiger_mentions: Dict[str, int]
    processing_time: float


# ========== Stats Schemas ==========

class TigerStats(BaseModel):
    """社長別統計"""
    tiger_id: str
    display_name: str
    mention_count: int
    rate_total: float = Field(..., description="総コメント数に対する割合")
    rate_entity: float = Field(..., description="社長言及コメント数に対する割合")
    rank: int


class VideoStats(BaseModel):
    """動画統計"""
    video_id: str
    title: Optional[str] = None
    total_comments: int
    tiger_mention_comments: int
    tiger_stats: List[TigerStats]


class RankingStats(BaseModel):
    """ランキング統計"""
    period: str = Field(..., description="集計期間")
    total_videos: int
    tiger_rankings: List[Dict]


# ========== Collection Schemas ==========

class CollectionRequest(BaseModel):
    """データ収集リクエスト"""
    video_url: str = Field(..., description="YouTube動画URL")
    tiger_ids: Optional[List[str]] = Field(None, description="出演社長IDリスト")


class LogEntry(BaseModel):
    """ログエントリ"""
    timestamp: str
    level: str = Field(..., description="info, success, warning, error")
    message: str
    emoji: Optional[str] = None


class CollectionProgress(BaseModel):
    """収集進捗"""
    status: str = Field(..., description="collecting, completed, error")
    video_id: str
    collected_comments: int
    total_comments: Optional[int] = None
    message: Optional[str] = None
    logs: List[LogEntry] = Field(default_factory=list)


# ========== Authentication Schemas ==========

class Token(BaseModel):
    """認証トークン"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """トークンデータ"""
    username: Optional[str] = None


class UserBase(BaseModel):
    """ユーザー基本情報"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    """ユーザー作成リクエスト"""
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """ユーザー更新リクエスト"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class UserResponse(UserBase):
    """ユーザーレスポンス"""
    user_id: int
    is_superuser: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserInDB(UserResponse):
    """データベース内のユーザー"""
    hashed_password: str


# ========== Mentions Export Schemas ==========

class MentionsExportRequest(BaseModel):
    """言及集計Excel出力リクエスト"""
    start_date: str = Field(..., description="開始日(YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="終了日(YYYY-MM-DD) 未指定は今日")
    tiger_ids: List[str] = Field(..., min_items=1, description="対象社長IDの配列")
    filename: Optional[str] = Field(None, description="保存時のファイル名(省略可)")
    count_mode: str = Field(
        default="comment",
        description="言及カウント方式: 'comment' (コメント出現数) or 'occurrence' (文字列登場回数)"
    )
    performers_source: str = Field(
        default="comments",
        description="出演者算定: 'comments' (コメント上の言及) or 'db' (DBのVideoTiger)"
    )
