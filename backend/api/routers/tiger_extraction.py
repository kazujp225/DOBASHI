"""
社長自動抽出APIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from models import get_db
from analyzers.tiger_extractor import TigerExtractor

router = APIRouter()


class ExtractRequest(BaseModel):
    """抽出リクエスト"""
    video_ids: List[str]


class ExtractSingleRequest(BaseModel):
    """単一動画抽出リクエスト"""
    video_id: str


@router.post("/extract/video/{video_id}")
async def extract_tigers_from_video(
    video_id: str,
    db: Session = Depends(get_db)
):
    """
    指定した動画から社長を自動抽出

    Args:
        video_id: YouTube動画ID

    Returns:
        抽出結果
    """
    try:
        extractor = TigerExtractor(db)
        result = extractor.extract_tigers(video_id)

        if not result.get("success"):
            raise HTTPException(
                status_code=404,
                detail=result.get("error", "抽出に失敗しました")
            )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"社長の抽出中にエラーが発生しました: {str(e)}"
        )


@router.post("/extract/batch")
async def extract_tigers_batch(
    request: ExtractRequest,
    db: Session = Depends(get_db)
):
    """
    複数動画から社長を一括抽出

    Args:
        request: 動画IDのリスト

    Returns:
        一括抽出結果
    """
    try:
        extractor = TigerExtractor(db)
        result = extractor.extract_batch(request.video_ids)
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"一括抽出中にエラーが発生しました: {str(e)}"
        )


@router.post("/extract/all")
async def extract_tigers_from_all_videos(
    db: Session = Depends(get_db)
):
    """
    データベース内の全動画から社長を一括抽出

    Returns:
        全動画の抽出結果
    """
    try:
        from analyzers.tiger_extractor import extract_tigers_from_all_videos
        result = extract_tigers_from_all_videos(db)
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"全動画の抽出中にエラーが発生しました: {str(e)}"
        )


@router.get("/extract/preview/{video_id}")
async def preview_tiger_extraction(
    video_id: str,
    db: Session = Depends(get_db)
):
    """
    社長の抽出結果をプレビュー（DBに登録しない）

    Args:
        video_id: YouTube動画ID

    Returns:
        抽出プレビュー結果
    """
    try:
        from models import Video

        video = db.query(Video).filter(Video.video_id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="動画が見つかりません")

        extractor = TigerExtractor(db)

        # タイトルから抽出
        title_tigers = extractor.extract_from_title(video.title)

        # 概要欄から抽出（未登録の名前も取得）
        description_result = extractor.extract_from_description_with_unmatched(video.description or "")
        description_tigers = description_result['matched_ids']
        unmatched_names = description_result['unmatched_names']

        # 統合
        all_tiger_ids = list(set(title_tigers + description_tigers))

        # 社長情報を取得
        tigers_info = []
        for tiger_id in all_tiger_ids:
            tiger = next((t for t in extractor.tigers if t.tiger_id == tiger_id), None)
            if tiger:
                tigers_info.append({
                    "tiger_id": tiger_id,
                    "display_name": tiger.display_name,
                    "full_name": tiger.full_name,
                    "source": "title" if tiger_id in title_tigers else "description"
                })

        return {
            "video_id": video_id,
            "video_title": video.title,
            "found_tigers": tigers_info,
            "total_found": len(all_tiger_ids),
            "unmatched_names": unmatched_names
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"プレビュー生成中にエラーが発生しました: {str(e)}"
        )
