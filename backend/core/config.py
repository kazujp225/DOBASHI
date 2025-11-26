"""
アプリケーション設定
"""
from pydantic_settings import BaseSettings
from typing import Optional
import secrets
from pathlib import Path

class Settings(BaseSettings):
    """
    アプリケーション設定クラス
    環境変数から設定を読み込み
    """
    # 基本設定
    app_name: str = "令和の虎 コメント分析システム"
    app_version: str = "2.1.0"
    debug: bool = False

    # API設定
    api_v1_str: str = "/api/v1"

    # YouTube API
    youtube_api_key: Optional[str] = None
    youtube_api_quota_limit: int = 10000  # 1日のクォータ制限

    # データベース設定
    database_type: str = "sqlite"  # sqlite or postgresql
    database_url: Optional[str] = None

    # PostgreSQL設定
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "tora_analysis"
    postgres_user: str = "postgres"
    postgres_password: str = ""

    @property
    def get_database_url(self) -> str:
        """データベースURLを取得"""
        if self.database_url:
            return self.database_url

        if self.database_type == "postgresql":
            return f"postgresql://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        else:
            return f"sqlite:///{self.data_dir}/tora_analysis.db"

    # セキュリティ設定
    secret_key: str = secrets.token_urlsafe(32)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 1週間

    # Redis設定（キャッシュ用）
    redis_url: Optional[str] = None
    cache_expire_seconds: int = 3600  # 1時間

    # CORS設定（環境変数CORS_ORIGINSでカンマ区切りで追加可能）
    cors_origins: Optional[str] = None

    @property
    def backend_cors_origins(self) -> list:
        """CORSオリジンリストを取得"""
        origins = [
            "http://localhost",
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:8501"
        ]
        # 環境変数からの追加
        if self.cors_origins:
            for origin in self.cors_origins.split(","):
                origin = origin.strip()
                if origin and origin not in origins:
                    origins.append(origin)
        return origins

    # LLM設定（オプション）
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    llm_max_tokens_per_month: int = 100000

    # バッチ処理設定
    batch_size: int = 100
    max_concurrent_requests: int = 5
    request_delay_seconds: float = 0.5  # APIレート制限対策

    # ファイルパス設定（バックエンドディレクトリを基準）
    base_dir: Path = Path(__file__).resolve().parent.parent
    data_dir: Path = base_dir / "data"
    cache_dir: Path = data_dir / "cache"
    logs_dir: Path = base_dir / "logs"

    # ログ設定
    log_level: str = "INFO"
    log_format: str = "json"  # json or plain

    # パフォーマンス設定
    max_comment_fetch: int = 10000  # 1動画あたりの最大コメント取得数
    analysis_timeout_seconds: int = 300  # 分析タイムアウト（5分）

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    def __init__(self, **values):
        super().__init__(**values)
        # ディレクトリの作成
        self.data_dir.mkdir(exist_ok=True)
        self.cache_dir.mkdir(exist_ok=True)
        self.logs_dir.mkdir(exist_ok=True)

# 設定のシングルトンインスタンス
settings = Settings()