"""
データベース接続設定
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from typing import Generator
import os
from pathlib import Path

# 設定をインポート
from core.config import settings

# データベースディレクトリの設定
if settings.database_type == "sqlite":
    DATABASE_DIR = settings.data_dir
    DATABASE_DIR.mkdir(exist_ok=True)

# データベースURLを取得
SQLALCHEMY_DATABASE_URL = settings.get_database_url

# エンジンの作成（データベースタイプに応じて設定を変更）
if settings.database_type == "postgresql":
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True  # 接続の健全性チェック
    )
else:  # SQLite
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool  # SQLite用のプール設定
    )

# セッションローカルクラスの作成
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ベースクラスの作成
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """
    データベースセッションを生成
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    データベースの初期化（テーブル作成）
    """
    from . import models  # モデルをインポート
    Base.metadata.create_all(bind=engine)
    print("データベースを初期化しました。")