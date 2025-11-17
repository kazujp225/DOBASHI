"""
Redisキャッシュ管理
"""
import json
import redis
from typing import Optional, Any
from datetime import timedelta
from .config import settings


class CacheManager:
    """
    キャッシュマネージャー
    Redisが利用可能な場合はRedis、そうでない場合はインメモリキャッシュを使用
    """

    def __init__(self):
        self.redis_client = None
        self.memory_cache = {}

        # Redisへの接続試行
        if settings.redis_url:
            try:
                self.redis_client = redis.from_url(
                    settings.redis_url,
                    decode_responses=True
                )
                self.redis_client.ping()
                print("Redisキャッシュを使用します")
            except Exception as e:
                print(f"Redis接続エラー: {e}")
                print("インメモリキャッシュを使用します")
        else:
            print("インメモリキャッシュを使用します")

    def get(self, key: str) -> Optional[Any]:
        """
        キャッシュから値を取得

        Args:
            key: キャッシュキー

        Returns:
            キャッシュされた値、存在しない場合はNone
        """
        try:
            if self.redis_client:
                value = self.redis_client.get(key)
                if value:
                    return json.loads(value)
            else:
                return self.memory_cache.get(key)
        except Exception as e:
            print(f"キャッシュ取得エラー: {e}")
            return None

    def set(
        self,
        key: str,
        value: Any,
        expire_seconds: Optional[int] = None
    ) -> bool:
        """
        キャッシュに値を設定

        Args:
            key: キャッシュキー
            value: 保存する値
            expire_seconds: 有効期限（秒）

        Returns:
            成功した場合はTrue
        """
        try:
            if expire_seconds is None:
                expire_seconds = settings.cache_expire_seconds

            if self.redis_client:
                json_value = json.dumps(value, ensure_ascii=False, default=str)
                return self.redis_client.setex(
                    key,
                    expire_seconds,
                    json_value
                )
            else:
                # インメモリキャッシュ（簡易実装）
                self.memory_cache[key] = value
                # TODO: 有効期限の実装
                return True
        except Exception as e:
            print(f"キャッシュ設定エラー: {e}")
            return False

    def delete(self, key: str) -> bool:
        """
        キャッシュから削除

        Args:
            key: キャッシュキー

        Returns:
            成功した場合はTrue
        """
        try:
            if self.redis_client:
                return bool(self.redis_client.delete(key))
            else:
                if key in self.memory_cache:
                    del self.memory_cache[key]
                    return True
                return False
        except Exception as e:
            print(f"キャッシュ削除エラー: {e}")
            return False

    def exists(self, key: str) -> bool:
        """
        キャッシュの存在確認

        Args:
            key: キャッシュキー

        Returns:
            存在する場合はTrue
        """
        try:
            if self.redis_client:
                return bool(self.redis_client.exists(key))
            else:
                return key in self.memory_cache
        except Exception as e:
            print(f"キャッシュ存在確認エラー: {e}")
            return False

    def clear(self, pattern: str = "*") -> bool:
        """
        キャッシュをクリア

        Args:
            pattern: クリアするキーのパターン

        Returns:
            成功した場合はTrue
        """
        try:
            if self.redis_client:
                keys = self.redis_client.keys(pattern)
                if keys:
                    return bool(self.redis_client.delete(*keys))
                return True
            else:
                if pattern == "*":
                    self.memory_cache.clear()
                else:
                    # パターンマッチング（簡易実装）
                    keys_to_delete = [
                        k for k in self.memory_cache.keys()
                        if pattern == "*" or k.startswith(pattern.replace("*", ""))
                    ]
                    for key in keys_to_delete:
                        del self.memory_cache[key]
                return True
        except Exception as e:
            print(f"キャッシュクリアエラー: {e}")
            return False


# グローバルキャッシュインスタンス
cache_manager = CacheManager()


# ========== キャッシュキー生成関数 ==========

def get_video_stats_cache_key(video_id: str) -> str:
    """動画統計のキャッシュキー"""
    return f"stats:video:{video_id}"


def get_tiger_stats_cache_key(tiger_id: str) -> str:
    """社長統計のキャッシュキー"""
    return f"stats:tiger:{tiger_id}"


def get_comments_cache_key(video_id: str) -> str:
    """コメントのキャッシュキー"""
    return f"comments:{video_id}"


def get_analysis_cache_key(video_id: str, tiger_ids: list) -> str:
    """分析結果のキャッシュキー"""
    tiger_ids_str = ",".join(sorted(tiger_ids))
    return f"analysis:{video_id}:{tiger_ids_str}"


def get_ranking_cache_key(period: str) -> str:
    """ランキングのキャッシュキー"""
    return f"ranking:{period}"