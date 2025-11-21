"""
Stats API Router - 統計情報
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import json
import os
import glob

from ..schemas import VideoStats, RankingStats, TigerStats
from models import get_db, Video, Tiger, VideoTigerStats, Comment, CommentTigerRelation

router = APIRouter()


@router.get("/video/{video_id}", response_model=VideoStats)
async def get_video_stats(video_id: str, db: Session = Depends(get_db)):
    """動画の統計情報を取得（データベースベース）"""
    # まずDBを確認し、なければJSONファイルからフォールバック
    video = db.query(Video).filter(Video.video_id == video_id).first()
    if not video:
        # JSONフォールバック
        try:
            stats_path = os.path.join(os.path.dirname(__file__), f"../../../data/video_stats_{video_id}.json")
            with open(stats_path, 'r', encoding='utf-8') as f:
                stats_json = json.load(f)
            return VideoStats(**stats_json)
        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail=f"Video {video_id} not found"
            )

    # コメント数を取得
    total_comments = db.query(Comment).filter(Comment.video_id == video_id).count()

    # 社長言及コメント数を取得
    tiger_mention_comments = db.query(Comment.comment_id).join(
        CommentTigerRelation
    ).filter(Comment.video_id == video_id).distinct().count()

    # 社長別統計を取得
    stats_query = db.query(
        VideoTigerStats.tiger_id,
        Tiger.display_name,
        VideoTigerStats.n_tiger,
        VideoTigerStats.rate_total,
        VideoTigerStats.rate_entity,
        VideoTigerStats.rank
    ).join(
        Tiger, VideoTigerStats.tiger_id == Tiger.tiger_id
    ).filter(
        VideoTigerStats.video_id == video_id
    ).order_by(VideoTigerStats.rank).all()

    # 統計リストを構築
    tiger_stats = []
    for tiger_id, display_name, n_tiger, rate_total, rate_entity, rank in stats_query:
        tiger_stats.append({
            'tiger_id': tiger_id,
            'display_name': display_name,
            'mention_count': int(n_tiger or 0),
            'rate_total': float(rate_total or 0),
            'rate_entity': float(rate_entity or 0),
            'rank': int(rank or 0)
        })

    if tiger_stats:
        return VideoStats(
            video_id=video_id,
            title=video.title,
            total_comments=total_comments,
            tiger_mention_comments=tiger_mention_comments,
            tiger_stats=tiger_stats
        )

    # DBに統計がない場合はJSONフォールバック
    try:
        stats_path = os.path.join(os.path.dirname(__file__), f"../../../data/video_stats_{video_id}.json")
        with open(stats_path, 'r', encoding='utf-8') as f:
            stats_json = json.load(f)
        return VideoStats(**stats_json)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="統計データが見つかりません")


@router.get("/ranking", response_model=RankingStats)
async def get_ranking(period: str = "all", db: Session = Depends(get_db)):
    """
    社長別ランキングを取得（データベースベース）

    Args:
        period: 集計期間 ("all", "month", "week")
    """
    # 動画数を取得
    total_videos = db.query(Video).count()

    # 社長ごとの統計を集計
    results = db.query(
        VideoTigerStats.tiger_id,
        Tiger.display_name,
        func.sum(VideoTigerStats.n_tiger).label('total_mentions'),
        func.count(VideoTigerStats.video_id).label('total_videos'),
        func.avg(VideoTigerStats.rate_total).label('avg_rate_total'),
        func.avg(VideoTigerStats.rate_entity).label('avg_rate_entity')
    ).join(
        Tiger, VideoTigerStats.tiger_id == Tiger.tiger_id
    ).group_by(
        VideoTigerStats.tiger_id, Tiger.display_name
    ).order_by(
        func.sum(VideoTigerStats.n_tiger).desc()
    ).all()

    # ランキングを構築
    rankings = []
    for i, (tiger_id, display_name, total_mentions, total_vids, avg_rate_total, avg_rate_entity) in enumerate(results, 1):
        rankings.append({
            'tiger_id': tiger_id,
            'display_name': display_name,
            'total_mentions': int(total_mentions or 0),
            'total_videos': int(total_vids or 0),
            'avg_rate_total': float(avg_rate_total or 0),
            'avg_rate_entity': float(avg_rate_entity or 0),
            'rank': i
        })

    return RankingStats(
        period=period,
        total_videos=total_videos,
        tiger_rankings=rankings
    )
@router.get("/overview")
async def get_overview(db: Session = Depends(get_db)):
    """
    簡易な全体サマリー（レポートプレビュー等で使用）
    - total_videos: 動画数
    - total_comments: 総コメント数（DBなければJSONの合計）
    - tiger_mentions: 全動画の社長言及コメント総数（推定）
    """
    total_videos = db.query(Video).count()
    total_comments = db.query(Comment).count()

    if total_videos == 0 and total_comments == 0:
        # JSONフォールバック
        import os, json
        base = os.path.join(os.path.dirname(__file__), "../../../data")
        videos_path = os.path.join(base, "videos.json")
        try:
            with open(videos_path, 'r', encoding='utf-8') as f:
                vids = json.load(f)
                total_videos = len(vids)
                total_comments = sum(int(v.get('comment_count', 0)) for v in vids)
        except Exception:
            pass

    # 言及コメント数（推定）: CommentTigerRelationのコメントID distinct
    mention_comments = db.query(Comment.comment_id).join(
        CommentTigerRelation, Comment.comment_id == CommentTigerRelation.comment_id
    ).distinct().count()

    return {
        "total_videos": total_videos,
        "total_comments": total_comments,
        "tiger_mentions": mention_comments,
        "period": "all"
    }
