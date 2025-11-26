"""
データベース初期化スクリプト
既存のJSONデータをデータベースに移行
"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import json
from datetime import datetime
from models import init_db, get_db, Tiger, TigerAlias, Video, User


def load_json_data(filepath: Path):
    """JSONファイルを読み込み"""
    if filepath.exists():
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def migrate_tigers_data():
    """社長データの移行"""
    data_dir = Path(__file__).parent.parent / "data"
    tigers_file = data_dir / "tigers.json"
    aliases_file = data_dir / "aliases.json"

    db = next(get_db())

    # tigersデータの移行
    tigers_data = load_json_data(tigers_file)
    if tigers_data:
        for tiger_dict in tigers_data:
            # 既存チェック
            existing = db.query(Tiger).filter(
                Tiger.tiger_id == tiger_dict["tiger_id"]
            ).first()

            if not existing:
                tiger = Tiger(
                    tiger_id=tiger_dict["tiger_id"],
                    display_name=tiger_dict["display_name"],
                    full_name=tiger_dict.get("full_name", ""),
                    description=tiger_dict.get("description", ""),
                    image_url=tiger_dict.get("image_url", "")
                )
                db.add(tiger)
                print(f"✅ 社長を追加: {tiger.display_name}")

    # aliasesデータの移行
    aliases_data = load_json_data(aliases_file)
    if aliases_data:
        for tiger_id, aliases in aliases_data.items():
            for alias_dict in aliases:
                # 既存チェック
                existing = db.query(TigerAlias).filter(
                    TigerAlias.tiger_id == tiger_id,
                    TigerAlias.alias_text == alias_dict["alias"]
                ).first()

                if not existing:
                    alias = TigerAlias(
                        tiger_id=tiger_id,
                        alias_text=alias_dict["alias"],
                        alias_type=alias_dict.get("type", "formal"),
                        priority=alias_dict.get("priority", 100)
                    )
                    db.add(alias)

    db.commit()
    print("✅ 社長データの移行が完了しました")


def migrate_videos_data():
    """動画データの移行"""
    data_dir = Path(__file__).parent.parent / "data"
    videos_file = data_dir / "videos.json"

    videos_data = load_json_data(videos_file)
    if not videos_data:
        return

    db = next(get_db())

    for video_dict in videos_data:
        # 既存チェック
        existing = db.query(Video).filter(
            Video.video_id == video_dict["video_id"]
        ).first()

        if not existing:
            # 日付文字列をdatetimeに変換
            published_at = None
            if "published_at" in video_dict:
                try:
                    published_at = datetime.fromisoformat(
                        video_dict["published_at"].replace("Z", "+00:00")
                    )
                except:
                    pass

            video = Video(
                video_id=video_dict["video_id"],
                title=video_dict.get("title", ""),
                description=video_dict.get("description", ""),
                channel_id=video_dict.get("channel_id", ""),
                channel_title=video_dict.get("channel_title", ""),
                published_at=published_at,
                view_count=video_dict.get("view_count", 0),
                like_count=video_dict.get("like_count", 0),
                comment_count=video_dict.get("comment_count", 0),
                thumbnail_url=video_dict.get("thumbnail_url", "")
            )
            db.add(video)
            print(f"✅ 動画を追加: {video.title[:50]}...")

    db.commit()
    print("✅ 動画データの移行が完了しました")


def create_default_user():
    """デフォルトユーザーの作成"""
    from core.security import get_password_hash

    db = next(get_db())

    # adminユーザーの作成
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            email="admin@example.com",
            full_name="Administrator",
            hashed_password=get_password_hash("admin123"),
            is_active=True,
            is_superuser=True
        )
        db.add(admin)
        db.commit()
        print("✅ 管理者ユーザーを作成しました")
        print("  ユーザー名: admin")
        print("  パスワード: admin123")
        print("  ⚠️ セキュリティのため、本番環境ではパスワードを変更してください")


def main():
    """メイン処理"""
    print("🔧 データベースを初期化します...")

    # テーブル作成
    init_db()

    # データ移行
    print("\n📦 既存データを移行します...")
    migrate_tigers_data()
    migrate_videos_data()

    # デフォルトユーザー作成
    print("\n👤 デフォルトユーザーを作成します...")
    try:
        create_default_user()
    except Exception as e:
        print(f"⚠️ ユーザー作成中にエラーが発生しましたが、他の処理は正常に完了しました: {e}")
        print("  手動でユーザーを作成するか、bcryptの問題を修正後に再実行してください")

    print("\n✅ データベースの初期化が完了しました！")


if __name__ == "__main__":
    main()