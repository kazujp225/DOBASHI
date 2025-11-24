"""
Analysis API Router - コメント収集と分析
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
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
from analyzers.tiger_extractor import TigerExtractor
from aggregators.stats_aggregator import StatsAggregator
from ..schemas import CollectionRequest, CollectionProgress, AnalysisRequest, AnalysisResult, LogEntry
from sqlalchemy.orm import Session
from models import get_db, Video as VideoDB, Comment as CommentDB, CommentTigerRelation, VideoTigerStats, VideoTiger, Tiger as TigerDB
from models.database import SessionLocal
from sqlalchemy import delete
from datetime import datetime
import threading

# YouTube API キーを環境変数から取得（値はログに出さない）
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY', '')
if YOUTUBE_API_KEY:
    print("[analysis.py] ✅ YOUTUBE_API_KEY configured")
else:
    print("[analysis.py] ⚠️ YOUTUBE_API_KEY not found in environment")

router = APIRouter()

# 進捗管理用の簡易ストレージ（スレッドセーフ）
collection_status: Dict[str, CollectionProgress] = {}
collection_locks: Dict[str, threading.Lock] = {}
_status_lock = threading.Lock()  # collection_status/collection_locks へのアクセス用


def get_collection_lock(video_id: str) -> threading.Lock:
    """動画IDごとのロックを取得（なければ作成）"""
    with _status_lock:
        if video_id not in collection_locks:
            collection_locks[video_id] = threading.Lock()
        return collection_locks[video_id]


def add_log(video_id: str, level: str, message: str, emoji: str = None):
    """ログエントリを追加（スレッドセーフ）"""
    from datetime import datetime
    with _status_lock:
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

    # 同じ動画の同時収集をチェック
    with _status_lock:
        if video_id in collection_status and collection_status[video_id].status == "collecting":
            return collection_status[video_id]  # 既に収集中

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
        estimated_count = video_info.get('comment_count', 0)
        add_log(video_id, "info", f"📊 コメント数（推定）: 約{estimated_count:,}件", "📊")

        # コメントを収集（全件取得）
        add_log(video_id, "info", "💬 コメントを収集中...", "💬")
        comments = collector.get_video_comments(video_id, max_results=None)
        add_log(video_id, "success", f"✨ {len(comments):,}件のコメントを収集完了", "✨")

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

        # データベースに動画情報を保存
        add_log(video_id, "info", "🗄️ データベースに保存中...", "🗄️")
        db = SessionLocal()
        try:
            # 既存の動画を確認
            existing_video = db.query(VideoDB).filter(VideoDB.video_id == video_id).first()
            if existing_video:
                # 更新
                existing_video.title = video_info.get('title', '')
                existing_video.description = video_info.get('description', '')
                existing_video.thumbnail_url = video_info.get('thumbnail_url', '')
                existing_video.view_count = video_info.get('view_count', 0)
                existing_video.like_count = video_info.get('like_count', 0)
                existing_video.comment_count = video_info.get('comment_count', 0)
            else:
                # 新規作成 - published_at を datetime に変換
                published_at_str = video_info.get('published_at')
                published_at_dt = None
                if published_at_str:
                    try:
                        # ISO 8601 形式をパース
                        published_at_dt = datetime.fromisoformat(published_at_str.replace('Z', '+00:00'))
                    except (ValueError, AttributeError):
                        pass

                new_video = VideoDB(
                    video_id=video_id,
                    title=video_info.get('title', ''),
                    description=video_info.get('description', ''),
                    thumbnail_url=video_info.get('thumbnail_url', ''),
                    published_at=published_at_dt,
                    view_count=video_info.get('view_count', 0),
                    like_count=video_info.get('like_count', 0),
                    comment_count=video_info.get('comment_count', 0)
                )
                db.add(new_video)
            db.commit()
            add_log(video_id, "success", "✅ データベースに保存しました", "✅")

            # 社長を自動抽出・保存
            add_log(video_id, "info", "🔍 概要欄から社長を自動検出中...", "🔍")
            extractor = TigerExtractor(db)
            result = extractor.extract_tigers(video_id)

            if result.get('success') and result.get('total_tigers_found', 0) > 0:
                tiger_names = [t['display_name'] for t in result.get('tigers', [])]
                add_log(video_id, "success", f"✅ {len(tiger_names)}名の社長を検出・登録: {', '.join(tiger_names)}", "✅")
            else:
                add_log(video_id, "info", "ℹ️ 概要欄から社長を検出できませんでした（分析時に手動選択可能）", "ℹ️")

            # 未登録の名前があれば警告
            unmatched = result.get('unmatched_names', [])
            if unmatched:
                add_log(video_id, "warning", f"⚠️ 未登録の社長名を検出: {', '.join(unmatched)}（社長管理から登録してください）", "⚠️")
        except Exception as e:
            add_log(video_id, "warning", f"⚠️ 社長自動検出でエラー: {str(e)}", "⚠️")
        finally:
            db.close()

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
async def analyze_comments(request: AnalysisRequest, db: Session = Depends(get_db)):
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

    # JSONパース失敗のエラーハンドリング
    try:
        with open(comments_file, 'r', encoding='utf-8') as f:
            comments = json.load(f)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse comments file: {str(e)}"
        )

    # 社長マスタのパス
    tigers_file = os.path.join(os.path.dirname(__file__), "../../../data/tigers.json")
    aliases_file = os.path.join(os.path.dirname(__file__), "../../../data/aliases.json")

    # 社長データ・エイリアス読み込み（統計・表示名付与・ID解決用）
    with open(tigers_file, 'r', encoding='utf-8') as f:
        all_tigers = json.load(f)
    with open(aliases_file, 'r', encoding='utf-8') as f:
        aliases_dict = json.load(f)
    tiger_name_map = {t['tiger_id']: t.get('display_name', t['tiger_id']) for t in all_tigers}

    # 入力ID（tigers.jsonのIDかもしれない）→ エイリアス側ID（aliases.jsonのキー）に解決
    def resolve_target_ids(input_ids: list[str]) -> tuple[list[str], dict[str, str]]:
        # エイリアスに存在するものはそのまま、存在しない場合はdisplay_name/full_name一致で探索
        alias_ids: list[str] = []
        alias_to_requested: dict[str, str] = {}
        # 検索用: display_name/full_name セット
        display_map = {t['tiger_id']: (t.get('display_name',''), t.get('full_name','')) for t in all_tigers}
        for req_id in input_ids:
            if req_id in aliases_dict:
                alias_ids.append(req_id)
                alias_to_requested[req_id] = req_id
                continue
            dname, fname = display_map.get(req_id, ('',''))
            matched_key = None
            if dname:
                for k, alias_list in aliases_dict.items():
                    if any(a.get('alias') == dname for a in alias_list):
                        matched_key = k
                        break
            if not matched_key and fname:
                for k, alias_list in aliases_dict.items():
                    if any(a.get('alias') == fname for a in alias_list):
                        matched_key = k
                        break
            # 見つかった場合はaliasキーを用いる、なければ元IDを使用（検出は期待薄）
            alias_key = matched_key or req_id
            alias_ids.append(alias_key)
            alias_to_requested[alias_key] = req_id
        # 重複除去を保ちつつ順序維持
        seen = set()
        alias_ids_unique = []
        for a in alias_ids:
            if a not in seen:
                seen.add(a)
                alias_ids_unique.append(a)
        return alias_ids_unique, alias_to_requested

    # 指定された社長のみフィルタ
    tigers = [t for t in all_tigers if t['tiger_id'] in request.tiger_ids]

    # 分析実行
    analyzer = CommentAnalyzer(tigers_file, aliases_file)
    # ID解決
    resolved_ids, alias_to_requested = resolve_target_ids(request.tiger_ids)
    analyzed_comments = []

    for comment in comments:
        result = analyzer.find_tiger_mentions(comment.get('text', ''), target_tigers=resolved_ids)

        # フロントエンド期待形式に整形
        mentions_for_ui = [
            {
                # analyzerのID（エイリアス側）→ リクエストID（tigers.json側）に戻す
                'tiger_id': alias_to_requested.get(m['tiger_id'], m['tiger_id']),
                'display_name': tiger_name_map.get(alias_to_requested.get(m['tiger_id'], ''), m['tiger_id']),
                'matched_text': m.get('matched_alias')
            }
            for m in result.get('mentions', [])
        ]

        analyzed_comments.append({
            **comment,
            # author_name がないフォーマットに対応
            'author_name': comment.get('author_name') or comment.get('author') or '',
            'normalized_text': result.get('normalized_text'),
            'tiger_mentions': mentions_for_ui  # 空でもOK
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

    # ========== DB永続化 ==========
    db_warning = None  # DB永続化の警告メッセージ
    try:
        # Video レコードの存在確認/作成
        video_in_db = db.query(VideoDB).filter(VideoDB.video_id == request.video_id).first()
        if not video_in_db:
            # videos.json から補完
            videos_file = os.path.join(os.path.dirname(__file__), "../../../data/videos.json")
            video_meta = None
            if os.path.exists(videos_file):
                with open(videos_file, 'r', encoding='utf-8') as f:
                    vids = json.load(f)
                    video_meta = next((v for v in vids if v['video_id'] == request.video_id), None)
            video_in_db = VideoDB(
                video_id=request.video_id,
                title=(video_meta or {}).get('title', video_title),
                description=(video_meta or {}).get('description', ''),
                channel_id=(video_meta or {}).get('channel_id', ''),
                channel_title=(video_meta or {}).get('channel_title', ''),
                published_at=datetime.fromisoformat((video_meta or {}).get('published_at', '1970-01-01T00:00:00+00:00').replace('Z', '+00:00')) if (video_meta and video_meta.get('published_at')) else None,
                view_count=(video_meta or {}).get('view_count', 0),
                like_count=(video_meta or {}).get('like_count', 0),
                comment_count=len(comments),  # 実際に取得したコメント数を使用
                thumbnail_url=(video_meta or {}).get('thumbnail_url', '')
            )
            db.add(video_in_db)
            db.flush()
        else:
            # 既存のVideoがある場合、コメント数を実際の数で更新
            video_in_db.comment_count = len(comments)

        # ========== VideoTiger 登録 ==========
        # 既存のVideoTiger関係を削除
        db.query(VideoTiger).filter(VideoTiger.video_id == request.video_id).delete()

        # 出演社長を登録（DBに存在する社長のみ）
        for order, tiger_id in enumerate(request.tiger_ids, start=1):
            # 社長がDBに存在するか確認
            tiger_exists = db.query(TigerDB).filter(TigerDB.tiger_id == tiger_id).first()
            if tiger_exists:
                video_tiger = VideoTiger(
                    video_id=request.video_id,
                    tiger_id=tiger_id,
                    appearance_order=order
                )
                db.add(video_tiger)
            else:
                print(f"[analyze] Warning: Tiger {tiger_id} not found in DB, skipping VideoTiger registration")

        # コメントのアップサートと言及関係の更新
        for c in analyzed_comments:
            # コメント本体
            model = db.query(CommentDB).filter(CommentDB.comment_id == c['comment_id']).first()
            published_at = None
            try:
                if c.get('published_at'):
                    published_at = datetime.fromisoformat(c['published_at'].replace('Z', '+00:00'))
            except Exception:
                published_at = None
            if not model:
                model = CommentDB(
                    comment_id=c['comment_id'],
                    video_id=request.video_id,
                    text_original=c.get('text', ''),
                    normalized_text=c.get('normalized_text'),
                    author_name=c.get('author_name') or c.get('author') or '',
                    author_channel_id=c.get('author_channel_id') or '',
                    like_count=c.get('like_count') or 0,
                    published_at=published_at,
                    is_reply=bool(c.get('is_reply')),
                    parent_comment_id=c.get('parent_id')
                )
                db.add(model)
            else:
                model.text_original = c.get('text', '')
                model.normalized_text = c.get('normalized_text')
                model.author_name = c.get('author_name') or c.get('author') or ''
                model.author_channel_id = c.get('author_channel_id') or ''
                model.like_count = c.get('like_count') or 0
                model.published_at = published_at
                model.is_reply = bool(c.get('is_reply'))
                model.parent_comment_id = c.get('parent_id')

            # 既存の関係を削除してから再登録
            db.query(CommentTigerRelation).filter(CommentTigerRelation.comment_id == c['comment_id']).delete()
            for m in c.get('tiger_mentions', []):
                tid = m.get('tiger_id') or m.get('tigerId')
                if not tid:
                    continue
                # 社長がDBに存在するか確認（外部キー制約エラー防止）
                tiger_exists = db.query(TigerDB).filter(TigerDB.tiger_id == tid).first()
                if not tiger_exists:
                    print(f"[analyze] Warning: Tiger {tid} not found in DB, skipping CommentTigerRelation")
                    continue
                rel = CommentTigerRelation(
                    comment_id=c['comment_id'],
                    tiger_id=tid,
                    matched_alias=m.get('matched_alias') or m.get('matched_text'),
                    match_method='rule_based',
                    confidence_score=1.0
                )
                db.add(rel)

        # VideoTigerStats を更新
        N_total = stats['N_total']
        N_entity = stats['N_entity']
        # いったんこの動画の統計を削除してから再作成
        db.query(VideoTigerStats).filter(VideoTigerStats.video_id == request.video_id).delete()
        # 順位付与済みstatsから生成
        ss = list(stats['tiger_stats'].values())
        for s in ss:
            # 社長がDBに存在するか確認
            tiger_exists = db.query(TigerDB).filter(TigerDB.tiger_id == s['tiger_id']).first()
            if not tiger_exists:
                print(f"[analyze] Warning: Tiger {s['tiger_id']} not found in DB, skipping VideoTigerStats")
                continue
            db.add(VideoTigerStats(
                video_id=request.video_id,
                tiger_id=s['tiger_id'],
                n_total=N_total,
                n_entity=N_entity,
                n_tiger=s['N_tiger'],
                rate_total=(s['Rate_total'] / 100.0 if s['Rate_total'] else 0.0),
                rate_entity=(s['Rate_entity'] / 100.0 if s['Rate_entity'] else 0.0),
                rank=s.get('rank')
            ))

        db.commit()
        print(f"[analyze] DB persistence successful for video {request.video_id}")
    except Exception as e:
        # DBへの永続化失敗：ロールバックして警告を記録
        db.rollback()
        import traceback
        error_detail = f"{e}\n{traceback.format_exc()}"
        print(f"[analyze] DB persistence failed: {error_detail}")
        db_warning = f"DB永続化に失敗しました: {str(e)}"

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


@router.get("/video-tigers/{video_id}")
async def get_video_tigers(video_id: str, db: Session = Depends(get_db)):
    """
    動画に登録済みの社長一覧を取得
    """
    video_tigers = db.query(VideoTiger).filter(VideoTiger.video_id == video_id).order_by(VideoTiger.appearance_order).all()

    if not video_tigers:
        return {"video_id": video_id, "tigers": [], "has_registered": False}

    # 社長情報を取得
    tiger_ids = [vt.tiger_id for vt in video_tigers]
    tigers_db = db.query(TigerDB).filter(TigerDB.tiger_id.in_(tiger_ids)).all()
    tiger_map = {t.tiger_id: t for t in tigers_db}

    tigers = []
    for vt in video_tigers:
        tiger = tiger_map.get(vt.tiger_id)
        if tiger:
            tigers.append({
                "tiger_id": tiger.tiger_id,
                "display_name": tiger.display_name,
                "full_name": tiger.full_name,
                "image_url": tiger.image_url,
                "appearance_order": vt.appearance_order
            })

    return {"video_id": video_id, "tigers": tigers, "has_registered": True}
