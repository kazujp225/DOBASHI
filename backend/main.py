"""
令和の虎 社長別コメント言及分析システム
FastAPI Backend
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api.routers import videos, tigers, analysis, stats

# .envファイルを読み込み
# プロジェクトルートの.envファイルを優先して読み込む
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    print(f"✅ .env file loaded from: {env_path}")
    api_key = os.environ.get('YOUTUBE_API_KEY', '')
    if api_key:
        print(f"✅ YOUTUBE_API_KEY loaded: {api_key[:20]}...")
    else:
        print("⚠️ YOUTUBE_API_KEY not found in environment")
else:
    # フォールバック: backend/.envも確認
    backend_env_path = Path(__file__).parent / '.env'
    if backend_env_path.exists():
        load_dotenv(backend_env_path)
        print(f"✅ .env file loaded from: {backend_env_path}")
    else:
        print(f"⚠️ .env file not found at {env_path}")

app = FastAPI(
    title="令和の虎 コメント分析API",
    description="YouTube動画のコメントを分析し、社長別の言及を集計するAPI",
    version="2.0.0",
    redirect_slashes=False  # 末尾スラッシュの自動リダイレクトを無効化
)

# 静的ファイルの配信設定
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React開発サーバー
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])
app.include_router(tigers.router, prefix="/api/tigers", tags=["tigers"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])


@app.get("/")
async def root():
    """API ルート"""
    return {
        "message": "令和の虎 コメント分析API",
        "version": "2.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
