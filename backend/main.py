"""
令和の虎 社長別コメント言及分析システム
FastAPI Backend
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

# ローカルインポート
from api.routers import (
    videos, tigers, analysis, stats, auth, export,
    sentiment, wordcloud, comparison
)
from api.websocket import websocket_endpoint
from core import settings
from models import init_db
from api.dependencies import get_current_user_optional

# スタートアップイベント
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    アプリケーションのライフサイクル管理
    """
    # 起動時の処理
    print("🚀 アプリケーションを起動します...")

    # データベースの初期化
    init_db()

    # 設定の確認
    if settings.youtube_api_key:
        print(f"✅ YouTube API Key: {settings.youtube_api_key[:20]}...")
    else:
        print("⚠️ YouTube API Key not configured")

    if settings.redis_url:
        print(f"✅ Redis URL: {settings.redis_url}")
    else:
        print("ℹ️ Using in-memory cache (Redis not configured)")

    yield

    # シャットダウン時の処理
    print("👋 アプリケーションを終了します...")

app = FastAPI(
    title=settings.app_name,
    description="YouTube動画のコメントを分析し、社長別の言及を集計するAPI",
    version=settings.app_version,
    redirect_slashes=False,  # 末尾スラッシュの自動リダイレクトを無効化
    lifespan=lifespan
)

# 静的ファイルの配信設定
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
# API v1
api_v1_prefix = settings.api_v1_str
app.include_router(auth.router, prefix=api_v1_prefix, tags=["authentication"])
app.include_router(videos.router, prefix=f"{api_v1_prefix}/videos", tags=["videos"])
app.include_router(tigers.router, prefix=f"{api_v1_prefix}/tigers", tags=["tigers"])
app.include_router(analysis.router, prefix=f"{api_v1_prefix}/analysis", tags=["analysis"])
app.include_router(stats.router, prefix=f"{api_v1_prefix}/stats", tags=["stats"])
app.include_router(export.router, prefix=f"{api_v1_prefix}/export", tags=["export"])
app.include_router(sentiment.router, prefix=f"{api_v1_prefix}/sentiment", tags=["sentiment"])
app.include_router(wordcloud.router, prefix=f"{api_v1_prefix}/wordcloud", tags=["wordcloud"])
app.include_router(comparison.router, prefix=f"{api_v1_prefix}/comparison", tags=["comparison"])

# WebSocketエンドポイント
@app.websocket("/ws")
async def websocket_route(websocket: WebSocket):
    await websocket_endpoint(websocket)


@app.get("/")
async def root(current_user=Depends(get_current_user_optional)):
    """API ルート"""
    return {
        "message": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "redoc": "/redoc",
        "authenticated": current_user is not None,
        "user": current_user.username if current_user else None
    }


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    from models import get_db

    # データベース接続チェック
    try:
        db = next(get_db())
        db.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    # キャッシュ接続チェック
    from core.cache import cache_manager
    cache_status = "healthy" if cache_manager.redis_client else "using memory cache"

    return {
        "status": "healthy",
        "database": db_status,
        "cache": cache_status,
        "version": settings.app_version
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
