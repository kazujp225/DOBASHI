"""
令和の虎 社長別コメント言及分析システム
FastAPI Backend
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, WebSocket, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from sqlalchemy.exc import SQLAlchemyError
import logging

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

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# グローバル例外ハンドラー
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """バリデーションエラーのハンドラー"""
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "message": "リクエストの形式が正しくありません"
        }
    )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """データベースエラーのハンドラー"""
    logger.error(f"Database error: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "データベースエラーが発生しました",
            "message": "データベースとの接続に問題が発生しました。しばらくしてから再度お試しください。"
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """一般的な例外のハンドラー"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": str(exc),
            "message": "予期しないエラーが発生しました"
        }
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
    from sqlalchemy import text

    # データベース接続チェック
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
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
