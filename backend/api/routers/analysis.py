"""
Analysis API Router - コメント収集と分析
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict
import json
import os
import time
import sys

# プロジェクトルートをパスに追加
sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))

from collectors.youtube_collector import YouTubeCollector
from analyzers.comment_analyzer import CommentAnalyzer
from aggregators.stats_aggregator import StatsAggregator
from ..schemas import CollectionRequest, CollectionProgress, AnalysisRequest, AnalysisResult

router = APIRouter()

# 進捗管理用の簡易ストレージ
collection_status: Dict[str, CollectionProgress] = {}


def extract_video_id(url: str) -> str:
    """YouTube URLから動画IDを抽出"""
    if "youtube.com/watch?v=" in url:
        return url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[1].split("?")[0]
    else:
        return url


@router.post("/collect", response_model=CollectionProgress)
async def collect_comments(request: CollectionRequest, background_tasks: BackgroundTasks):
    """
    YouTube動画のコメントを収集（バックグラウンド処理）
    """
    video_id = extract_video_id(request.video_url)

    # 初期ステータスを設定
    collection_status[video_id] = CollectionProgress(
        status="collecting",
        video_id=video_id,
        collected_comments=0,
        message="コメント収集を開始しました"
    )

    # バックグラウンドタスクを追加
    background_tasks.add_task(collect_comments_task, video_id)

    return collection_status[video_id]


def collect_comments_task(video_id: str):
    """コメント収集のバックグラウンドタスク"""
    try:
        collector = YouTubeCollector()

        # 動画情報を取得
        video_info = collector.get_video_info(video_id)

        # コメントを収集
        comments = collector.get_comments(video_id, max_results=1000)

        # データを保存
        data_dir = os.path.join(os.path.dirname(__file__), "../../../data")
        os.makedirs(data_dir, exist_ok=True)

        # 動画データを保存
        videos_file = os.path.join(data_dir, "videos.json")
        if os.path.exists(videos_file):
            with open(videos_file, 'r', encoding='utf-8') as f:
                videos = json.load(f)
        else:
            videos = []

        # 既存の動画を更新または追加
        existing_index = next((i for i, v in enumerate(videos) if v['video_id'] == video_id), None)
        if existing_index is not None:
            videos[existing_index] = video_info
        else:
            videos.append(video_info)

        with open(videos_file, 'w', encoding='utf-8') as f:
            json.dump(videos, f, ensure_ascii=False, indent=2)

        # コメントデータを保存
        comments_file = os.path.join(data_dir, f"comments_{video_id}.json")
        with open(comments_file, 'w', encoding='utf-8') as f:
            json.dump(comments, f, ensure_ascii=False, indent=2)

        # ステータスを更新
        collection_status[video_id] = CollectionProgress(
            status="completed",
            video_id=video_id,
            collected_comments=len(comments),
            total_comments=video_info.get('comment_count', len(comments)),
            message=f"{len(comments)}件のコメントを収集しました"
        )

    except Exception as e:
        collection_status[video_id] = CollectionProgress(
            status="error",
            video_id=video_id,
            collected_comments=0,
            message=f"エラー: {str(e)}"
        )


@router.get("/collect/{video_id}", response_model=CollectionProgress)
async def get_collection_status(video_id: str):
    """コメント収集の進捗を取得"""
    if video_id not in collection_status:
        raise HTTPException(status_code=404, detail="Collection not found")

    return collection_status[video_id]


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_comments(request: AnalysisRequest):
    """
    収集済みコメントを分析
    """
    start_time = time.time()

    # コメントデータを読み込み
    comments_file = os.path.join(
        os.path.dirname(__file__),
        f"../../../data/comments_{request.video_id}.json"
    )

    if not os.path.exists(comments_file):
        raise HTTPException(
            status_code=404,
            detail=f"Comments for video {request.video_id} not found. Please collect first."
        )

    with open(comments_file, 'r', encoding='utf-8') as f:
        comments = json.load(f)

    # 社長マスタを読み込み
    tigers_file = os.path.join(os.path.dirname(__file__), "../../../data/tigers.json")
    with open(tigers_file, 'r', encoding='utf-8') as f:
        all_tigers = json.load(f)

    # 指定された社長のみフィルタ
    tigers = [t for t in all_tigers if t['tiger_id'] in request.tiger_ids]

    # 分析実行
    analyzer = CommentAnalyzer(tigers)
    analyzed_comments = []

    for comment in comments:
        mentioned_tigers = analyzer.analyze_comment(comment['text'])
        if mentioned_tigers:
            analyzed_comments.append({
                **comment,
                'mentioned_tigers': mentioned_tigers
            })

    # 統計集計
    aggregator = StatsAggregator()
    stats = aggregator.aggregate_video_stats(
        video_id=request.video_id,
        comments=comments,
        analyzed_comments=analyzed_comments,
        tigers=tigers
    )

    # 統計データを保存
    stats_file = os.path.join(
        os.path.dirname(__file__),
        f"../../../data/video_stats_{request.video_id}.json"
    )
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    processing_time = time.time() - start_time

    return AnalysisResult(
        video_id=request.video_id,
        total_comments=len(comments),
        analyzed_comments=len(analyzed_comments),
        tiger_mentions={t['tiger_id']: sum(1 for c in analyzed_comments if t['tiger_id'] in c['mentioned_tigers']) for t in tigers},
        processing_time=processing_time
    )
