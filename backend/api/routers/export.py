"""
データエクスポート用APIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from models import get_db, Video, VideoTigerStats, Tiger
from utils.export import (
    export_video_stats_to_csv,
    export_ranking_to_csv,
    export_comments_to_csv,
    export_to_excel
)
from ..dependencies import get_current_user_optional

router = APIRouter()


@router.get("/video/{video_id}/csv")
async def export_video_csv(
    video_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional)
):
    """
    動画の統計データをCSV形式でエクスポート
    """
    # 動画の存在確認
    video = db.query(Video).filter(Video.video_id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="動画が見つかりません")

    # 統計データの取得
    stats = db.query(VideoTigerStats).filter(
        VideoTigerStats.video_id == video_id
    ).all()

    if not stats:
        raise HTTPException(status_code=404, detail="統計データが見つかりません")

    # データを整形
    tiger_stats = []
    for stat in stats:
        tiger = db.query(Tiger).filter(Tiger.tiger_id == stat.tiger_id).first()
        tiger_stats.append({
            "tiger_id": stat.tiger_id,
            "display_name": tiger.display_name if tiger else "Unknown",
            "mention_count": stat.n_tiger,
            "rate_total": stat.rate_total,
            "rate_entity": stat.rate_entity,
            "rank": stat.rank
        })

    video_stats = {
        "video_id": video.video_id,
        "title": video.title,
        "total_comments": video.comment_count,
        "tiger_mention_comments": sum(s.n_tiger for s in stats),
        "tiger_stats": tiger_stats
    }

    return export_video_stats_to_csv(video_stats)


@router.get("/ranking/csv")
async def export_ranking_csv(
    period: str = Query("30days", description="集計期間: 7days, 30days, 90days, all"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional)
):
    """
    ランキングデータをCSV形式でエクスポート
    """
    # 期間の計算
    if period == "7days":
        start_date = datetime.now() - timedelta(days=7)
    elif period == "30days":
        start_date = datetime.now() - timedelta(days=30)
    elif period == "90days":
        start_date = datetime.now() - timedelta(days=90)
    else:
        start_date = None

    # 統計データの集計
    query = db.query(VideoTigerStats)
    if start_date:
        query = query.join(Video).filter(Video.published_at >= start_date)

    stats = query.all()

    if not stats:
        raise HTTPException(status_code=404, detail="統計データが見つかりません")

    # 社長別に集計
    tiger_aggregates = {}
    for stat in stats:
        if stat.tiger_id not in tiger_aggregates:
            tiger_aggregates[stat.tiger_id] = {
                "total_mentions": 0,
                "video_count": 0,
                "total_rate_total": 0,
                "total_rate_entity": 0
            }

        agg = tiger_aggregates[stat.tiger_id]
        agg["total_mentions"] += stat.n_tiger
        agg["video_count"] += 1
        agg["total_rate_total"] += stat.rate_total
        agg["total_rate_entity"] += stat.rate_entity

    # ランキングデータを作成
    tiger_rankings = []
    for tiger_id, agg in tiger_aggregates.items():
        tiger = db.query(Tiger).filter(Tiger.tiger_id == tiger_id).first()
        if tiger:
            tiger_rankings.append({
                "tiger_id": tiger_id,
                "display_name": tiger.display_name,
                "total_mentions": agg["total_mentions"],
                "video_count": agg["video_count"],
                "avg_mentions": agg["total_mentions"] / agg["video_count"] if agg["video_count"] > 0 else 0,
                "avg_rate_total": agg["total_rate_total"] / agg["video_count"] if agg["video_count"] > 0 else 0,
                "avg_rate_entity": agg["total_rate_entity"] / agg["video_count"] if agg["video_count"] > 0 else 0
            })

    # 総言及数でソート
    tiger_rankings.sort(key=lambda x: x["total_mentions"], reverse=True)

    ranking_data = {
        "period": period,
        "total_videos": len(set(s.video_id for s in stats)),
        "tiger_rankings": tiger_rankings
    }

    return export_ranking_to_csv(ranking_data)


@router.get("/all/excel")
async def export_all_excel(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional)
):
    """
    全データをExcel形式でエクスポート
    """
    # 社長データ
    tigers = db.query(Tiger).all()
    tigers_data = [{
        "社長ID": t.tiger_id,
        "表示名": t.display_name,
        "本名": t.full_name,
        "説明": t.description
    } for t in tigers]

    # 動画データ
    videos = db.query(Video).limit(100).all()  # 最新100件
    videos_data = [{
        "動画ID": v.video_id,
        "タイトル": v.title,
        "公開日": v.published_at.strftime("%Y-%m-%d") if v.published_at else "",
        "再生数": v.view_count,
        "コメント数": v.comment_count
    } for v in videos]

    # 統計データ
    stats = db.query(VideoTigerStats).limit(500).all()  # 最新500件
    stats_data = []
    for s in stats:
        video = db.query(Video).filter(Video.video_id == s.video_id).first()
        tiger = db.query(Tiger).filter(Tiger.tiger_id == s.tiger_id).first()
        stats_data.append({
            "動画タイトル": video.title[:50] if video else "",
            "社長名": tiger.display_name if tiger else "",
            "言及数": s.n_tiger,
            "Rate_total": f"{s.rate_total * 100:.2f}%",
            "Rate_entity": f"{s.rate_entity * 100:.2f}%",
            "順位": s.rank
        })

    # Excelファイル作成
    data_dict = {
        "社長マスタ": tigers_data,
        "動画一覧": videos_data,
        "統計データ": stats_data
    }

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"reiwa_no_tora_data_{timestamp}.xlsx"

    return export_to_excel(data_dict, filename)