"""
令和の虎 社長別コメント言及分析システム
FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import videos, tigers, analysis, stats

app = FastAPI(
    title="令和の虎 コメント分析API",
    description="YouTube動画のコメントを分析し、社長別の言及を集計するAPI",
    version="2.0.0"
)

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
