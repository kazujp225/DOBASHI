"""
データエクスポート機能
CSV、Excel形式でのエクスポートをサポート
"""
import csv
import io
from typing import List, Dict, Any
from datetime import datetime
import pandas as pd
from fastapi.responses import StreamingResponse


def export_to_csv(
    data: List[Dict[str, Any]],
    filename: str = None
) -> StreamingResponse:
    """
    データをCSV形式でエクスポート

    Args:
        data: エクスポートするデータ（辞書のリスト）
        filename: ファイル名（省略時は自動生成）

    Returns:
        CSV形式のストリーミングレスポンス
    """
    if not data:
        return StreamingResponse(
            io.StringIO("No data available"),
            media_type="text/plain"
        )

    # ファイル名の生成
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"export_{timestamp}.csv"

    # CSV生成
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)

    # ストリーミングレスポンスの作成
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),  # BOM付きUTF-8
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )


def export_video_stats_to_csv(
    video_stats: Dict[str, Any]
) -> StreamingResponse:
    """
    動画統計をCSV形式でエクスポート

    Args:
        video_stats: 動画統計データ

    Returns:
        CSV形式のストリーミングレスポンス
    """
    # データを整形
    data = []
    video_info = {
        "動画ID": video_stats.get("video_id"),
        "タイトル": video_stats.get("title"),
        "総コメント数": video_stats.get("total_comments"),
        "社長言及コメント数": video_stats.get("tiger_mention_comments")
    }

    # 社長別統計
    for tiger_stat in video_stats.get("tiger_stats", []):
        row = video_info.copy()
        row.update({
            "社長ID": tiger_stat.get("tiger_id"),
            "社長名": tiger_stat.get("display_name"),
            "言及数": tiger_stat.get("mention_count"),
            "Rate_total (%)": round(tiger_stat.get("rate_total", 0) * 100, 2),
            "Rate_entity (%)": round(tiger_stat.get("rate_entity", 0) * 100, 2),
            "順位": tiger_stat.get("rank")
        })
        data.append(row)

    # ファイル名生成
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    video_id = video_stats.get("video_id", "unknown")
    filename = f"video_stats_{video_id}_{timestamp}.csv"

    return export_to_csv(data, filename)


def export_ranking_to_csv(
    ranking_data: Dict[str, Any]
) -> StreamingResponse:
    """
    ランキングデータをCSV形式でエクスポート

    Args:
        ranking_data: ランキングデータ

    Returns:
        CSV形式のストリーミングレスポンス
    """
    # データを整形
    data = []
    period = ranking_data.get("period", "unknown")
    total_videos = ranking_data.get("total_videos", 0)

    for rank, tiger in enumerate(ranking_data.get("tiger_rankings", []), 1):
        data.append({
            "順位": rank,
            "社長ID": tiger.get("tiger_id"),
            "社長名": tiger.get("display_name"),
            "総言及数": tiger.get("total_mentions"),
            "出演動画数": tiger.get("video_count"),
            "平均言及数": round(tiger.get("avg_mentions", 0), 2),
            "平均Rate_total (%)": round(tiger.get("avg_rate_total", 0) * 100, 2),
            "平均Rate_entity (%)": round(tiger.get("avg_rate_entity", 0) * 100, 2),
            "期間": period,
            "総動画数": total_videos
        })

    # ファイル名生成
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"ranking_{period}_{timestamp}.csv"

    return export_to_csv(data, filename)


def export_comments_to_csv(
    comments: List[Dict[str, Any]],
    video_id: str = None
) -> StreamingResponse:
    """
    コメントデータをCSV形式でエクスポート

    Args:
        comments: コメントデータのリスト
        video_id: 動画ID

    Returns:
        CSV形式のストリーミングレスポンス
    """
    # データを整形
    data = []
    for comment in comments:
        data.append({
            "コメントID": comment.get("comment_id"),
            "動画ID": comment.get("video_id"),
            "投稿者": comment.get("author_name"),
            "コメント": comment.get("text"),
            "正規化済みテキスト": comment.get("normalized_text"),
            "いいね数": comment.get("like_count"),
            "投稿日時": comment.get("published_at"),
            "言及社長": ", ".join(comment.get("mentioned_tigers", []))
        })

    # ファイル名生成
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if video_id:
        filename = f"comments_{video_id}_{timestamp}.csv"
    else:
        filename = f"comments_{timestamp}.csv"

    return export_to_csv(data, filename)


def export_to_excel(
    data_dict: Dict[str, List[Dict[str, Any]]],
    filename: str = None
) -> StreamingResponse:
    """
    複数のデータセットをExcel形式でエクスポート

    Args:
        data_dict: シート名をキー、データをバリューとする辞書
        filename: ファイル名（省略時は自動生成）

    Returns:
        Excel形式のストリーミングレスポンス
    """
    # ファイル名の生成
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"export_{timestamp}.xlsx"

    # Excel生成
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for sheet_name, data in data_dict.items():
            if data:
                df = pd.DataFrame(data)
                df.to_excel(writer, sheet_name=sheet_name[:31], index=False)

    # ストリーミングレスポンスの作成
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
    )