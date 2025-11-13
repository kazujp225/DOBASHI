"""コメント解析・社長言及判定モジュール"""
import json
import re
import unicodedata
from typing import List, Dict, Set


class CommentAnalyzer:
    """コメントから社長への言及を判定"""

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

        # 空白を整理
        text = re.sub(r'\s+', ' ', text)

        # 前後の空白を削除
        text = text.strip()

        return text

    def find_tiger_mentions(self, comment_text: str, target_tigers: List[str] = None) -> Dict:
        """
        コメントから社長への言及を検出

        Args:
            comment_text: コメントテキスト
            target_tigers: 検出対象の社長IDリスト（Noneの場合は全社長）

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

        # 検出対象の社長IDを設定
        if target_tigers is None:
            target_tigers = list(self.tigers.keys())

        mentions = []
        detected_tiger_ids = set()  # 重複検出防止

        # 各社長のエイリアスでマッチング
        for tiger_id in target_tigers:
            if tiger_id not in self.aliases:
                continue

            # 優先度順にソート
            sorted_aliases = sorted(
                self.aliases[tiger_id],
                key=lambda x: x['priority']
            )

            # エイリアスでマッチング
            for alias_info in sorted_aliases:
                alias = alias_info['alias']

                # 文字列マッチング（単純な部分文字列検索）
                if alias in normalized_text:
                    # 短縮形の場合は文脈チェック
                    if alias_info['type'] == 'short' and len(alias) <= 2:
                        # 「社長」「さん」などが後続しているかチェック
                        pattern = alias + r'(社長|さん|氏)'
                        if not re.search(pattern, normalized_text):
                            continue

                    # まだ検出されていない社長の場合のみ追加
                    if tiger_id not in detected_tiger_ids:
                        mentions.append({
                            'tiger_id': tiger_id,
                            'matched_alias': alias,
                            'alias_type': alias_info['type'],
                            'priority': alias_info['priority']
                        })
                        detected_tiger_ids.add(tiger_id)
                        break  # この社長については検出完了

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
            target_tigers: 検出対象の社長IDリスト

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

    def get_mention_stats(self, analyzed_comments: List[Dict]) -> Dict:
        """
        言及統計を計算

        Args:
            analyzed_comments: 解析済みコメントのリスト

        Returns:
            統計情報の辞書
        """
        stats = {}

        # 各社長の言及数をカウント
        for tiger_id in self.tigers.keys():
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


# 使用例
if __name__ == '__main__':
    # テストデータ
    test_comments = [
        {'comment_id': '1', 'text': '林社長すごい!', 'video_id': 'test'},
        {'comment_id': '2', 'text': '岩井社長と林社長の対決が面白い', 'video_id': 'test'},
        {'comment_id': '3', 'text': 'あすかさんのアドバイスが的確', 'video_id': 'test'},
        {'comment_id': '4', 'text': '面白かった', 'video_id': 'test'},
        {'comment_id': '5', 'text': 'FC林と佐々木社長の掛け合いが最高', 'video_id': 'test'},
    ]

    analyzer = CommentAnalyzer()

    # 出演社長（この動画に出演している社長のID）
    appearing_tigers = ['hayashi', 'iwai', 'asuka', 'sasaki']

    # 解析実行
    print("コメント解析中...\n")
    results = analyzer.analyze_comments(test_comments, appearing_tigers)

    for result in results:
        print(f"コメント: {result['text']}")
        print(f"正規化: {result['normalized_text']}")
        if result['tiger_mentions']:
            print("言及:")
            for mention in result['tiger_mentions']:
                tiger_name = analyzer.tigers[mention['tiger_id']]['display_name']
                print(f"  - {tiger_name} (マッチ: {mention['matched_alias']})")
        else:
            print("言及: なし")
        print()

    # 統計表示
    print("\n=== 言及統計 ===")
    stats = analyzer.get_mention_stats(results)
    for tiger_id, stat in stats.items():
        if tiger_id in appearing_tigers:
            print(f"{stat['display_name']}: {stat['mention_count']}件")
