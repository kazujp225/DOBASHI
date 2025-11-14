"""
Analysis API Router - コメント収集と分析
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict
import json
import os
import time
import sys
from pathlib import Path
from dotenv import load_dotenv

# プロジェクトルートをパスに追加
sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))

# .envファイルを読み込み
env_path = Path(__file__).parent.parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    print(f"[analysis.py] ✅ .env file loaded from: {env_path}")
else:
    print(f"[analysis.py] ⚠️ .env file not found at: {env_path}")

from collectors.youtube_collector import YouTubeCollector
from analyzers.comment_analyzer import CommentAnalyzer
from aggregators.stats_aggregator import StatsAggregator
from ..schemas import CollectionRequest, CollectionProgress, AnalysisRequest, AnalysisResult, LogEntry

# YouTube API キーを環境変数から取得
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY', '')
if YOUTUBE_API_KEY:
    print(f"[analysis.py] ✅ YOUTUBE_API_KEY loaded: {YOUTUBE_API_KEY[:20]}...")
else:
    print(f"[analysis.py] ⚠️ YOUTUBE_API_KEY not found in environment")

router = APIRouter()

# 進捗管理用の簡易ストレージ
collection_status: Dict[str, CollectionProgress] = {}


def add_log(video_id: str, level: str, message: str, emoji: str = None):
    """ログエントリを追加"""
    from datetime import datetime
    if video_id in collection_status:
        log_entry = LogEntry(
            timestamp=datetime.now().isoformat(),
            level=level,
            message=message,
            emoji=emoji
        )
        collection_status[video_id].logs.append(log_entry)


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
        message="コメント収集を開始しました",
        logs=[]
    )

    # バックグラウンドタスクを追加
    background_tasks.add_task(collect_comments_task, video_id)

    return collection_status[video_id]


def collect_comments_task(video_id: str):
    """コメント収集のバックグラウンドタスク"""
    try:
        add_log(video_id, "info", "🚀 コメント収集を開始しました", "🚀")

        # APIキーのチェック
        if not YOUTUBE_API_KEY:
            add_log(video_id, "error", "❌ YouTube API キーが設定されていません", "❌")
            collection_status[video_id] = CollectionProgress(
                status="error",
                video_id=video_id,
                collected_comments=0,
                message="エラー: YOUTUBE_API_KEY環境変数が設定されていません",
                logs=collection_status[video_id].logs
            )
            return

        add_log(video_id, "info", "🔑 API キーを確認しました", "🔑")
        collector = YouTubeCollector(YOUTUBE_API_KEY)

        # 動画情報を取得
        add_log(video_id, "info", "📹 動画情報を取得中...", "📹")
        video_info = collector.get_video_details(video_id)

        if not video_info:
            add_log(video_id, "error", "❌ 動画情報の取得に失敗しました", "❌")
            collection_status[video_id] = CollectionProgress(
                status="error",
                video_id=video_id,
                collected_comments=0,
                message="エラー: 動画情報の取得に失敗しました。動画IDが正しいか確認してください",
                logs=collection_status[video_id].logs
            )
            return

        add_log(video_id, "success", f"✅ 動画情報を取得: {video_info['title']}", "✅")
        add_log(video_id, "info", f"📊 総コメント数: {video_info.get('comment_count', 0):,}件", "📊")

        # コメントを収集（全件取得）
        add_log(video_id, "info", "💬 コメントを収集中...", "💬")
        comments = collector.get_video_comments(video_id, max_results=None)
        add_log(video_id, "success", f"✨ {len(comments):,}件のコメントを収集しました", "✨")

        # データを保存
        add_log(video_id, "info", "💾 データを保存中...", "💾")
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

        add_log(video_id, "success", "✅ 動画情報を保存しました", "✅")

        # コメントデータを保存
        comments_file = os.path.join(data_dir, f"comments_{video_id}.json")
        with open(comments_file, 'w', encoding='utf-8') as f:
            json.dump(comments, f, ensure_ascii=False, indent=2)

        add_log(video_id, "success", "✅ コメントデータを保存しました", "✅")
        add_log(video_id, "success", "🎉 コメント収集が完了しました！", "🎉")

        # ステータスを更新
        collection_status[video_id] = CollectionProgress(
            status="completed",
            video_id=video_id,
            collected_comments=len(comments),
            total_comments=video_info.get('comment_count', len(comments)),
            message=f"{len(comments)}件のコメントを収集しました",
            logs=collection_status[video_id].logs
        )

    except Exception as e:
        add_log(video_id, "error", f"❌ エラーが発生しました: {str(e)}", "❌")
        collection_status[video_id] = CollectionProgress(
            status="error",
            video_id=video_id,
            collected_comments=0,
            message=f"エラー: {str(e)}",
            logs=collection_status[video_id].logs if video_id in collection_status else []
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

    # 社長マスタのパス
    tigers_file = os.path.join(os.path.dirname(__file__), "../../../data/tigers.json")
    aliases_file = os.path.join(os.path.dirname(__file__), "../../../data/aliases.json")

    # 社長データを読み込み（統計用）
    with open(tigers_file, 'r', encoding='utf-8') as f:
        all_tigers = json.load(f)

    # 指定された社長のみフィルタ
    tigers = [t for t in all_tigers if t['tiger_id'] in request.tiger_ids]

    # 分析実行
    analyzer = CommentAnalyzer(tigers_file, aliases_file)
    analyzed_comments = []

    for comment in comments:
        result = analyzer.find_tiger_mentions(comment['text'], target_tigers=request.tiger_ids)
        analyzed_comments.append({
            **comment,
            'tiger_mentions': result['mentions']  # 空でもOK
        })

    # 統計集計
    aggregator = StatsAggregator(tigers_file)
    stats = aggregator.calculate_video_stats(
        analyzed_comments=analyzed_comments,
        appearing_tigers=request.tiger_ids
    )

    # 動画情報を取得してtitleを追加
    videos_file = os.path.join(os.path.dirname(__file__), "../../../data/videos.json")
    video_title = "Unknown"
    if os.path.exists(videos_file):
        with open(videos_file, 'r', encoding='utf-8') as f:
            videos = json.load(f)
            video = next((v for v in videos if v['video_id'] == request.video_id), None)
            if video:
                video_title = video.get('title', 'Unknown')

    # 統計データを保存（フロントエンド用に変換）
    save_stats = {
        'video_id': request.video_id,
        'title': video_title,
        'total_comments': stats['N_total'],
        'tiger_mention_comments': stats['N_entity'],
        'tiger_stats': [
            {
                'tiger_id': stat['tiger_id'],
                'display_name': stat['display_name'],
                'mention_count': stat['N_tiger'],
                'rate_total': stat['Rate_total'] / 100,  # パーセントを小数に
                'rate_entity': stat['Rate_entity'] / 100,
                'rank': stat['rank']
            }
            for stat in stats['tiger_stats'].values()
        ]
    }

    stats_file = os.path.join(
        os.path.dirname(__file__),
        f"../../../data/video_stats_{request.video_id}.json"
    )
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(save_stats, f, ensure_ascii=False, indent=2)

    # 分析済みコメントも保存（コメント一覧表示用）
    analyzed_comments_file = os.path.join(
        os.path.dirname(__file__),
        f"../../../data/analyzed_comments_{request.video_id}.json"
    )
    with open(analyzed_comments_file, 'w', encoding='utf-8') as f:
        json.dump(analyzed_comments, f, ensure_ascii=False, indent=2)

    processing_time = time.time() - start_time

    # 言及数を集計
    tiger_mentions = {}
    for t in tigers:
        count = sum(
            1 for c in analyzed_comments
            if any(m['tiger_id'] == t['tiger_id'] for m in c['tiger_mentions'])
        )
        tiger_mentions[t['tiger_id']] = count

    return AnalysisResult(
        video_id=request.video_id,
        total_comments=len(comments),
        analyzed_comments=len([c for c in analyzed_comments if c['tiger_mentions']]),
        tiger_mentions=tiger_mentions,
        processing_time=processing_time
    )


@router.get("/comments/{video_id}")
async def get_analyzed_comments(video_id: str, tiger_id: str = None):
    """
    分析済みコメントを取得（オプションで社長IDでフィルタ）
    """
    analyzed_comments_file = os.path.join(
        os.path.dirname(__file__),
        f"../../../data/analyzed_comments_{video_id}.json"
    )

    if not os.path.exists(analyzed_comments_file):
        raise HTTPException(
            status_code=404,
            detail=f"Analyzed comments for video {video_id} not found. Please analyze first."
        )

    with open(analyzed_comments_file, 'r', encoding='utf-8') as f:
        analyzed_comments = json.load(f)

    # 社長IDでフィルタ
    if tiger_id:
        filtered_comments = [
            c for c in analyzed_comments
            if any(m['tiger_id'] == tiger_id for m in c.get('tiger_mentions', []))
        ]
        return filtered_comments

    # 言及があるコメントのみ返す
    return [c for c in analyzed_comments if c.get('tiger_mentions')]
