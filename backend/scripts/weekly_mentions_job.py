"""
週次自動更新用スクリプト（cronなどから実行）

機能:
- 環境変数 YOUTUBE_CHANNEL_IDS (カンマ区切り) を読み込み、前回実行以降の新規動画を取得
- 各動画のコメントを収集し JSON 保存
- 対象社長 (TRACKED_TIGER_IDS 環境変数、未指定時は全社長) の言及を解析
- 指定年(デフォルト:今年)についてExcelを再生成 (data/reports/mentions_YYYY.xlsx)

前回実行時刻: data/cache/last_mentions_run.json
"""
from __future__ import annotations

import os
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List
import sys
sys.path.append(str(Path(__file__).parent.parent))  # backend配下をimport可能に

from collectors.youtube_collector import YouTubeCollector
from analyzers.comment_analyzer import CommentAnalyzer
from utils.mention_aggregator import aggregate_mentions
from analyzers.tiger_extractor import TigerExtractor
from models import init_db, get_db
from utils.export import export_to_excel


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
REPORTS_DIR = DATA_DIR / "reports"
STATE_FILE = CACHE_DIR / "last_mentions_run.json"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _load_state() -> datetime | None:
    if not STATE_FILE.exists():
        return None
    try:
        d = json.loads(STATE_FILE.read_text("utf-8"))
        return datetime.fromisoformat(d.get("last_run"))
    except Exception:
        return None


def _save_state(dt: datetime) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({"last_run": dt.isoformat()}), encoding="utf-8")


def _merge_videos(videos: List[dict]):
    """data/videos.json にマージ保存"""
    videos_file = DATA_DIR / "videos.json"
    existing = []
    if videos_file.exists():
        existing = json.loads(videos_file.read_text("utf-8"))
    by_id = {v["video_id"]: v for v in existing}
    for v in videos:
        by_id[v["video_id"]] = v
    videos_file.write_text(json.dumps(list(by_id.values()), ensure_ascii=False, indent=2), encoding="utf-8")


