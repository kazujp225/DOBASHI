"""
社長情報の自動抽出モジュール
動画のタイトル・概要欄から出演社長を特定
"""
import re
import os
import json
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session

from models import Tiger, VideoTiger, Video

# aliases.json のパス (バックエンドの data/ ディレクトリ)
ALIASES_FILE = os.path.join(os.path.dirname(__file__), "../data/aliases.json")


class TigerExtractor:
    """動画から社長情報を抽出するクラス"""

    def __init__(self, db: Session):
        self.db = db
        # 社長マスタを全件取得してキャッシュ
        self.tigers = db.query(Tiger).filter(Tiger.is_active == True).all()

        # aliases.json を読み込み
        self.aliases = {}
        try:
            with open(ALIASES_FILE, 'r', encoding='utf-8') as f:
                self.aliases = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            pass

        # 社長名のバリエーションを構築
        self.tiger_patterns = {}
        for tiger in self.tigers:
            patterns = set()

            # 表示名
            if tiger.display_name:
                patterns.add(tiger.display_name)
                # 「社長」を除いた名前
                patterns.add(tiger.display_name.replace('社長', '').strip())

            # 本名
            if tiger.full_name:
                patterns.add(tiger.full_name)
                # スペースを除去したバージョンも追加
                patterns.add(tiger.full_name.replace(' ', '').replace('　', ''))
                # 姓のみ（スペース区切りの場合）
                if ' ' in tiger.full_name:
                    patterns.add(tiger.full_name.split()[0])
                # 姓と名の間にスペースを入れたバージョン（2-3文字 + 残り）
                # 例: 林尚弘 → 林 尚弘
                name_no_space = tiger.full_name.replace(' ', '').replace('　', '')
                if len(name_no_space) >= 3:
                    # 姓が1-2文字の場合のバリエーションを追加
                    for i in range(1, min(3, len(name_no_space))):
                        patterns.add(name_no_space[:i] + ' ' + name_no_space[i:])
                        patterns.add(name_no_space[:i] + '　' + name_no_space[i:])

            # aliases.json からエイリアスを追加
            if tiger.tiger_id in self.aliases:
                for alias_entry in self.aliases[tiger.tiger_id]:
                    alias = alias_entry.get('alias', '')
                    if alias and len(alias) >= 2:
                        patterns.add(alias)

            self.tiger_patterns[tiger.tiger_id] = patterns

    def extract_from_title(self, title: str) -> List[str]:
        """
        動画タイトルから社長を抽出

        Args:
            title: 動画タイトル

        Returns:
            抽出された社長IDのリスト
        """
        found_tiger_ids = set()

        # パターン1: 【社長名】形式
        bracket_matches = re.findall(r'【([^】]+)】', title)
        for match in bracket_matches:
            tiger_id = self._match_tiger_name(match)
            if tiger_id:
                found_tiger_ids.add(tiger_id)

        # パターン2: 各社長のパターンと直接マッチング
        for tiger_id, patterns in self.tiger_patterns.items():
            for pattern in patterns:
                if len(pattern) >= 2 and pattern in title:
                    found_tiger_ids.add(tiger_id)

        return list(found_tiger_ids)

    def extract_from_description(self, description: str) -> List[str]:
        """
        動画概要欄から社長を抽出

        Args:
            description: 動画概要欄

        Returns:
            抽出された社長IDのリスト
        """
        result = self.extract_from_description_with_unmatched(description)
        return result['matched_ids']

    def extract_from_description_with_unmatched(self, description: str) -> Dict[str, any]:
        """
        動画概要欄から社長を抽出（未登録の名前も返す）

        Args:
            description: 動画概要欄

        Returns:
            {'matched_ids': [...], 'unmatched_names': [...]}
        """
        found_tiger_ids = set()
        unmatched_names = []

        if not description:
            return {'matched_ids': [], 'unmatched_names': []}

        # 概要欄を行ごとに処理
        lines = description.split('\n')

        # パターン1: ★令和の虎 セクションを探す（複数のフォーマットに対応）
        in_tiger_section = False
        tiger_section_keywords = ['★令和の虎', '★レギュラー虎', '★Tiger Funding']
        section_end_keywords = ['★志願者', '★司会', '★チャンネル', '★リライブ', '主宰・岩井', '二代目主宰']

        for i, line in enumerate(lines):
            line_stripped = line.strip()

            # 令和の虎 セクション開始（より柔軟なマッチ）
            if any(kw in line_stripped for kw in tiger_section_keywords):
                in_tiger_section = True
                continue

            # 別のセクション開始で終了
            if in_tiger_section:
                # ★で始まる別のセクション（令和の虎を含まない）
                if line_stripped.startswith('★') and '令和の虎' not in line_stripped and 'Tiger' not in line_stripped:
                    in_tiger_section = False
                    continue
                # 明確なセクション終了キーワード
                if any(kw in line_stripped for kw in section_end_keywords):
                    in_tiger_section = False
                    continue

            # 令和の虎セクション内の行を処理
            if in_tiger_section and line_stripped:
                # 名前の行を検出 (括弧で始まらない、URLでない、短すぎない)
                if not line_stripped.startswith('（') and not line_stripped.startswith('(') \
                   and not line_stripped.startswith('【') and not line_stripped.startswith('http') \
                   and len(line_stripped) >= 2 and len(line_stripped) <= 30:
                    # 社長名かチェック（スペースを除去してもマッチ）
                    tiger_id = self._match_tiger_name(line_stripped)
                    if tiger_id:
                        found_tiger_ids.add(tiger_id)
                    else:
                        # 「/」で区切られた複合名前（例：ゆうじ社長/田中 雄士）
                        if '/' in line_stripped:
                            for part in line_stripped.split('/'):
                                part = part.strip()
                                tiger_id = self._match_tiger_name(part)
                                if tiger_id:
                                    found_tiger_ids.add(tiger_id)
                                    break
                            else:
                                # どちらもマッチしなかった場合
                                unmatched_names.append(line_stripped)
                        else:
                            # 未登録の名前として記録（明らかに名前でない行を除外）
                            skip_patterns = [
                                'http', 'www.', '.com', '.jp', '@',
                                '▽', '→', '【', '】', '※', '★', '◆', '◇',  # 記号で始まる/含む行
                                'こちら', '申込', '応募', '募集', '詳細', '情報',  # URL案内などの文
                                'チャンネル', 'CHANNEL', 'YouTube', 'Twitter', 'Instagram',
                                'スポンサー', '運営', '加盟', '登録', '司会',
                            ]
                            if not any(skip in line_stripped for skip in skip_patterns):
                                # 名前らしい形式かチェック（日本語名前は2-8文字程度）
                                if len(line_stripped) >= 2 and len(line_stripped) <= 15:
                                    unmatched_names.append(line_stripped)

        # パターン2: タイムスタンプ形式: 00:00 社長名
        for line in lines[:100]:
            timestamp_match = re.search(r'(\d{1,2}:\d{2})\s*(.+)', line)
            if timestamp_match:
                name_part = timestamp_match.group(2)
                tiger_id = self._match_tiger_name(name_part)
                if tiger_id:
                    found_tiger_ids.add(tiger_id)

            # 「出演：」や「登場：」などのキーワード
            if any(keyword in line for keyword in ['出演', '登場', 'ゲスト', '審査員']):
                tiger_id = self._match_tiger_name(line)
                if tiger_id:
                    found_tiger_ids.add(tiger_id)

        # パターン3: 概要欄全体から直接マッチング（セクションに関係なく）
        # これにより、異なるフォーマットの概要欄でも社長を検出できる
        for tiger_id, patterns in self.tiger_patterns.items():
            if tiger_id in found_tiger_ids:
                continue
            for pattern in patterns:
                # 長めのパターン（3文字以上）のみ全文検索
                if len(pattern) >= 3 and pattern in description:
                    found_tiger_ids.add(tiger_id)
                    break

        return {'matched_ids': list(found_tiger_ids), 'unmatched_names': unmatched_names}

    def extract_tigers(self, video_id: str) -> Dict[str, any]:
        """
        動画から社長を自動抽出してデータベースに登録

        Args:
            video_id: YouTube動画ID

        Returns:
            抽出結果の辞書
        """
        # 動画情報を取得
        video = self.db.query(Video).filter(Video.video_id == video_id).first()
        if not video:
            return {
                "success": False,
                "error": "動画が見つかりません",
                "video_id": video_id
            }

        # タイトルから抽出
        title_tigers = self.extract_from_title(video.title)

        # 概要欄から抽出（未登録の名前も取得）
        description_result = self.extract_from_description_with_unmatched(video.description or "")
        description_tigers = description_result['matched_ids']
        unmatched_names = description_result['unmatched_names']

        # 重複を除いて統合
        all_tiger_ids = list(set(title_tigers + description_tigers))

        # 既存の登録をチェック
        existing = self.db.query(VideoTiger).filter(
            VideoTiger.video_id == video_id
        ).all()
        existing_tiger_ids = {vt.tiger_id for vt in existing}

        # 新規登録が必要な社長
        new_tiger_ids = [tid for tid in all_tiger_ids if tid not in existing_tiger_ids]

        # データベースに登録
        added_count = 0
        for tiger_id in new_tiger_ids:
            video_tiger = VideoTiger(
                video_id=video_id,
                tiger_id=tiger_id
            )
            self.db.add(video_tiger)
            added_count += 1

        if added_count > 0:
            self.db.commit()

        # 結果を構築
        all_registered_tigers = []
        for tiger_id in all_tiger_ids:
            tiger = next((t for t in self.tigers if t.tiger_id == tiger_id), None)
            if tiger:
                all_registered_tigers.append({
                    "tiger_id": tiger_id,
                    "display_name": tiger.display_name,
                    "source": "title" if tiger_id in title_tigers else "description",
                    "newly_added": tiger_id in new_tiger_ids
                })

        return {
            "success": True,
            "video_id": video_id,
            "video_title": video.title,
            "total_tigers_found": len(all_tiger_ids),
            "newly_added": added_count,
            "already_registered": len(existing_tiger_ids),
            "tigers": all_registered_tigers,
            "unmatched_names": unmatched_names
        }

    def _match_tiger_name(self, text: str) -> Optional[str]:
        """
        テキストから社長を特定

        Args:
            text: マッチング対象のテキスト

        Returns:
            マッチした社長のID（見つからない場合はNone）
        """
        text = text.strip()
        # スペースを除去した正規化テキストも準備
        text_normalized = text.replace(' ', '').replace('　', '')

        # 各社長のパターンとマッチング
        for tiger_id, patterns in self.tiger_patterns.items():
            for pattern in patterns:
                if len(pattern) >= 2:
                    # 元テキストでマッチ
                    if pattern in text:
                        return tiger_id
                    # スペース除去後のテキストでマッチ
                    pattern_normalized = pattern.replace(' ', '').replace('　', '')
                    if pattern_normalized in text_normalized:
                        return tiger_id

        return None

    def extract_batch(self, video_ids: List[str]) -> Dict[str, any]:
        """
        複数動画から一括抽出

        Args:
            video_ids: 動画IDのリスト

        Returns:
            一括抽出結果
        """
        results = []
        total_added = 0
        total_found = 0

        for video_id in video_ids:
            result = self.extract_tigers(video_id)
            results.append(result)

            if result.get("success"):
                total_added += result.get("newly_added", 0)
                total_found += result.get("total_tigers_found", 0)

        return {
            "success": True,
            "total_videos": len(video_ids),
            "total_tigers_found": total_found,
            "total_newly_added": total_added,
            "results": results
        }


def extract_tigers_from_video(db: Session, video_id: str) -> Dict[str, any]:
    """
    動画から社長を抽出する便利関数

    Args:
        db: データベースセッション
        video_id: YouTube動画ID

    Returns:
        抽出結果
    """
    extractor = TigerExtractor(db)
    return extractor.extract_tigers(video_id)


def extract_tigers_from_all_videos(db: Session) -> Dict[str, any]:
    """
    全動画から社長を一括抽出

    Args:
        db: データベースセッション

    Returns:
        一括抽出結果
    """
    # 全動画のIDを取得
    videos = db.query(Video).all()
    video_ids = [v.video_id for v in videos]

    extractor = TigerExtractor(db)
    return extractor.extract_batch(video_ids)
