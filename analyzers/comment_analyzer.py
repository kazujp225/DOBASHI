"""コメント解析・社長言及判定モジュール（Phase 0 改修版）"""
import json
import re
import unicodedata
from typing import List, Dict, Set, Optional


class CommentAnalyzer:
    """コメントから社長への言及を判定"""

    # 日本語文字の正規表現パターン
    JAPANESE_CHAR_PATTERN = r'[一-龠ぁ-んァ-ヶー]'
    ALPHANUMERIC_PATTERN = r'[a-zA-Z0-9]'

    # 後続語パターン（敬称など）
    SUFFIX_PATTERN = r'(?:社長|さん|氏|先生|ちゃん|くん|君)'

    # typeの優先順位（勝者決定用）
    TYPE_PRIORITY = {
        'fullname': 1,
        'formal': 2,
        'nickname': 3,
        'casual': 4,
        'business': 5,
        'firstname': 6,
        'hiragana': 7,
        'katakana': 8,
        'short': 9,
    }

    def __init__(self, tigers_file: str = 'data/tigers.json', aliases_file: str = 'data/aliases.json'):
        """
        初期化

        Args:
            tigers_file: 社長マスタJSONファイルのパス
            aliases_file: エイリアス辞書JSONファイルのパス
        """
        # 社長マスタを読み込み
        with open(tigers_file, 'r', encoding='utf-8') as f:
            self.tigers = {t['tiger_id']: t for t in json.load(f)}

        # エイリアス辞書を読み込み
        with open(aliases_file, 'r', encoding='utf-8') as f:
            self.aliases = json.load(f)

    def normalize_text(self, text: str) -> str:
        """
        テキストを正規化

        Args:
            text: 正規化するテキスト

        Returns:
            正規化されたテキスト
        """
        # NFKC正規化（全角・半角の統一）
        text = unicodedata.normalize('NFKC', text)

        # 空白を整理（連続空白を1つに）
        text = re.sub(r'\s+', ' ', text)

        # 前後の空白を削除
        text = text.strip()

        return text

    def _is_word_boundary(self, text: str, start: int, end: int, alias: str = '') -> bool:
        """
        マッチ位置が単語境界かどうかを判定

        Args:
            text: 対象テキスト
            start: マッチ開始位置
            end: マッチ終了位置
            alias: マッチしたエイリアス（敬称チェック用）

        Returns:
            単語境界であればTrue
        """
        # 前の文字チェック
        if start > 0:
            prev_char = text[start - 1]
            # 前の文字が日本語文字または英数字なら境界ではない
            if re.match(self.JAPANESE_CHAR_PATTERN, prev_char) or re.match(self.ALPHANUMERIC_PATTERN, prev_char):
                # ただし助詞の後ろは境界として扱う
                particles = ['は', 'が', 'を', 'に', 'へ', 'と', 'や', 'の', 'で', 'も']
                if prev_char not in particles:
                    return False

        # 後ろの文字チェック
        if end < len(text):
            next_char = text[end]
            # 後ろの文字が日本語文字または英数字なら境界ではない
            if re.match(self.JAPANESE_CHAR_PATTERN, next_char) or re.match(self.ALPHANUMERIC_PATTERN, next_char):
                # エイリアス自体が敬称で終わっている場合は境界OK
                if re.search(self.SUFFIX_PATTERN + r'$', alias):
                    return True
                # 4文字以上の長いエイリアスは後続チェック緩和（誤検知リスク低い）
                if len(alias) >= 4:
                    return True
                # 後続が敬称かどうかチェック
                remaining = text[end:]
                if not re.match(self.SUFFIX_PATTERN, remaining):
                    return False

        return True

    def _match_alias_with_boundary(self, alias: str, text: str, require_suffix: bool = False) -> Optional[int]:
        """
        境界チェック付きでエイリアスをマッチング

        Args:
            alias: マッチするエイリアス
            text: 対象テキスト
            require_suffix: 後続語（敬称）が必須かどうか

        Returns:
            マッチ位置（マッチしなければNone）
        """
        start = 0
        while True:
            pos = text.find(alias, start)
            if pos == -1:
                return None

            end = pos + len(alias)

            # 境界チェック
            if self._is_word_boundary(text, pos, end, alias):
                # 後続語必須の場合は追加チェック
                if require_suffix:
                    remaining = text[end:]
                    if re.match(self.SUFFIX_PATTERN, remaining):
                        return pos
                else:
                    return pos

            # 次の位置から再検索
            start = pos + 1

        return None

    def _should_require_suffix(self, alias: str, alias_type: str) -> bool:
        """
        後続語（敬称）が必須かどうかを判定

        Args:
            alias: エイリアス
            alias_type: エイリアスのタイプ

        Returns:
            後続語が必須ならTrue
        """
        # 短いエイリアス（3文字以下）で、short/casual/hiragana/katakana タイプは後続語必須
        if len(alias) <= 3 and alias_type in ['short', 'casual', 'hiragana', 'katakana']:
            return True

        # 2文字以下は全て後続語必須
        if len(alias) <= 2:
            return True

        return False

    def _calculate_match_score(self, alias: str, priority: int, alias_type: str) -> tuple:
        """
        マッチのスコアを計算（勝者決定用）

        Args:
            alias: マッチしたエイリアス
            priority: 優先度
            alias_type: エイリアスのタイプ

        Returns:
            スコアタプル（小さい方が優先）
        """
        # 1. 最長一致（長い方を優先 = 負の値で小さくする）
        length_score = -len(alias)

        # 2. priority（小さい方が優先）
        priority_score = priority

        # 3. type優先度（小さい方が優先）
        type_score = self.TYPE_PRIORITY.get(alias_type, 99)

        return (length_score, priority_score, type_score)

    def find_tiger_mentions(self, comment_text: str, target_tigers: List[str] = None) -> Dict:
        """
        コメントから社長への言及を検出

        Args:
            comment_text: コメントテキスト
            target_tigers: 検出対象の社長IDリスト（必須：出演虎のみ指定）

        Returns:
            検出結果の辞書
            {
                'normalized_text': str,  # 正規化済みテキスト
                'mentions': [            # 言及リスト
                    {
                        'tiger_id': str,
                        'matched_alias': str,
                        'alias_type': str,
                        'priority': int
                    },
                    ...
                ]
            }
        """
        # テキスト正規化
        normalized_text = self.normalize_text(comment_text)

        # 出演虎の指定がない場合は警告（本来は必須にすべき）
        if target_tigers is None or len(target_tigers) == 0:
            # 後方互換性のため全社長で検索するが、警告を出す
            import warnings
            warnings.warn("target_tigers が指定されていません。出演虎を指定してください。", UserWarning)
            target_tigers = list(self.tigers.keys())

        # 全候補を収集（後で勝者決定）
        all_matches = []  # [(tiger_id, alias, type, priority, position, score), ...]

        # 各社長のエイリアスでマッチング
        for tiger_id in target_tigers:
            if tiger_id not in self.aliases:
                continue

            for alias_info in self.aliases[tiger_id]:
                alias = alias_info['alias']
                alias_type = alias_info['type']
                priority = alias_info['priority']

                # 後続語が必要かどうか判定
                require_suffix = self._should_require_suffix(alias, alias_type)

                # 境界チェック付きマッチング
                match_pos = self._match_alias_with_boundary(alias, normalized_text, require_suffix)

                if match_pos is not None:
                    score = self._calculate_match_score(alias, priority, alias_type)
                    all_matches.append({
                        'tiger_id': tiger_id,
                        'alias': alias,
                        'type': alias_type,
                        'priority': priority,
                        'position': match_pos,
                        'score': score
                    })

        # 勝者決定：同一tiger_idの中でスコアが最も良いものを選択
        best_matches = {}
        for match in all_matches:
            tiger_id = match['tiger_id']
            if tiger_id not in best_matches or match['score'] < best_matches[tiger_id]['score']:
                best_matches[tiger_id] = match

        # 結果を整形
        mentions = []
        for tiger_id, match in best_matches.items():
            mentions.append({
                'tiger_id': tiger_id,
                'matched_alias': match['alias'],
                'alias_type': match['type'],
                'priority': match['priority']
            })

        return {
            'normalized_text': normalized_text,
            'mentions': mentions
        }

    def analyze_comments(
        self,
        comments: List[Dict],
        target_tigers: List[str] = None
    ) -> List[Dict]:
        """
        コメントリストを一括解析

        Args:
            comments: コメント情報のリスト
            target_tigers: 検出対象の社長IDリスト（必須：出演虎のみ指定）

        Returns:
            解析結果のリスト
        """
        results = []

        for comment in comments:
            analysis_result = self.find_tiger_mentions(
                comment['text'],
                target_tigers
            )

            results.append({
                **comment,
                'normalized_text': analysis_result['normalized_text'],
                'tiger_mentions': analysis_result['mentions']
            })

        return results

    def get_mention_stats(self, analyzed_comments: List[Dict], target_tigers: List[str] = None) -> Dict:
        """
        言及統計を計算

        Args:
            analyzed_comments: 解析済みコメントのリスト
            target_tigers: 集計対象の社長IDリスト（指定された虎のみ集計）

        Returns:
            統計情報の辞書
        """
        stats = {}

        # 対象虎のみ集計
        tiger_ids_to_count = target_tigers if target_tigers else list(self.tigers.keys())

        # 各社長の言及数をカウント
        for tiger_id in tiger_ids_to_count:
            if tiger_id not in self.tigers:
                continue
            mention_count = sum(
                1 for comment in analyzed_comments
                if any(m['tiger_id'] == tiger_id for m in comment['tiger_mentions'])
            )
            stats[tiger_id] = {
                'tiger_id': tiger_id,
                'display_name': self.tigers[tiger_id]['display_name'],
                'mention_count': mention_count
            }

        return stats


