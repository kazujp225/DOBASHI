"""
Videos API Router
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import json
import os

from ..schemas import Video, VideoWithStats
from models import get_db, Video as VideoDB, Comment, CommentTigerRelation, VideoTigerStats, VideoTiger

router = APIRouter()

VIDEOS_FILE = os.path.join(os.path.dirname(__file__), "../../data/videos.json")


def load_videos() -> List[dict]:
    """動画データを読み込み"""
    try:
        with open(VIDEOS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []


@router.get("", response_model=List[Video])
async def get_all_videos(db: Session = Depends(get_db)):
    """全動画を取得（DB優先、JSONフォールバック）"""
    # まずDBから取得
    db_videos = db.query(VideoDB).order_by(VideoDB.published_at.desc()).all()

    if db_videos:
        return [
            {
                "video_id": v.video_id,
                "title": v.title,
                "channel_id": v.channel_id or "",
                "channel_title": v.channel_title or "",
                "published_at": v.published_at.isoformat() if v.published_at else "",
                "view_count": v.view_count or 0,
                "comment_count": v.comment_count or 0,
                "thumbnail_url": v.thumbnail_url or ""
            }
            for v in db_videos
        ]

    # DBにない場合はJSONから
    return load_videos()


@router.get("/{video_id}", response_model=VideoWithStats)
async def get_video(video_id: str, db: Session = Depends(get_db)):
    """特定の動画を取得（統計情報付き）"""
    # まずDBから取得
    db_video = db.query(VideoDB).filter(VideoDB.video_id == video_id).first()

    if db_video:
        video = {
            "video_id": db_video.video_id,
            "title": db_video.title,
            "channel_id": db_video.channel_id or "",
            "channel_title": db_video.channel_title or "",
            "published_at": db_video.published_at.isoformat() if db_video.published_at else "",
            "view_count": db_video.view_count or 0,
            "comment_count": db_video.comment_count or 0,
            "thumbnail_url": db_video.thumbnail_url or "",
            "tiger_stats": []
        }
        return video

    # JSONフォールバック
    videos = load_videos()
    video = next((v for v in videos if v['video_id'] == video_id), None)

    if not video:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    # 統計情報を読み込み
    stats_file = os.path.join(os.path.dirname(__file__), f"../../data/video_stats_{video_id}.json")
    try:
        with open(stats_file, 'r', encoding='utf-8') as f:
            stats = json.load(f)
            video['tiger_stats'] = stats.get('tiger_stats', [])
    except FileNotFoundError:
        video['tiger_stats'] = []

    return video


@router.delete("/reset-all")
async def reset_all_videos(db: Session = Depends(get_db)):
    """全動画データをリセット（DB内の動画、コメント、統計を削除）"""
    try:
        # 関連テーブルから順に削除
        deleted_relations = db.query(CommentTigerRelation).delete()
        deleted_video_tigers = db.query(VideoTiger).delete()
        deleted_stats = db.query(VideoTigerStats).delete()
        deleted_comments = db.query(Comment).delete()
        deleted_videos = db.query(VideoDB).delete()

        db.commit()

        return {
            "status": "success",
            "message": "全データをリセットしました",
            "deleted": {
                "videos": deleted_videos,
                "comments": deleted_comments,
                "comment_tiger_relations": deleted_relations,
                "video_tiger_stats": deleted_stats,
                "video_tigers": deleted_video_tigers
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"リセットに失敗しました: {str(e)}")
