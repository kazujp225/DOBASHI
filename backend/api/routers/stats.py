"""
Stats API Router - 統計情報
"""
from fastapi import APIRouter, HTTPException
from typing import List
import json
import os
import glob

from ..schemas import VideoStats, RankingStats, TigerStats

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
async def get_ranking(period: str = "all"):
    """
    社長別ランキングを取得

    Args:
        period: 集計期間 ("all", "month", "week")
    """
    data_dir = os.path.join(os.path.dirname(__file__), "../../../data")

    # 全ての統計ファイルを読み込み
    stats_files = glob.glob(os.path.join(data_dir, "video_stats_*.json"))

    if not stats_files:
        return RankingStats(
            period=period,
            total_videos=0,
            tiger_rankings=[]
        )

    # 社長ごとの集計
    tiger_aggregation = {}

    for stats_file in stats_files:
        with open(stats_file, 'r', encoding='utf-8') as f:
            stats = json.load(f)

        for tiger_stat in stats.get('tiger_stats', []):
            tiger_id = tiger_stat['tiger_id']

            if tiger_id not in tiger_aggregation:
                tiger_aggregation[tiger_id] = {
                    'tiger_id': tiger_id,
                    'display_name': tiger_stat['display_name'],
                    'total_mentions': 0,
                    'total_videos': 0,
                    'avg_rate_total': 0,
                    'avg_rate_entity': 0
                }

            tiger_aggregation[tiger_id]['total_mentions'] += tiger_stat.get('mention_count', 0)
            tiger_aggregation[tiger_id]['total_videos'] += 1
            tiger_aggregation[tiger_id]['avg_rate_total'] += tiger_stat.get('rate_total', 0)
            tiger_aggregation[tiger_id]['avg_rate_entity'] += tiger_stat.get('rate_entity', 0)

    # 平均を計算
    for tiger_id, data in tiger_aggregation.items():
        if data['total_videos'] > 0:
            data['avg_rate_total'] /= data['total_videos']
            data['avg_rate_entity'] /= data['total_videos']

    # ランキングでソート
    rankings = sorted(
        tiger_aggregation.values(),
        key=lambda x: x['total_mentions'],
        reverse=True
    )

    # 順位を追加
    for i, ranking in enumerate(rankings, 1):
        ranking['rank'] = i

    return RankingStats(
        period=period,
        total_videos=len(stats_files),
        tiger_rankings=rankings
    )
