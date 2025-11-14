"""
Tigers (社長マスタ) API Router
"""
from fastapi import APIRouter, HTTPException
from typing import List
import json
import os
import sys
import httpx
import re

# パスを追加してutilsをインポート可能にする
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
from utils.image_cache import download_and_cache_image, delete_cached_image

from ..schemas import Tiger, TigerCreate

router = APIRouter()

TIGERS_FILE = os.path.join(os.path.dirname(__file__), "../../../data/tigers.json")
ALIASES_FILE = os.path.join(os.path.dirname(__file__), "../../../data/aliases.json")


def load_tigers() -> List[dict]:
    """社長マスタを読み込み"""
    try:
        with open(TIGERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []


def save_tigers(tigers: List[dict]):
    """社長マスタを保存"""
    with open(TIGERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(tigers, f, ensure_ascii=False, indent=2)


def load_aliases() -> dict:
    """エイリアスマスタを読み込み"""
    try:
        with open(ALIASES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_aliases(aliases: dict):
    """エイリアスマスタを保存"""
    with open(ALIASES_FILE, 'w', encoding='utf-8') as f:
        json.dump(aliases, f, ensure_ascii=False, indent=2)


@router.get("", response_model=List[Tiger])
async def get_all_tigers():
    """全社長を取得"""
    tigers = load_tigers()
    return tigers


@router.get("/{tiger_id}", response_model=Tiger)
async def get_tiger(tiger_id: str):
    """特定の社長を取得"""
    tigers = load_tigers()
    tiger = next((t for t in tigers if t['tiger_id'] == tiger_id), None)

    if not tiger:
        raise HTTPException(status_code=404, detail=f"Tiger {tiger_id} not found")

    return tiger


@router.post("", response_model=Tiger)
async def create_tiger(tiger: TigerCreate):
    """新しい社長を追加"""
    tigers = load_tigers()

    # 重複チェック
    if any(t['tiger_id'] == tiger.tiger_id for t in tigers):
        raise HTTPException(status_code=400, detail=f"Tiger {tiger.tiger_id} already exists")

    new_tiger = tiger.model_dump()

    # 画像URLが指定されている場合、ダウンロードしてキャッシュ
    if new_tiger.get('image_url') and new_tiger['image_url'].startswith(('http://', 'https://')):
        cached_path = await download_and_cache_image(new_tiger['image_url'], tiger.tiger_id)
        if cached_path:
            new_tiger['image_url'] = cached_path

    tigers.append(new_tiger)
    save_tigers(tigers)

    return new_tiger


@router.put("/{tiger_id}", response_model=Tiger)
async def update_tiger(tiger_id: str, tiger: TigerCreate):
    """社長情報を更新"""
    tigers = load_tigers()

    index = next((i for i, t in enumerate(tigers) if t['tiger_id'] == tiger_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail=f"Tiger {tiger_id} not found")

    old_tiger = tigers[index]
    updated_tiger = tiger.model_dump()

    # 画像URLが変更されていて、新しいURLが外部URLの場合、ダウンロードしてキャッシュ
    if updated_tiger.get('image_url'):
        new_url = updated_tiger['image_url']
        old_url = old_tiger.get('image_url', '')

        if new_url != old_url and new_url.startswith(('http://', 'https://')):
            # 古いキャッシュ画像を削除（ローカルパスの場合）
            if old_url and old_url.startswith('/static/'):
                delete_cached_image(old_url)

            # 新しい画像をダウンロードしてキャッシュ
            cached_path = await download_and_cache_image(new_url, tiger_id)
            if cached_path:
                updated_tiger['image_url'] = cached_path

    tigers[index] = updated_tiger
    save_tigers(tigers)

    return updated_tiger


@router.delete("/{tiger_id}")
async def delete_tiger(tiger_id: str):
    """社長を削除"""
    tigers = load_tigers()

    # 削除対象の社長を見つける
    tiger_to_delete = next((t for t in tigers if t['tiger_id'] == tiger_id), None)

    # キャッシュ画像を削除（ローカルパスの場合）
    if tiger_to_delete and tiger_to_delete.get('image_url', '').startswith('/static/'):
        delete_cached_image(tiger_to_delete['image_url'])

    tigers = [t for t in tigers if t['tiger_id'] != tiger_id]
    save_tigers(tigers)

    return {"message": f"Tiger {tiger_id} deleted successfully"}


async def fetch_x_profile_image(username: str) -> str | None:
    """
    XのユーザープロフィールページからOG画像URLを取得

    Args:
        username: Xのユーザー名（@なし）

    Returns:
        画像URL、失敗時はNone
    """
    try:
        url = f"https://x.com/{username}"
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()

            html = response.text

            # og:imageタグを探す
            og_image_match = re.search(r'<meta property="og:image" content="([^"]+)"', html)
            if og_image_match:
                return og_image_match.group(1)

            # twitter:imageタグを探す
            twitter_image_match = re.search(r'<meta name="twitter:image" content="([^"]+)"', html)
            if twitter_image_match:
                return twitter_image_match.group(1)

            return None
    except Exception as e:
        print(f"Error fetching X profile image for {username}: {e}")
        return None


@router.post("/{tiger_id}/fetch-x-image")
async def fetch_and_cache_x_image(tiger_id: str, request: dict):
    """
    Xのプロフィールページからアイコンをダウンロードしてキャッシュ

    Args:
        tiger_id: 社長ID
        request: { "x_username": "hayashinaohiro" }
    """
    x_username = request.get('x_username')
    if not x_username:
        raise HTTPException(status_code=400, detail="x_username is required")
    tigers = load_tigers()
    index = next((i for i, t in enumerate(tigers) if t['tiger_id'] == tiger_id), None)

    if index is None:
        raise HTTPException(status_code=404, detail=f"Tiger {tiger_id} not found")

    # Xのプロフィール画像URLを取得
    image_url = await fetch_x_profile_image(x_username)

    if not image_url:
        raise HTTPException(status_code=404, detail=f"Could not fetch profile image for @{x_username}")

    # 画像をダウンロードしてキャッシュ
    cached_path = await download_and_cache_image(image_url, tiger_id)

    if not cached_path:
        raise HTTPException(status_code=500, detail="Failed to download and cache image")

    # 古いキャッシュ画像を削除
    old_image_url = tigers[index].get('image_url', '')
    if old_image_url and old_image_url.startswith('/static/'):
        delete_cached_image(old_image_url)

    # 社長情報を更新
    tigers[index]['image_url'] = cached_path
    save_tigers(tigers)

    return {
        "message": f"Successfully fetched and cached image for {tiger_id}",
        "image_url": cached_path
    }


@router.get("/{tiger_id}/aliases")
async def get_tiger_aliases(tiger_id: str):
    """
    特定の社長のエイリアス一覧を取得

    Args:
        tiger_id: 社長ID

    Returns:
        エイリアスのリスト
    """
    # 社長が存在するか確認
    tigers = load_tigers()
    tiger = next((t for t in tigers if t['tiger_id'] == tiger_id), None)

    if not tiger:
        raise HTTPException(status_code=404, detail=f"Tiger {tiger_id} not found")

    # エイリアスを取得
    aliases = load_aliases()
    tiger_aliases = aliases.get(tiger_id, [])

    return {
        "tiger_id": tiger_id,
        "display_name": tiger['display_name'],
        "aliases": tiger_aliases
    }


@router.post("/{tiger_id}/aliases")
async def add_tiger_alias(tiger_id: str, request: dict):
    """
    社長にエイリアスを追加

    Args:
        tiger_id: 社長ID
        request: { "alias": "別名", "type": "タイプ", "priority": 優先度 }
    """
    # 社長が存在するか確認
    tigers = load_tigers()
    tiger = next((t for t in tigers if t['tiger_id'] == tiger_id), None)

    if not tiger:
        raise HTTPException(status_code=404, detail=f"Tiger {tiger_id} not found")

    # 必須フィールドの検証
    alias = request.get('alias', '').strip()
    alias_type = request.get('type', 'other')
    priority = request.get('priority', 5)

    if not alias:
        raise HTTPException(status_code=400, detail="alias is required")

    # エイリアスを追加
    aliases = load_aliases()

    if tiger_id not in aliases:
        aliases[tiger_id] = []

    # 重複チェック
    if any(a['alias'] == alias for a in aliases[tiger_id]):
        raise HTTPException(status_code=400, detail=f"Alias '{alias}' already exists")

    # 新しいエイリアスを追加
    new_alias = {
        "alias": alias,
        "type": alias_type,
        "priority": priority
    }
    aliases[tiger_id].append(new_alias)

    # 優先度順にソート
    aliases[tiger_id].sort(key=lambda x: x['priority'])

    save_aliases(aliases)

    return {
        "message": f"Alias '{alias}' added to {tiger_id}",
        "alias": new_alias
    }


@router.delete("/{tiger_id}/aliases/{alias}")
async def delete_tiger_alias(tiger_id: str, alias: str):
    """
    社長のエイリアスを削除

    Args:
        tiger_id: 社長ID
        alias: 削除するエイリアス
    """
    # 社長が存在するか確認
    tigers = load_tigers()
    tiger = next((t for t in tigers if t['tiger_id'] == tiger_id), None)

    if not tiger:
        raise HTTPException(status_code=404, detail=f"Tiger {tiger_id} not found")

    # エイリアスを削除
    aliases = load_aliases()

    if tiger_id not in aliases:
        raise HTTPException(status_code=404, detail=f"No aliases found for {tiger_id}")

    # エイリアスを検索して削除
    original_count = len(aliases[tiger_id])
    aliases[tiger_id] = [a for a in aliases[tiger_id] if a['alias'] != alias]

    if len(aliases[tiger_id]) == original_count:
        raise HTTPException(status_code=404, detail=f"Alias '{alias}' not found")

    save_aliases(aliases)

    return {
        "message": f"Alias '{alias}' deleted from {tiger_id}"
    }
