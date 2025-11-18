"""
比較分析APIエンドポイント
動画間・期間間・社長間の比較機能
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta

from models import get_db, Video, Comment, VideoTigerStats, Tiger, CommentTigerRelation
from analyzers.sentiment_analyzer import SentimentAnalyzer
from core.cache import cache_manager
from ..dependencies import get_current_user_optional

router = APIRouter()

# 感情分析器のインスタンス
sentiment_analyzer = SentimentAnalyzer()


@router.post("/videos")
async def compare_videos(
    video_ids: List[str],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional)
):
    """
    複数動画の統計を比較
    """
    if len(video_ids) > 10:
        raise HTTPException(
            status_code=400,
            detail="一度に比較できる動画は10個までです"
        )

    comparison_results = []

    for video_id in video_ids:
        # 動画情報を取得
        video = db.query(Video).filter(Video.video_id == video_id).first()
        if not video:
            comparison_results.append({
                "video_id": video_id,
                "error": "動画が見つかりません"
            })
            continue

        # 統計情報を取得
        stats = db.query(VideoTigerStats).filter(
            VideoTigerStats.video_id == video_id
        ).all()

        # 上位3社長を取得
        top_tigers = []
        for stat in sorted(stats, key=lambda x: x.n_tiger, reverse=True)[:3]:
            tiger = db.query(Tiger).filter(Tiger.tiger_id == stat.tiger_id).first()
            if tiger:
                top_tigers.append({
                    "tiger_id": stat.tiger_id,
                    "display_name": tiger.display_name,
                    "mentions": stat.n_tiger,
                    "rate_total": round(stat.rate_total * 100, 2)
                })

        # コメントのサンプルを取得して感情分析
        sample_comments = db.query(Comment).filter(
            Comment.video_id == video_id
        ).limit(100).all()

        sentiment_summary = {"positive": 0, "negative": 0, "neutral": 0}
        if sample_comments:
            for comment in sample_comments:
                result = sentiment_analyzer.analyze(comment.text_original)
                sentiment_summary[result.sentiment] += 1

        comparison_results.append({
            "video_id": video_id,
            "title": video.title[:50] + "..." if len(video.title) > 50 else video.title,
            "published_at": video.published_at.isoformat() if video.published_at else None,
            "view_count": video.view_count,
            "comment_count": video.comment_count,
            "top_tigers": top_tigers,
            "sentiment": {
                "positive_ratio": round(sentiment_summary["positive"] / len(sample_comments) * 100, 1) if sample_comments else 0,
                "negative_ratio": round(sentiment_summary["negative"] / len(sample_comments) * 100, 1) if sample_comments else 0,
                "neutral_ratio": round(sentiment_summary["neutral"] / len(sample_comments) * 100, 1) if sample_comments else 0
            }
        })

    # メトリクスのサマリー
    valid_results = [r for r in comparison_results if "error" not in r]
    if valid_results:
        summary = {
            "avg_view_count": sum(r["view_count"] for r in valid_results) / len(valid_results),
            "avg_comment_count": sum(r["comment_count"] for r in valid_results) / len(valid_results),
            "total_views": sum(r["view_count"] for r in valid_results),
            "total_comments": sum(r["comment_count"] for r in valid_results)
        }
    else:
        summary = {}

    return {
        "videos": comparison_results,
        "summary": summary,
        "compared_at": datetime.now().isoformat()
    }


@router.get("/tigers/performance")
async def compare_tiger_performance(
    tiger_ids: str = Query(..., description="カンマ区切りの社長ID"),
    period_days: int = Query(30, description="比較期間（日数）"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional)
):
    """
    複数社長のパフォーマンスを比較
    """
    tiger_id_list = [tid.strip() for tid in tiger_ids.split(",")]
    if len(tiger_id_list) > 10:
        raise HTTPException(
            status_code=400,
            detail="一度に比較できる社長は10人までです"
        )

    # 期間の計算
    end_date = datetime.now()
    start_date = end_date - timedelta(days=period_days)

    comparison_results = []

    for tiger_id in tiger_id_list:
        # 社長情報を取得
        tiger = db.query(Tiger).filter(Tiger.tiger_id == tiger_id).first()
        if not tiger:
            comparison_results.append({
                "tiger_id": tiger_id,
                "error": "社長が見つかりません"
            })
            continue

        # 期間内の統計を集計
        stats_query = db.query(
            func.count(VideoTigerStats.video_id).label("video_count"),
            func.sum(VideoTigerStats.n_tiger).label("total_mentions"),
            func.avg(VideoTigerStats.rate_total).label("avg_rate_total"),
            func.avg(VideoTigerStats.rate_entity).label("avg_rate_entity"),
            func.avg(VideoTigerStats.rank).label("avg_rank")
        ).join(
            Video, VideoTigerStats.video_id == Video.video_id
        ).filter(
            VideoTigerStats.tiger_id == tiger_id,
            Video.published_at >= start_date,
            Video.published_at <= end_date
        ).first()

        # コメントの感情分析
        comments = db.query(Comment).join(
            CommentTigerRelation,
            Comment.comment_id == CommentTigerRelation.comment_id
        ).filter(
            CommentTigerRelation.tiger_id == tiger_id,
            Comment.published_at >= start_date,
            Comment.published_at <= end_date
        ).limit(200).all()

        sentiment_stats = {"positive": 0, "negative": 0, "neutral": 0}
        if comments:
            for comment in comments:
                result = sentiment_analyzer.analyze(comment.text_original)
                sentiment_stats[result.sentiment] += 1

        comparison_results.append({
            "tiger_id": tiger_id,
            "display_name": tiger.display_name,
            "metrics": {
                "video_count": stats_query.video_count or 0,
                "total_mentions": stats_query.total_mentions or 0,
                "avg_rate_total": round((stats_query.avg_rate_total or 0) * 100, 2),
                "avg_rate_entity": round((stats_query.avg_rate_entity or 0) * 100, 2),
                "avg_rank": round(stats_query.avg_rank or 0, 1)
            },
            "sentiment": {
                "positive_ratio": round(sentiment_stats["positive"] / len(comments) * 100, 1) if comments else 0,
                "negative_ratio": round(sentiment_stats["negative"] / len(comments) * 100, 1) if comments else 0,
                "neutral_ratio": round(sentiment_stats["neutral"] / len(comments) * 100, 1) if comments else 0,
                "sample_size": len(comments)
            }
        })

    # パフォーマンススコアを計算してランキング
    for result in comparison_results:
        if "error" not in result:
            # 総合スコアを計算（独自の重み付け）
            metrics = result["metrics"]
            sentiment = result["sentiment"]

            performance_score = (
                metrics["total_mentions"] * 0.3 +
                metrics["avg_rate_total"] * 10 +
                metrics["avg_rate_entity"] * 5 +
                sentiment["positive_ratio"] * 2 -
                sentiment["negative_ratio"] * 1 +
                (6 - metrics["avg_rank"]) * 20  # 順位が高いほどスコア高
            )
            result["performance_score"] = round(performance_score, 2)

    # スコアでソート
    valid_results = [r for r in comparison_results if "error" not in r]
    valid_results.sort(key=lambda x: x.get("performance_score", 0), reverse=True)

    # ランキングを付与
    for i, result in enumerate(valid_results, 1):
        result["rank"] = i

    return {
        "period_days": period_days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "tigers": comparison_results,
        "compared_at": datetime.now().isoformat()
    }


@router.get("/periods")
async def compare_periods(
    tiger_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional)
):
    """
    同じ社長の異なる期間のパフォーマンスを比較
    """
    # 社長の存在確認
    tiger = db.query(Tiger).filter(Tiger.tiger_id == tiger_id).first()
    if not tiger:
        raise HTTPException(status_code=404, detail="社長が見つかりません")

    # 複数期間の定義
    periods = [
        {"label": "直近1週間", "days": 7},
        {"label": "直近1ヶ月", "days": 30},
        {"label": "直近3ヶ月", "days": 90},
        {"label": "直近6ヶ月", "days": 180}
    ]

    period_results = []
    end_date = datetime.now()

    for period in periods:
        start_date = end_date - timedelta(days=period["days"])

        # 期間内の統計を集計
        stats = db.query(
            func.count(VideoTigerStats.video_id).label("video_count"),
            func.sum(VideoTigerStats.n_tiger).label("total_mentions"),
            func.avg(VideoTigerStats.rate_total).label("avg_rate_total"),
            func.avg(VideoTigerStats.rate_entity).label("avg_rate_entity")
        ).join(
            Video, VideoTigerStats.video_id == Video.video_id
        ).filter(
            VideoTigerStats.tiger_id == tiger_id,
            Video.published_at >= start_date,
            Video.published_at <= end_date
        ).first()

        # 成長率を計算（前期間との比較）
        growth_rate = 0
        if len(period_results) > 0 and period_results[-1]["metrics"]["total_mentions"] > 0:
            current_mentions = stats.total_mentions or 0
            prev_mentions = period_results[-1]["metrics"]["total_mentions"]
            growth_rate = ((current_mentions - prev_mentions) / prev_mentions) * 100

        period_results.append({
            "period": period["label"],
            "days": period["days"],
            "metrics": {
                "video_count": stats.video_count or 0,
                "total_mentions": stats.total_mentions or 0,
                "avg_rate_total": round((stats.avg_rate_total or 0) * 100, 2),
                "avg_rate_entity": round((stats.avg_rate_entity or 0) * 100, 2),
                "growth_rate": round(growth_rate, 1)
            }
        })

    return {
        "tiger_id": tiger_id,
        "display_name": tiger.display_name,
        "periods": period_results,
        "compared_at": datetime.now().isoformat()
    }


@router.get("/trending")
async def get_trending_comparison(
    db: Session = Depends(get_db),
    hours: int = Query(24, description="トレンド計算の時間範囲"),
    current_user=Depends(get_current_user_optional)
):
    """
    急上昇中の社長を検出（前期間との比較）
    """
    # キャッシュチェック
    cache_key = f"comparison:trending:{hours}"
    cached = cache_manager.get(cache_key)
    if cached:
        return cached

    # 現在期間と前期間を定義
    now = datetime.now()
    current_start = now - timedelta(hours=hours)
    previous_start = current_start - timedelta(hours=hours)

    # 全社長のリストを取得
    tigers = db.query(Tiger).filter(Tiger.is_active == True).all()

    trending_data = []

    for tiger in tigers:
        # 現在期間の言及数
        current_mentions = db.query(
            func.count(CommentTigerRelation.comment_id)
        ).join(
            Comment, CommentTigerRelation.comment_id == Comment.comment_id
        ).filter(
            CommentTigerRelation.tiger_id == tiger.tiger_id,
            Comment.published_at >= current_start,
            Comment.published_at <= now
        ).scalar() or 0

        # 前期間の言及数
        previous_mentions = db.query(
            func.count(CommentTigerRelation.comment_id)
        ).join(
            Comment, CommentTigerRelation.comment_id == Comment.comment_id
        ).filter(
            CommentTigerRelation.tiger_id == tiger.tiger_id,
            Comment.published_at >= previous_start,
            Comment.published_at < current_start
        ).scalar() or 0

        # 成長率を計算
        if previous_mentions > 0:
            growth_rate = ((current_mentions - previous_mentions) / previous_mentions) * 100
        elif current_mentions > 0:
            growth_rate = 100  # 前期間0から増加した場合
        else:
            growth_rate = 0

        if current_mentions > 0 or previous_mentions > 0:
            trending_data.append({
                "tiger_id": tiger.tiger_id,
                "display_name": tiger.display_name,
                "current_mentions": current_mentions,
                "previous_mentions": previous_mentions,
                "growth_rate": round(growth_rate, 1),
                "is_trending": growth_rate > 50  # 50%以上の成長でトレンド判定
            })

    # 成長率でソート
    trending_data.sort(key=lambda x: x["growth_rate"], reverse=True)

    # 上位と下位を抽出
    top_trending = trending_data[:5] if len(trending_data) > 5 else trending_data
    declining = [t for t in trending_data if t["growth_rate"] < -20][:5]

    response = {
        "period_hours": hours,
        "top_trending": top_trending,
        "declining": declining,
        "total_analyzed": len(trending_data),
        "generated_at": datetime.now().isoformat()
    }

    # キャッシュに保存（30分）
    cache_manager.set(cache_key, response, expire_seconds=1800)

    return response