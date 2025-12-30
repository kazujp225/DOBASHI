"""
Stats API Router - 統計情報
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import datetime
import json
import os
import glob

from ..schemas import VideoStats, RankingStats, TigerStats
from models import get_db, Video, Tiger, VideoTigerStats, Comment, CommentTigerRelation

router = APIRouter()


@router.get("/video/{video_id}", response_model=VideoStats)
async def get_video_stats(video_id: str, db: Session = Depends(get_db)):
    """動画の統計情報を取得（データベースベース、JSONフォールバック対応）"""

    # JSONファイルパス
    stats_path = os.path.join(os.path.dirname(__file__), f"../../data/video_stats_{video_id}.json")

    # まずDBを確認
    video = db.query(Video).filter(Video.video_id == video_id).first()

    # DBにコメントがあるか確認
    total_comments = db.query(Comment).filter(Comment.video_id == video_id).count()

    # 社長言及コメント数を取得
    tiger_mention_comments = db.query(Comment.comment_id).join(
        CommentTigerRelation
    ).filter(Comment.video_id == video_id).distinct().count()

    # 社長別統計を取得（DB）
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

    # DBに統計がある場合（コメント数が0でも統計があれば返す）
    if tiger_stats:
        # total_commentsが0の場合、video.comment_countを使用
        actual_total_comments = total_comments if total_comments > 0 else (video.comment_count if video and video.comment_count else 0)
        # tiger_mention_commentsが0の場合、統計から推計
        actual_tiger_mentions = tiger_mention_comments if tiger_mention_comments > 0 else sum(s['mention_count'] for s in tiger_stats)
        return VideoStats(
            video_id=video_id,
            title=video.title if video else video_id,
            total_comments=actual_total_comments,
            tiger_mention_comments=actual_tiger_mentions,
            tiger_stats=tiger_stats
        )

    # DBに統計がない、またはコメントがない場合はJSONフォールバック
    try:
        with open(stats_path, 'r', encoding='utf-8') as f:
            stats_json = json.load(f)
        # JSONから取得したデータを返す（total_commentsもJSONから）
        return VideoStats(**stats_json)
    except FileNotFoundError:
        # JSONもない場合
        if video:
            # 動画はあるが統計がない
            return VideoStats(
                video_id=video_id,
                title=video.title,
                total_comments=total_comments,
                tiger_mention_comments=tiger_mention_comments,
                tiger_stats=[]
            )
        raise HTTPException(
            status_code=404,
            detail=f"Video {video_id} not found"
        )


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
            'total_mentions': int(total_mentions) if total_mentions is not None else 0,
            'total_videos': int(total_vids) if total_vids is not None else 0,
            'avg_rate_total': float(avg_rate_total) if avg_rate_total is not None else 0.0,
            'avg_rate_entity': float(avg_rate_entity) if avg_rate_entity is not None else 0.0,
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
        base = os.path.join(os.path.dirname(__file__), "../../data")
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


@router.get("/monthly")
async def get_available_months(db: Session = Depends(get_db)):
    """
    利用可能な月一覧を取得
    動画のpublished_atから年月を抽出して返す
    """
    # 動画の公開日から年月を抽出
    results = db.query(
        extract('year', Video.published_at).label('year'),
        extract('month', Video.published_at).label('month'),
        func.count(Video.video_id).label('video_count')
    ).filter(
        Video.published_at.isnot(None)
    ).group_by(
        extract('year', Video.published_at),
        extract('month', Video.published_at)
    ).order_by(
        extract('year', Video.published_at).desc(),
        extract('month', Video.published_at).desc()
    ).all()

    months = []
    for year, month, video_count in results:
        if year and month:
            months.append({
                "year": int(year),
                "month": int(month),
                "video_count": int(video_count),
                "label": f"{int(year)}年{int(month)}月"
            })

    return {"months": months}


@router.get("/monthly/{year}/{month}")
async def get_monthly_stats(year: int, month: int, db: Session = Depends(get_db)):
    """
    特定の月の統計を取得

    Args:
        year: 年
        month: 月

    Returns:
        - video_count: 動画数
        - total_comments: 総コメント数
        - mention_comments: 言及コメント数
        - tiger_rankings: 社長別ランキング
        - videos: その月の動画一覧
    """
    # その月の動画を取得
    videos = db.query(Video).filter(
        extract('year', Video.published_at) == year,
        extract('month', Video.published_at) == month
    ).order_by(Video.published_at.desc()).all()

    if not videos:
        raise HTTPException(
            status_code=404,
            detail=f"{year}年{month}月のデータが見つかりません"
        )

    video_ids = [v.video_id for v in videos]

    # 総コメント数を取得
    total_comments = db.query(Comment).filter(
        Comment.video_id.in_(video_ids)
    ).count()

    # 言及コメント数を取得
    mention_comments = db.query(Comment.comment_id).join(
        CommentTigerRelation
    ).filter(
        Comment.video_id.in_(video_ids)
    ).distinct().count()

    # 社長別統計を集計
    rankings = db.query(
        VideoTigerStats.tiger_id,
        Tiger.display_name,
        func.sum(VideoTigerStats.n_tiger).label('total_mentions'),
        func.count(VideoTigerStats.video_id).label('total_videos'),
        func.avg(VideoTigerStats.rate_total).label('avg_rate_total'),
        func.avg(VideoTigerStats.rate_entity).label('avg_rate_entity')
    ).join(
        Tiger, VideoTigerStats.tiger_id == Tiger.tiger_id
    ).filter(
        VideoTigerStats.video_id.in_(video_ids)
    ).group_by(
        VideoTigerStats.tiger_id, Tiger.display_name
    ).order_by(
        func.sum(VideoTigerStats.n_tiger).desc()
    ).all()

    # ランキングを構築
    tiger_rankings = []
    for i, (tiger_id, display_name, total_mentions, total_vids, avg_rate_total, avg_rate_entity) in enumerate(rankings, 1):
        tiger_rankings.append({
            'tiger_id': tiger_id,
            'display_name': display_name,
            'total_mentions': int(total_mentions) if total_mentions is not None else 0,
            'total_videos': int(total_vids) if total_vids is not None else 0,
            'avg_rate_total': float(avg_rate_total) if avg_rate_total is not None else 0.0,
            'avg_rate_entity': float(avg_rate_entity) if avg_rate_entity is not None else 0.0,
            'rank': i
        })

    # 動画一覧を構築
    video_list = []
    for v in videos:
        # 各動画のコメント数と言及コメント数を取得
        v_total_comments = db.query(Comment).filter(Comment.video_id == v.video_id).count()
        v_mention_comments = db.query(Comment.comment_id).join(
            CommentTigerRelation
        ).filter(Comment.video_id == v.video_id).distinct().count()

        video_list.append({
            'video_id': v.video_id,
            'title': v.title,
            'published_at': v.published_at.isoformat() if v.published_at else None,
            'total_comments': v_total_comments,
            'mention_comments': v_mention_comments,
            'thumbnail_url': v.thumbnail_url
        })

    return {
        "year": year,
        "month": month,
        "label": f"{year}年{month}月",
        "video_count": len(videos),
        "total_comments": total_comments,
        "mention_comments": mention_comments,
        "tiger_rankings": tiger_rankings,
        "videos": video_list
    }
