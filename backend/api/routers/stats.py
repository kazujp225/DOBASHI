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
async def get_video_stats(video_id: str):
    """動画の統計情報を取得"""
    stats_file = os.path.join(
        os.path.dirname(__file__),
        f"../../../data/video_stats_{video_id}.json"
    )

    if not os.path.exists(stats_file):
        raise HTTPException(
            status_code=404,
            detail=f"Stats for video {video_id} not found"
        )

    with open(stats_file, 'r', encoding='utf-8') as f:
        stats = json.load(f)

    return stats


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
