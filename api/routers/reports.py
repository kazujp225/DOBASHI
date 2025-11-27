"""
Reports API Router - レポート生成
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from models import get_db
from utils.report_generator import ReportGenerator, ReportConfig

router = APIRouter()


class ReportConfigInput(BaseModel):
    """レポート設定の入力スキーマ"""
    title: str = "令和の虎 コメント分析レポート"
    period: str = "monthly"
    includeCharts: bool = True
    includeDetails: bool = True
    includeSentiment: bool = True
    includeWordcloud: bool = False
    maxTigers: int = 10
    maxVideos: int = 20


class ReportRequest(BaseModel):
    """レポート生成リクエスト"""
    config: ReportConfigInput
    stats_data: Dict[str, Any]
    format: str = "html"


@router.post("/generate")
async def generate_report(request: ReportRequest, db: Session = Depends(get_db)):
    """
    レポートを生成する

    - **config**: レポート設定
    - **stats_data**: 統計データ
    - **format**: 出力形式 (html or markdown)
    """
    try:
        # 設定を変換
        report_config = ReportConfig(
            title=request.config.title,
            period=request.config.period,
            include_charts=request.config.includeCharts,
            include_details=request.config.includeDetails,
            include_sentiment=request.config.includeSentiment,
            include_wordcloud=request.config.includeWordcloud,
            max_tigers=request.config.maxTigers,
            max_videos=request.config.maxVideos
        )

        # レポート生成
        generator = ReportGenerator(config=report_config)
        report_bytes = generator.generate_report(
            stats_data=request.stats_data,
            output_format=request.format
        )

        # コンテンツタイプを設定
        if request.format == "html":
            content_type = "text/html; charset=utf-8"
            filename = "report.html"
        else:
            content_type = "text/markdown; charset=utf-8"
            filename = "report.md"

        return Response(
            content=report_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"レポート生成中にエラーが発生しました: {str(e)}"
        )
