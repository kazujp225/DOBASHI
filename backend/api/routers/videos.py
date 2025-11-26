"""
Videos API Router
"""
from fastapi import APIRouter, HTTPException
from typing import List
import json
import os

from ..schemas import Video, VideoWithStats

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
async def get_all_videos():
    """全動画を取得"""
    videos = load_videos()
    return videos


@router.get("/{video_id}", response_model=VideoWithStats)
async def get_video(video_id: str):
    """特定の動画を取得（統計情報付き）"""
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
