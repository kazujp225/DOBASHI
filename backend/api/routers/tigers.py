"""
Tigers (社長マスタ) API Router
"""
from fastapi import APIRouter, HTTPException
from typing import List
import json
import os

from ..schemas import Tiger, TigerCreate

router = APIRouter()

TIGERS_FILE = os.path.join(os.path.dirname(__file__), "../../../data/tigers.json")


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


@router.get("/", response_model=List[Tiger])
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


@router.post("/", response_model=Tiger)
async def create_tiger(tiger: TigerCreate):
    """新しい社長を追加"""
    tigers = load_tigers()

    # 重複チェック
    if any(t['tiger_id'] == tiger.tiger_id for t in tigers):
        raise HTTPException(status_code=400, detail=f"Tiger {tiger.tiger_id} already exists")

    new_tiger = tiger.model_dump()
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

    updated_tiger = tiger.model_dump()
    tigers[index] = updated_tiger
    save_tigers(tigers)

    return updated_tiger


@router.delete("/{tiger_id}")
async def delete_tiger(tiger_id: str):
    """社長を削除"""
    tigers = load_tigers()

    tigers = [t for t in tigers if t['tiger_id'] != tiger_id]
    save_tigers(tigers)

    return {"message": f"Tiger {tiger_id} deleted successfully"}