# 使用例・テスト
if __name__ == '__main__':
    # テストデータ
    test_comments = [
        {'comment_id': '1', 'text': '林社長すごい!', 'video_id': 'test'},
        {'comment_id': '2', 'text': '岩井社長と林社長の対決が面白い', 'video_id': 'test'},
        {'comment_id': '3', 'text': '野口英世について語ってた', 'video_id': 'test'},  # 誤検知テスト
        {'comment_id': '4', 'text': '面白かった', 'video_id': 'test'},
        {'comment_id': '5', 'text': '桑田社長の話が参考になった', 'video_id': 'test'},
        {'comment_id': '6', 'text': '野口さんすごい', 'video_id': 'test'},  # 出演してないので検出されないべき
    ]

    analyzer = CommentAnalyzer()

    # 出演社長（この動画に出演している社長のID）- 野口は含まない
    appearing_tigers = ['hayashi_naohiro', 'iwai_yoshiaki', 'kuwata_ryusei']

    # 解析実行
    print("=" * 60)
    print("Phase 0 改修版 コメント解析テスト")
    print("=" * 60)
    print(f"\n出演虎: {appearing_tigers}")
    print("-" * 60)

    results = analyzer.analyze_comments(test_comments, appearing_tigers)

    for result in results:
        print(f"\nコメント: {result['text']}")
        if result['tiger_mentions']:
            print("  → 検出:")
            for mention in result['tiger_mentions']:
                tiger_name = analyzer.tigers[mention['tiger_id']]['display_name']
                print(f"     - {tiger_name} (マッチ: '{mention['matched_alias']}', type: {mention['alias_type']})")
        else:
            print("  → 検出: なし")

    # 統計表示
    print("\n" + "=" * 60)
    print("言及統計（出演虎のみ）")
    print("=" * 60)
    stats = analyzer.get_mention_stats(results, appearing_tigers)
    for tiger_id, stat in stats.items():
        print(f"  {stat['display_name']}: {stat['mention_count']}件")
