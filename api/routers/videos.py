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


@router.get("/analyzed")
async def get_analyzed_videos(db: Session = Depends(get_db)):
    """分析済み動画を取得（VideoTigerStatsにデータがある動画）"""
    from sqlalchemy import func, distinct

    # VideoTigerStatsにデータがある動画IDを取得
    analyzed_video_ids = db.query(distinct(VideoTigerStats.video_id)).all()
    analyzed_ids = [vid[0] for vid in analyzed_video_ids]

    if not analyzed_ids:
        return []

    # 動画情報を取得
    db_videos = db.query(VideoDB).filter(VideoDB.video_id.in_(analyzed_ids)).order_by(VideoDB.published_at.desc()).all()

    result = []
    for v in db_videos:
        # 統計サマリを取得
        stats = db.query(VideoTigerStats).filter(VideoTigerStats.video_id == v.video_id).all()
        total_mentions = sum(s.n_tiger or 0 for s in stats)
        tiger_count = len([s for s in stats if (s.n_tiger or 0) > 0])

        result.append({
            "video_id": v.video_id,
            "title": v.title,
            "description": v.description or "",
            "channel_id": v.channel_id or "",
            "channel_title": v.channel_title or "",
            "published_at": v.published_at.isoformat() if v.published_at else "",
            "view_count": v.view_count or 0,
            "comment_count": v.comment_count or 0,
            "thumbnail_url": v.thumbnail_url or "",
            "total_mentions": total_mentions,
            "tiger_count": tiger_count
        })

    return result


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
                "description": v.description or "",
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
            "description": db_video.description or "",
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


@router.delete("/{video_id}")
async def delete_video(video_id: str, db: Session = Depends(get_db)):
    """特定の動画とその関連データを削除"""
    try:
        # 動画が存在するか確認
        video = db.query(VideoDB).filter(VideoDB.video_id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

        # 関連データを削除（コメントIDを取得してから削除）
        comment_ids = [c.comment_id for c in db.query(Comment).filter(Comment.video_id == video_id).all()]

        # CommentTigerRelationを削除
        if comment_ids:
            db.query(CommentTigerRelation).filter(CommentTigerRelation.comment_id.in_(comment_ids)).delete(synchronize_session=False)

        # VideoTigerを削除
        db.query(VideoTiger).filter(VideoTiger.video_id == video_id).delete()

        # VideoTigerStatsを削除
        db.query(VideoTigerStats).filter(VideoTigerStats.video_id == video_id).delete()

        # コメントを削除
        deleted_comments = db.query(Comment).filter(Comment.video_id == video_id).delete()

        # 動画を削除
        db.delete(video)

        db.commit()

        return {
            "status": "success",
            "message": f"動画 {video_id} を削除しました",
            "video_id": video_id,
            "deleted_comments": deleted_comments
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"削除に失敗しました: {str(e)}")


@router.delete("/reset-all/confirm")
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