def collect_new_videos_and_comments(start_dt: datetime, api_key: str, channel_ids: List[str]):
    yt = YouTubeCollector(api_key)
    published_after = start_dt.isoformat()
    for ch in channel_ids:
        ch = ch.strip()
        if not ch:
            continue
        videos = yt.get_channel_videos(channel_id=ch, max_results=200, published_after=published_after)
        if not videos:
            continue
        _merge_videos(videos)

        # 各動画のコメントを取得（全件）
        for v in videos:
            vid = v["video_id"]
            comments = yt.get_video_comments(vid, max_results=None)
            (DATA_DIR / f"comments_{vid}.json").write_text(
                json.dumps(comments, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        # 出演者自動抽出（DB）
        try:
            init_db()
            db = next(get_db())
            extractor = TigerExtractor(db)
            for v in videos:
                extractor.extract_tigers(v["video_id"])
            db.close()
        except Exception as e:
            print(f"出演者抽出スキップ: {e}")


def analyze_mentions_for_targets(tiger_ids: List[str]):
    tigers_file = DATA_DIR / "tigers.json"
    aliases_file = DATA_DIR / "aliases.json"
    analyzer = CommentAnalyzer(str(tigers_file), str(aliases_file))

    # videos.json の全動画に対して、analyzed_comments が無ければ作成
    videos = []
    if (DATA_DIR / "videos.json").exists():
        videos = json.loads((DATA_DIR / "videos.json").read_text("utf-8"))

    for v in videos:
        vid = v["video_id"]
        analyzed_path = DATA_DIR / f"analyzed_comments_{vid}.json"
        if analyzed_path.exists():
            continue
        comments_path = DATA_DIR / f"comments_{vid}.json"
        if not comments_path.exists():
            continue
        comments = json.loads(comments_path.read_text("utf-8"))
        analyzed = []
        for c in comments:
            r = analyzer.find_tiger_mentions(c.get("text", ""), target_tigers=tiger_ids)
            analyzed.append({**c, "normalized_text": r.get("normalized_text"), "tiger_mentions": r.get("mentions", [])})
        analyzed_path.write_text(json.dumps(analyzed, ensure_ascii=False, indent=2), encoding="utf-8")


def export_year_excel(year: int, tiger_ids: List[str]):
    start_dt = datetime(year, 1, 1)
    end_dt = datetime(year, 12, 31, 23, 59, 59)
    videos_sheet, people_sheet, summary_sheet = aggregate_mentions(
        base_dir=BASE_DIR, start_date=start_dt, end_date=end_dt, tiger_ids=tiger_ids
    )
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    filename = REPORTS_DIR / f"mentions_{year}.xlsx"
    # utils.export.export_to_excel はStreamingResponseを返すため、ここは簡易保存
    # 直接pandasで作るのを避け、既存関数を再利用したい場合はAPI経由にするが、
    # ここでは簡易にxlsxwriterを使うのはポリシー外のため簡易実装: CSV的代替不可。
    # よって簡易的に同等ロジックをここで組み立て直すのは避け、utils.export を拡張しない範囲で
    # 最小差分として手動でxlsxを生成するのは本タスクの範囲外。
    # 代替: export_to_excelの内部を模倣して保存
    import io
    import pandas as pd
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if videos_sheet:
            pd.DataFrame(videos_sheet).to_excel(writer, sheet_name='動画一覧', index=False)
        if people_sheet:
            pd.DataFrame(people_sheet).to_excel(writer, sheet_name='人別集計', index=False)
        if summary_sheet:
            pd.DataFrame(summary_sheet).to_excel(writer, sheet_name='年間サマリー', index=False)
    filename.write_bytes(output.getvalue())


def main():
    # 設定
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    if not api_key:
        print("YOUTUBE_API_KEY が未設定のため、収集はスキップします")

    channel_ids = [x.strip() for x in os.getenv("YOUTUBE_CHANNEL_IDS", "").split(",") if x.strip()]
    tracked_ids = [x.strip() for x in os.getenv("TRACKED_TIGER_IDS", "").split(",") if x.strip()]
    if not tracked_ids:
        # 未指定時は全社長
        tigers = json.loads((DATA_DIR / "tigers.json").read_text("utf-8")) if (DATA_DIR / "tigers.json").exists() else []
        tracked_ids = [t["tiger_id"] for t in tigers]

    # 前回実行時刻、なければ 2025-01-01
    last_run = _load_state() or datetime(2025, 1, 1, tzinfo=timezone.utc)
    now = _now()

    # 新規動画とコメント収集
    if api_key and channel_ids:
        collect_new_videos_and_comments(last_run, api_key, channel_ids)
    else:
        print("チャンネルID未設定のため、新規収集はスキップします")

    # 言及解析(未解析分)
    analyze_mentions_for_targets(tracked_ids)

    # 今年のExcelを再生成（出演者=DB、ランキングはコメント出現数ベース）
    start_dt = datetime(now.year, 1, 1)
    end_dt = datetime(now.year, 12, 31, 23, 59, 59)
    videos_sheet, people_sheet, summary_sheet = aggregate_mentions(
        base_dir=BASE_DIR,
        start_date=start_dt,
        end_date=end_dt,
        tiger_ids=tracked_ids,
        count_mode="comment",
        performers_source="db",
    )
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    import io
    import pandas as pd
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if videos_sheet:
            pd.DataFrame(videos_sheet).to_excel(writer, sheet_name='動画一覧', index=False)
        if people_sheet:
            pd.DataFrame(people_sheet).to_excel(writer, sheet_name='人別集計', index=False)
        if summary_sheet:
            pd.DataFrame(summary_sheet).to_excel(writer, sheet_name='年間サマリー', index=False)
    (REPORTS_DIR / f"mentions_{now.year}.xlsx").write_bytes(output.getvalue())

    # 状態保存
    _save_state(now)
    print("週次更新完了")


if __name__ == "__main__":
    main()
