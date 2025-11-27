"""
画像キャッシュユーティリティ
外部URLから画像をダウンロードしてローカルに保存
"""
import os
import hashlib
import httpx
import socket
import ipaddress
from urllib.parse import urlparse
from pathlib import Path
from typing import Optional

STATIC_DIR = Path(__file__).parent.parent / "static"
IMAGES_DIR = STATIC_DIR / "images" / "tigers"

# ディレクトリが存在しない場合は作成
IMAGES_DIR.mkdir(parents=True, exist_ok=True)


MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB


def _is_private_address(host: str) -> bool:
    """SSRF対策: 内部アドレスを弾く"""
    try:
        infos = socket.getaddrinfo(host, None)
        for family, _, _, _, sockaddr in infos:
            if family == socket.AF_INET:
                ip = ipaddress.ip_address(sockaddr[0])
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                    return True
            elif family == socket.AF_INET6:
                ip = ipaddress.ip_address(sockaddr[0])
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                    return True
    except Exception:
        # 解決不可やエラー時は安全側に倒す
        return True
    return False


async def download_and_cache_image(image_url: str, tiger_id: str) -> Optional[str]:
    """
    画像をダウンロードしてローカルに保存

    Args:
        image_url: 画像のURL
        tiger_id: 社長ID

    Returns:
        ローカル画像のパス（/static/images/tigers/...）、失敗時はNone
    """
    if not image_url or not image_url.startswith(('http://', 'https://')):
        return None

    try:
        # SSRF対策: 内部アドレスをブロック
        parsed = urlparse(image_url)
        if not parsed.scheme or not parsed.netloc:
            return None
        if _is_private_address(parsed.hostname):
            return None
        # 画像をダウンロード
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(image_url, follow_redirects=True)
            response.raise_for_status()

            # Content-Typeから拡張子を判定
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                return None
            ext = '.jpg'  # デフォルト
            if 'png' in content_type:
                ext = '.png'
            elif 'gif' in content_type:
                ext = '.gif'
            elif 'webp' in content_type:
                ext = '.webp'
            elif 'jpeg' in content_type or 'jpg' in content_type:
                ext = '.jpg'

            # サイズ制限
            try:
                content_length = int(response.headers.get('content-length', '0'))
            except Exception:
                content_length = 0
            if content_length and content_length > MAX_IMAGE_BYTES:
                return None
            if not content_length and len(response.content) > MAX_IMAGE_BYTES:
                return None

            # ファイル名を生成（tiger_id + URLのハッシュ）
            url_hash = hashlib.md5(image_url.encode()).hexdigest()[:8]
            filename = f"{tiger_id}_{url_hash}{ext}"
            filepath = IMAGES_DIR / filename

            # 画像を保存
            with open(filepath, 'wb') as f:
                f.write(response.content)

            # 相対パスを返す（フロントエンドで使用）
            return f"/static/images/tigers/{filename}"

    except Exception as e:
        print(f"Error downloading image from {image_url}: {e}")
        return None


def delete_cached_image(image_path: str) -> bool:
    """
    キャッシュされた画像を削除

    Args:
        image_path: 画像のパス（/static/images/tigers/...）

    Returns:
        削除成功時True
    """
    if not image_path or not image_path.startswith('/static/images/tigers/'):
        return False

    try:
        filename = image_path.split('/')[-1]
        filepath = IMAGES_DIR / filename

        if filepath.exists():
            filepath.unlink()
            return True
        return False
    except Exception as e:
        print(f"Error deleting cached image {image_path}: {e}")
        return False


def get_cached_images() -> list[str]:
    """
    キャッシュされた画像の一覧を取得

    Returns:
        画像パスのリスト
    """
    try:
        images = []
        for filepath in IMAGES_DIR.glob('*'):
            if filepath.is_file():
                images.append(f"/static/images/tigers/{filepath.name}")
        return images
    except Exception:
        return []
