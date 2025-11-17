"""
ワードクラウドAPIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from models import get_db, Video, Comment, CommentTigerRelation, Tiger, TigerAlias
from utils.wordcloud_generator import WordCloudGenerator
from core.cache import cache_manager
from ..dependencies import get_current_user_optional

router = APIRouter(prefix="/wordcloud", tags=["wordcloud"])

# ワードクラウド生成器のインスタンス
wordcloud_generator = WordCloudGenerator()


@router.get("/video/{video_id}")
async def generate_video_wordcloud(
    video_id: str,
    db: Session = Depends(get_db),
    max_words: int = Query(50, description="最大単語数"),
    use_cache: bool = Query(True, description="キャッシュを使用するか"),
    current_user=Depends(get_current_user_optional)
):
    """
    動画のコメントからワードクラウドを生成
    """
    # キャッシュチェック
    cache_key = f"wordcloud:video:{video_id}:{max_words}"
    if use_cache:
        cached = cache_manager.get(cache_key)
        if cached:
            return cached

    # 動画の存在確認
    video = db.query(Video).filter(Video.video_id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="動画が見つかりません")

    # コメント取得
    comments = db.query(Comment).filter(
        Comment.video_id == video_id
    ).limit(1000).all()  # 最大1000件

    if not comments:
        return {
            "video_id": video_id,
            "error": "コメントが見つかりません"
        }

    # コメントテキストの抽出
    texts = [c.text_original for c in comments]

    # ワードクラウドデータを生成
    wordcloud_data = wordcloud_generator.generate_wordcloud_data(texts, max_words)

    response = {
        "video_id": video_id,
        "video_title": video.title,
        "comment_count": len(texts),
        "wordcloud": wordcloud_data,
        "generated_at": datetime.now().isoformat()
    }

    # キャッシュに保存（1時間）
    cache_manager.set(cache_key, response, expire_seconds=3600)

    return response


@router.get("/video/{video_id}/svg")
async def generate_video_wordcloud_svg(
    video_id: str,
    db: Session = Depends(get_db),
    width: int = Query(800, description="SVGの幅"),
    height: int = Query(400, description="SVGの高さ"),
    current_user=Depends(get_current_user_optional)
):
    """
    動画のワードクラウドをSVG形式で生成
    """
    # 動画の存在確認
    video = db.query(Video).filter(Video.video_id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="動画が見つかりません")

    # コメント取得
    comments = db.query(Comment).filter(
        Comment.video_id == video_id
    ).limit(500).all()

    if not comments:
        raise HTTPException(status_code=404, detail="コメントが見つかりません")

    # 単語頻度を生成
    texts = [c.text_original for c in comments]
    word_freq = wordcloud_generator.generate_word_frequency(texts, max_words=30)

    # SVGを生成
    svg_content = wordcloud_generator.generate_svg_wordcloud(word_freq, width, height)

    return Response(
        content=svg_content,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "max-age=3600",
            "Content-Disposition": f'inline; filename="wordcloud_{video_id}.svg"'
        }
    )


@router.get("/tiger/{tiger_id}")
async def generate_tiger_wordcloud(
    tiger_id: str,
    db: Session = Depends(get_db),
    max_words: int = Query(50, description="最大単語数"),
    days: int = Query(30, description="過去何日間のコメント"),
    current_user=Depends(get_current_user_optional)
):
    """
    特定の社長に関するコメントからワードクラウドを生成
    """
    # キャッシュチェック
    cache_key = f"wordcloud:tiger:{tiger_id}:{days}:{max_words}"
    cached = cache_manager.get(cache_key)
    if cached:
        return cached

    # 社長の存在確認
    tiger = db.query(Tiger).filter(Tiger.tiger_id == tiger_id).first()
    if not tiger:
        raise HTTPException(status_code=404, detail="社長が見つかりません")

    # 日付範囲の計算
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    # 社長に言及しているコメントを取得
    comments = db.query(Comment).join(
        CommentTigerRelation,
        Comment.comment_id == CommentTigerRelation.comment_id
    ).filter(
        CommentTigerRelation.tiger_id == tiger_id,
        Comment.published_at >= start_date,
        Comment.published_at <= end_date
    ).limit(1000).all()

    if not comments:
        return {
            "tiger_id": tiger_id,
            "tiger_name": tiger.display_name,
            "error": "この期間のコメントが見つかりません"
        }

    # コメントテキストの抽出
    texts = [c.text_original for c in comments]

    # ワードクラウドデータを生成
    wordcloud_data = wordcloud_generator.generate_wordcloud_data(texts, max_words)

    response = {
        "tiger_id": tiger_id,
        "tiger_name": tiger.display_name,
        "period_days": days,
        "comment_count": len(texts),
        "wordcloud": wordcloud_data,
        "generated_at": datetime.now().isoformat()
    }

    # キャッシュに保存（6時間）
    cache_manager.set(cache_key, response, expire_seconds=21600)

    return response


@router.get("/comparison")
async def generate_comparison_wordcloud(
    tiger_ids: str = Query(..., description="カンマ区切りの社長ID"),
    db: Session = Depends(get_db),
    max_words: int = Query(30, description="社長ごとの最大単語数"),
    days: int = Query(30, description="過去何日間のコメント"),
    current_user=Depends(get_current_user_optional)
):
    """
    複数の社長のワードクラウドを比較
    """
    tiger_id_list = tiger_ids.split(",")
    if len(tiger_id_list) > 5:
        raise HTTPException(
            status_code=400,
            detail="一度に比較できる社長は5人までです"
        )

    # 日付範囲の計算
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    comparison_results = []

    for tiger_id in tiger_id_list:
        # 社長の存在確認
        tiger = db.query(Tiger).filter(Tiger.tiger_id == tiger_id.strip()).first()
        if not tiger:
            comparison_results.append({
                "tiger_id": tiger_id,
                "error": "社長が見つかりません"
            })
            continue

        # コメント取得
        comments = db.query(Comment).join(
            CommentTigerRelation,
            Comment.comment_id == CommentTigerRelation.comment_id
        ).filter(
            CommentTigerRelation.tiger_id == tiger_id.strip(),
            Comment.published_at >= start_date,
            Comment.published_at <= end_date
        ).limit(500).all()

        if comments:
            texts = [c.text_original for c in comments]
            wordcloud_data = wordcloud_generator.generate_wordcloud_data(texts, max_words)

            comparison_results.append({
                "tiger_id": tiger_id.strip(),
                "tiger_name": tiger.display_name,
                "comment_count": len(texts),
                "wordcloud": wordcloud_data
            })
        else:
            comparison_results.append({
                "tiger_id": tiger_id.strip(),
                "tiger_name": tiger.display_name,
                "error": "コメントが見つかりません"
            })

    return {
        "comparison": comparison_results,
        "period_days": days,
        "generated_at": datetime.now().isoformat()
    }


@router.get("/trending")
async def get_trending_words(
    db: Session = Depends(get_db),
    hours: int = Query(24, description="過去何時間のトレンド"),
    max_words: int = Query(20, description="最大単語数"),
    current_user=Depends(get_current_user_optional)
):
    """
    直近のトレンドワードを取得
    """
    # キャッシュチェック
    cache_key = f"wordcloud:trending:{hours}:{max_words}"
    cached = cache_manager.get(cache_key)
    if cached:
        return cached

    # 時間範囲の計算
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)

    # 最近のコメントを取得
    recent_comments = db.query(Comment).filter(
        Comment.published_at >= start_time,
        Comment.published_at <= end_time
    ).limit(2000).all()

    if not recent_comments:
        return {
            "error": "最近のコメントが見つかりません",
            "hours": hours
        }

    # テキストの抽出
    texts = [c.text_original for c in recent_comments]

    # 単語頻度を生成
    word_freq = wordcloud_generator.generate_word_frequency(texts, max_words)

    # トレンドワードのリストを作成
    trending_words = [
        {
            "rank": i + 1,
            "word": word,
            "count": count
        }
        for i, (word, count) in enumerate(word_freq.items())
    ]

    response = {
        "period_hours": hours,
        "total_comments": len(recent_comments),
        "trending_words": trending_words,
        "generated_at": datetime.now().isoformat()
    }

    # キャッシュに保存（30分）
    cache_manager.set(cache_key, response, expire_seconds=1800)

    return response