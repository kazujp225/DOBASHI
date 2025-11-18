"""
WebSocketハンドラー
リアルタイムダッシュボード用
"""
from fastapi import WebSocket, WebSocketDisconnect, Depends
from typing import List, Dict, Any
import asyncio
import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import get_db, Video, Comment, VideoTigerStats, Tiger
from analyzers.sentiment_analyzer import SentimentAnalyzer
from core.cache import cache_manager


class ConnectionManager:
    """WebSocket接続管理クラス"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.sentiment_analyzer = SentimentAnalyzer()

    async def connect(self, websocket: WebSocket):
        """新しいWebSocket接続を受け入れる"""
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"新しい接続: 現在の接続数 = {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """WebSocket接続を切断"""
        self.active_connections.remove(websocket)
        print(f"接続切断: 現在の接続数 = {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """特定の接続にメッセージを送信"""
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        """全ての接続にメッセージをブロードキャスト"""
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # 切断された接続を削除
                self.disconnect(connection)

    async def send_json(self, data: Dict[str, Any], websocket: WebSocket):
        """JSON形式でデータを送信"""
        await websocket.send_json(data)

    async def broadcast_json(self, data: Dict[str, Any]):
        """全ての接続にJSONデータをブロードキャスト"""
        message = json.dumps(data, ensure_ascii=False, default=str)
        await self.broadcast(message)


# グローバルなConnectionManagerインスタンス
manager = ConnectionManager()


async def get_realtime_stats(db: Session) -> Dict[str, Any]:
    """
    リアルタイム統計を取得
    """
    # 最新の動画を取得
    latest_videos = db.query(Video).order_by(Video.published_at.desc()).limit(5).all()

    # 総コメント数
    total_comments = db.query(Comment).count()

    # 社長別の言及数（上位5名）
    tiger_stats = db.query(
        VideoTigerStats.tiger_id,
        Tiger.display_name,
        func.sum(VideoTigerStats.n_tiger).label("total_mentions")
    ).join(
        Tiger, VideoTigerStats.tiger_id == Tiger.tiger_id
    ).group_by(
        VideoTigerStats.tiger_id, Tiger.display_name
    ).order_by(
        func.sum(VideoTigerStats.n_tiger).desc()
    ).limit(5).all()

    # 最新コメントのサンプル取得と感情分析
    latest_comments = db.query(Comment).order_by(
        Comment.published_at.desc()
    ).limit(10).all()

    sentiment_summary = {"positive": 0, "negative": 0, "neutral": 0}
    if latest_comments:
        for comment in latest_comments:
            result = manager.sentiment_analyzer.analyze(comment.text_original)
            sentiment_summary[result.sentiment] += 1

    return {
        "timestamp": datetime.now().isoformat(),
        "total_videos": len(latest_videos),
        "total_comments": total_comments,
        "top_tigers": [
            {
                "tiger_id": stat[0],
                "display_name": stat[1],
                "mentions": stat[2] or 0
            }
            for stat in tiger_stats
        ],
        "recent_sentiment": sentiment_summary,
        "latest_videos": [
            {
                "video_id": v.video_id,
                "title": v.title[:50] + "..." if len(v.title) > 50 else v.title,
                "comment_count": v.comment_count
            }
            for v in latest_videos
        ]
    }


async def periodic_update(websocket: WebSocket, db: Session):
    """
    定期的に統計情報を更新して送信
    """
    while True:
        try:
            # 統計情報を取得
            stats = await get_realtime_stats(db)

            # WebSocketで送信
            await manager.send_json({
                "type": "stats_update",
                "data": stats
            }, websocket)

            # 10秒待機
            await asyncio.sleep(10)

        except WebSocketDisconnect:
            break
        except Exception as e:
            print(f"定期更新エラー: {e}")
            await asyncio.sleep(10)


async def handle_command(websocket: WebSocket, command: Dict[str, Any], db: Session):
    """
    クライアントからのコマンドを処理
    """
    cmd_type = command.get("type")

    if cmd_type == "get_video_stats":
        video_id = command.get("video_id")
        if video_id:
            # 動画の統計を取得
            stats = db.query(VideoTigerStats).filter(
                VideoTigerStats.video_id == video_id
            ).all()

            response_data = {
                "type": "video_stats_response",
                "video_id": video_id,
                "stats": [
                    {
                        "tiger_id": s.tiger_id,
                        "n_tiger": s.n_tiger,
                        "rate_total": s.rate_total,
                        "rate_entity": s.rate_entity,
                        "rank": s.rank
                    }
                    for s in stats
                ]
            }
            await manager.send_json(response_data, websocket)

    elif cmd_type == "analyze_sentiment":
        text = command.get("text")
        if text:
            # 感情分析を実行
            result = manager.sentiment_analyzer.analyze(text)
            response_data = {
                "type": "sentiment_response",
                "sentiment": result.sentiment,
                "score": result.score,
                "positive": result.positive_score,
                "negative": result.negative_score,
                "neutral": result.neutral_score
            }
            await manager.send_json(response_data, websocket)

    elif cmd_type == "subscribe_updates":
        # リアルタイム更新の購読開始
        await manager.send_json({
            "type": "subscription_confirmed",
            "message": "リアルタイム更新を開始します"
        }, websocket)
        # 定期更新タスクを開始
        asyncio.create_task(periodic_update(websocket, db))

    else:
        await manager.send_json({
            "type": "error",
            "message": f"不明なコマンド: {cmd_type}"
        }, websocket)


# WebSocketエンドポイントハンドラー（main.pyで使用）
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocketエンドポイント
    """
    db = next(get_db())

    await manager.connect(websocket)

    # 接続時に初期データを送信
    try:
        initial_stats = await get_realtime_stats(db)
        await manager.send_json({
            "type": "connection_established",
            "data": initial_stats
        }, websocket)

        # メッセージ受信ループ
        while True:
            # クライアントからのメッセージを待機
            data = await websocket.receive_text()
            try:
                command = json.loads(data)
                await handle_command(websocket, command, db)
            except json.JSONDecodeError:
                await manager.send_json({
                    "type": "error",
                    "message": "無効なJSONフォーマット"
                }, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        db.close()
        print("WebSocket接続が切断されました")
    except Exception as e:
        print(f"WebSocketエラー: {e}")
        manager.disconnect(websocket)
        db.close()