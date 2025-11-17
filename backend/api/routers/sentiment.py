"""
感情分析APIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from models import get_db, Video, Comment
from analyzers.sentiment_analyzer import SentimentAnalyzer, SentimentResult
from core.cache import cache_manager, get_video_stats_cache_key
from ..dependencies import get_current_user_optional
from ..schemas import VideoStats

router = APIRouter(prefix="/sentiment", tags=["sentiment"])

# 感情分析器のインスタンス
sentiment_analyzer = SentimentAnalyzer()


@router.get("/video/{video_id}")
async def analyze_video_sentiment(
    video_id: str,
    db: Session = Depends(get_db),
    limit: int = Query(1000, description="分析するコメントの最大数"),
    use_cache: bool = Query(True, description="キャッシュを使用するか"),
    current_user=Depends(get_current_user_optional)
):
    """
    動画のコメントの感情分析を実行
    """
    # キャッシュチェック
    cache_key = f"sentiment:{video_id}"
    if use_cache:
        cached = cache_manager.get(cache_key)
        if cached:
            return cached

    # 動画の存在確認
    video = db.query(Video).filter(Video.video_id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="動画が見つかりません")

    # コメント取得
    comments = db.query(Comment).filter(
        Comment.video_id == video_id
    ).limit(limit).all()

    if not comments:
        return {
            "video_id": video_id,
            "total_comments": 0,
            "sentiment_summary": {
                "positive": 0,
                "negative": 0,
                "neutral": 0
            },
            "message": "コメントが見つかりません"
        }

    # 感情分析実行
    texts = [c.text_original for c in comments]
    results = sentiment_analyzer.analyze_batch(texts)

    # 結果の集計
    summary = sentiment_analyzer.get_summary_stats(results)

    # コメントごとの詳細結果
    detailed_results = []
    for comment, result in zip(comments[:10], results[:10]):  # 上位10件のみ詳細を返す
        detailed_results.append({
            "comment_id": comment.comment_id,
            "text": comment.text_original[:100] + "..." if len(comment.text_original) > 100 else comment.text_original,
            "sentiment": result.sentiment,
            "confidence": result.score,
            "scores": {
                "positive": result.positive_score,
                "negative": result.negative_score,
                "neutral": result.neutral_score
            }
        })

    response = {
        "video_id": video_id,
        "video_title": video.title,
        "total_comments_analyzed": len(results),
        "sentiment_summary": {
            "positive": summary["positive"],
            "negative": summary["negative"],
            "neutral": summary["neutral"],
            "positive_ratio": round(summary["positive_ratio"] * 100, 2),
            "negative_ratio": round(summary["negative_ratio"] * 100, 2),
            "neutral_ratio": round(summary["neutral_ratio"] * 100, 2),
            "average_confidence": round(summary["average_confidence"], 3)
        },
        "sample_results": detailed_results,
        "analyzed_at": datetime.now().isoformat()
    }

    # キャッシュに保存
    cache_manager.set(cache_key, response, expire_seconds=3600)

    return response


@router.get("/tiger/{tiger_id}/trend")
async def get_tiger_sentiment_trend(
    tiger_id: str,
    db: Session = Depends(get_db),
    days: int = Query(30, description="過去何日間のトレンド"),
    current_user=Depends(get_current_user_optional)
):
    """
    特定の社長に関するコメントの感情トレンドを取得
    """
    # キャッシュチェック
    cache_key = f"sentiment:trend:{tiger_id}:{days}"
    cached = cache_manager.get(cache_key)
    if cached:
        return cached

    # 日付範囲の計算
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    # SQLクエリで社長に言及しているコメントを取得
    from models import CommentTigerRelation

    query = db.query(Comment).join(
        CommentTigerRelation,
        Comment.comment_id == CommentTigerRelation.comment_id
    ).filter(
        CommentTigerRelation.tiger_id == tiger_id,
        Comment.published_at >= start_date,
        Comment.published_at <= end_date
    )

    comments = query.all()

    if not comments:
        return {
            "tiger_id": tiger_id,
            "period_days": days,
            "total_comments": 0,
            "message": "この期間のコメントが見つかりません"
        }

    # 日別に集計
    daily_sentiments = {}
    for comment in comments:
        date_key = comment.published_at.strftime("%Y-%m-%d") if comment.published_at else "unknown"

        if date_key not in daily_sentiments:
            daily_sentiments[date_key] = []

        # 感情分析
        result = sentiment_analyzer.analyze(comment.text_original)
        daily_sentiments[date_key].append(result)

    # 日別サマリーを作成
    trend_data = []
    for date_key in sorted(daily_sentiments.keys()):
        day_results = daily_sentiments[date_key]
        summary = sentiment_analyzer.get_summary_stats(day_results)

        trend_data.append({
            "date": date_key,
            "total": summary["total"],
            "positive": summary["positive"],
            "negative": summary["negative"],
            "neutral": summary["neutral"],
            "sentiment_score": summary["positive_ratio"] - summary["negative_ratio"]  # -1.0 ~ 1.0
        })

    # 全体のサマリー
    all_results = [r for results in daily_sentiments.values() for r in results]
    overall_summary = sentiment_analyzer.get_summary_stats(all_results)

    response = {
        "tiger_id": tiger_id,
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_comments_analyzed": len(comments),
        "overall_sentiment": {
            "positive_ratio": round(overall_summary["positive_ratio"] * 100, 2),
            "negative_ratio": round(overall_summary["negative_ratio"] * 100, 2),
            "neutral_ratio": round(overall_summary["neutral_ratio"] * 100, 2),
            "sentiment_score": round(overall_summary["positive_ratio"] - overall_summary["negative_ratio"], 3)
        },
        "daily_trend": trend_data
    }

    # キャッシュに保存（6時間）
    cache_manager.set(cache_key, response, expire_seconds=21600)

    return response


@router.post("/analyze")
async def analyze_text_sentiment(
    text: str,
    current_user=Depends(get_current_user_optional)
):
    """
    テキストの感情分析を実行（テスト用）
    """
    result = sentiment_analyzer.analyze(text)

    return {
        "text": text[:200] + "..." if len(text) > 200 else text,
        "sentiment": result.sentiment,
        "confidence": result.score,
        "scores": {
            "positive": result.positive_score,
            "negative": result.negative_score,
            "neutral": result.neutral_score
        }
    }


@router.get("/comparison")
async def compare_videos_sentiment(
    video_ids: List[str] = Query(..., description="比較する動画IDのリスト"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional)
):
    """
    複数動画の感情分析結果を比較
    """
    if len(video_ids) > 10:
        raise HTTPException(
            status_code=400,
            detail="一度に比較できる動画は10個までです"
        )

    comparison_results = []

    for video_id in video_ids:
        # 各動画の感情分析を実行
        video = db.query(Video).filter(Video.video_id == video_id).first()
        if not video:
            comparison_results.append({
                "video_id": video_id,
                "error": "動画が見つかりません"
            })
            continue

        # コメント取得と分析
        comments = db.query(Comment).filter(
            Comment.video_id == video_id
        ).limit(500).all()  # 比較時は500件に制限

        if comments:
            texts = [c.text_original for c in comments]
            results = sentiment_analyzer.analyze_batch(texts)
            summary = sentiment_analyzer.get_summary_stats(results)

            comparison_results.append({
                "video_id": video_id,
                "title": video.title[:50] + "..." if len(video.title) > 50 else video.title,
                "comments_analyzed": len(results),
                "positive_ratio": round(summary["positive_ratio"] * 100, 2),
                "negative_ratio": round(summary["negative_ratio"] * 100, 2),
                "neutral_ratio": round(summary["neutral_ratio"] * 100, 2),
                "sentiment_score": round(summary["positive_ratio"] - summary["negative_ratio"], 3)
            })
        else:
            comparison_results.append({
                "video_id": video_id,
                "title": video.title[:50] + "..." if len(video.title) > 50 else video.title,
                "error": "コメントが見つかりません"
            })

    # ランキング計算
    valid_results = [r for r in comparison_results if "error" not in r]
    if valid_results:
        # sentiment_scoreでソート
        valid_results.sort(key=lambda x: x["sentiment_score"], reverse=True)
        for i, result in enumerate(valid_results, 1):
            result["rank"] = i

    return {
        "comparison": comparison_results,
        "analyzed_at": datetime.now().isoformat()
    }