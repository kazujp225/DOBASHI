"""
SQLAlchemy ORMモデル定義
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Video(Base):
    """動画テーブル"""
    __tablename__ = "videos"

    video_id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    channel_id = Column(String)
    channel_title = Column(String)
    published_at = Column(DateTime)
    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    thumbnail_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    comments = relationship("Comment", back_populates="video", cascade="all, delete-orphan")
    video_tigers = relationship("VideoTiger", back_populates="video", cascade="all, delete-orphan")
    video_tiger_stats = relationship("VideoTigerStats", back_populates="video", cascade="all, delete-orphan")

class Comment(Base):
    """コメントテーブル"""
    __tablename__ = "comments"

    comment_id = Column(String, primary_key=True)
    video_id = Column(String, ForeignKey("videos.video_id"), nullable=False)
    text_original = Column(Text, nullable=False)
    normalized_text = Column(Text)
    author_name = Column(String)
    author_channel_id = Column(String)
    like_count = Column(Integer, default=0)
    published_at = Column(DateTime)
    is_reply = Column(Boolean, default=False)
    parent_comment_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    # リレーション
    video = relationship("Video", back_populates="comments")
    tiger_relations = relationship("CommentTigerRelation", back_populates="comment", cascade="all, delete-orphan")

class Tiger(Base):
    """社長マスタテーブル"""
    __tablename__ = "tigers"

    tiger_id = Column(String, primary_key=True)
    display_name = Column(String, nullable=False)
    full_name = Column(String)
    description = Column(Text)
    image_url = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    aliases = relationship("TigerAlias", back_populates="tiger", cascade="all, delete-orphan")
    video_tigers = relationship("VideoTiger", back_populates="tiger")
    comment_relations = relationship("CommentTigerRelation", back_populates="tiger")
    video_stats = relationship("VideoTigerStats", back_populates="tiger")

class TigerAlias(Base):
    """社長エイリアステーブル"""
    __tablename__ = "tiger_aliases"

    alias_id = Column(Integer, primary_key=True, autoincrement=True)
    tiger_id = Column(String, ForeignKey("tigers.tiger_id"), nullable=False)
    alias_text = Column(String, nullable=False)
    alias_type = Column(String)  # formal, casual, nickname, contextual
    priority = Column(Integer, default=100)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # リレーション
    tiger = relationship("Tiger", back_populates="aliases")

class VideoTiger(Base):
    """動画×社長 関連テーブル"""
    __tablename__ = "video_tigers"

    video_id = Column(String, ForeignKey("videos.video_id"), primary_key=True)
    tiger_id = Column(String, ForeignKey("tigers.tiger_id"), primary_key=True)
    appearance_order = Column(Integer)  # 出演順序
    created_at = Column(DateTime, default=datetime.utcnow)

    # リレーション
    video = relationship("Video", back_populates="video_tigers")
    tiger = relationship("Tiger", back_populates="video_tigers")

class CommentTigerRelation(Base):
    """コメント×社長 関連テーブル"""
    __tablename__ = "comment_tiger_relations"

    relation_id = Column(Integer, primary_key=True, autoincrement=True)
    comment_id = Column(String, ForeignKey("comments.comment_id"), nullable=False)
    tiger_id = Column(String, ForeignKey("tigers.tiger_id"), nullable=False)
    matched_alias = Column(String)  # マッチした呼称
    match_method = Column(String)  # rule_based, llm_assisted
    confidence_score = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # リレーション
    comment = relationship("Comment", back_populates="tiger_relations")
    tiger = relationship("Tiger", back_populates="comment_relations")

class VideoTigerStats(Base):
    """動画×社長 統計テーブル"""
    __tablename__ = "video_tiger_stats"

    video_id = Column(String, ForeignKey("videos.video_id"), primary_key=True)
    tiger_id = Column(String, ForeignKey("tigers.tiger_id"), primary_key=True)
    n_total = Column(Integer, default=0)  # 動画の総コメント数
    n_entity = Column(Integer, default=0)  # 社長に言及したコメント数（全体）
    n_tiger = Column(Integer, default=0)  # この社長に言及したコメント数
    rate_total = Column(Float, default=0.0)  # N_tiger / N_total
    rate_entity = Column(Float, default=0.0)  # N_tiger / N_entity
    rank = Column(Integer)  # 動画内での順位
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # リレーション
    video = relationship("Video", back_populates="video_tiger_stats")
    tiger = relationship("Tiger", back_populates="video_stats")

class User(Base):
    """ユーザーテーブル（認証用）"""
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BatchJob(Base):
    """バッチ処理履歴テーブル"""
    __tablename__ = "batch_jobs"

    job_id = Column(Integer, primary_key=True, autoincrement=True)
    job_type = Column(String, nullable=False)  # collect, analyze, aggregate
    status = Column(String, nullable=False)  # pending, running, completed, failed
    target_id = Column(String)  # 対象のvideo_idやchannel_id
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    job_metadata = Column(JSON)  # 追加情報を格納（metadataは予約語なのでjob_metadataに変更）
    created_at = Column(DateTime, default=datetime.utcnow)