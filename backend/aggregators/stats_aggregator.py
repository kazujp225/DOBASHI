"""統計集計モジュール"""
import json
from typing import List, Dict


class StatsAggregator:
    """動画×社長の集計統計を計算"""

    def __init__(self, tigers_file: str = 'data/tigers.json'):
        """
        初期化

        Args:
            tigers_file: 社長マスタJSONファイルのパス
        """
        with open(tigers_file, 'r', encoding='utf-8') as f:
            self.tigers = {t['tiger_id']: t for t in json.load(f)}

    def calculate_video_stats(
        self,
        analyzed_comments: List[Dict],
        appearing_tigers: List[str]
    ) -> Dict:
        """
        動画ごとの社長別統計を計算

        Args:
            analyzed_comments: 解析済みコメントのリスト
            appearing_tigers: 出演社長のIDリスト

        Returns:
            統計情報の辞書
        """
        # N_total: 総コメント数
        N_total = len(analyzed_comments)

        # 社長に言及しているコメントのセット
        entity_comment_ids = set()
        for comment in analyzed_comments:
            if comment['tiger_mentions']:
                entity_comment_ids.add(comment['comment_id'])

        # N_entity: 誰かしらの社長に言及しているコメント数
        N_entity = len(entity_comment_ids)

        # 各社長ごとの統計
        tiger_stats = {}

        for tiger_id in appearing_tigers:
            # N_tiger: この社長に言及しているコメント数
            N_tiger = sum(
                1 for comment in analyzed_comments
                if any(m['tiger_id'] == tiger_id for m in comment['tiger_mentions'])
            )

            # Rate_total: 総コメント数に対する割合（絶対的存在感）
            Rate_total = (N_tiger / N_total * 100) if N_total > 0 else 0

            # Rate_entity: 社長言及コメント数に対する割合（相対的主役度）
            Rate_entity = (N_tiger / N_entity * 100) if N_entity > 0 else 0

            tiger_stats[tiger_id] = {
                'tiger_id': tiger_id,
                'display_name': self.tigers[tiger_id]['display_name'],
                'N_tiger': N_tiger,
                'Rate_total': Rate_total,
                'Rate_entity': Rate_entity
            }

        # Rate_totalで降順ソートして順位を付与
        sorted_stats = sorted(
            tiger_stats.values(),
            key=lambda x: x['Rate_total'],
            reverse=True
        )

        for rank, stat in enumerate(sorted_stats, start=1):
            stat['rank'] = rank

        return {
            'N_total': N_total,
            'N_entity': N_entity,
            'tiger_stats': {s['tiger_id']: s for s in sorted_stats}
        }

    def get_top_mentioned_comments(
        self,
        analyzed_comments: List[Dict],
        tiger_id: str,
        top_n: int = 10
    ) -> List[Dict]:
        """
        特定の社長に言及しているコメントのうち、いいね数上位を取得

        Args:
            analyzed_comments: 解析済みコメントのリスト
            tiger_id: 社長ID
            top_n: 取得する件数

        Returns:
            コメントのリスト
        """
        # この社長に言及しているコメントを抽出
        mentioned_comments = [
            comment for comment in analyzed_comments
            if any(m['tiger_id'] == tiger_id for m in comment['tiger_mentions'])
        ]

        # いいね数でソート
        sorted_comments = sorted(
            mentioned_comments,
            key=lambda x: x.get('like_count', 0),
            reverse=True
        )

        return sorted_comments[:top_n]

    def calculate_period_stats(
        self,
        video_stats_list: List[Dict],
        appearing_tigers_map: Dict[str, List[str]]
    ) -> Dict:
        """
        期間集計・ランキングを計算

        Args:
            video_stats_list: 各動画の統計情報リスト
                [{'video_id': str, 'stats': calculate_video_stats()の結果}, ...]
            appearing_tigers_map: 動画IDと出演社長リストのマッピング
                {'video_id': ['tiger_id1', 'tiger_id2', ...], ...}

        Returns:
            期間統計の辞書
        """
        # 全社長の累計データを初期化
        period_stats = {}
        for tiger_id in self.tigers.keys():
            period_stats[tiger_id] = {
                'tiger_id': tiger_id,
                'display_name': self.tigers[tiger_id]['display_name'],
                'total_mentions': 0,
                'appearance_count': 0,
                'avg_rate_total': 0,
                'avg_rate_entity': 0,
                'total_rate_total': 0,
                'total_rate_entity': 0
            }

        # 各動画の統計を累積
        for video_stat in video_stats_list:
            video_id = video_stat['video_id']
            appearing_tigers = appearing_tigers_map.get(video_id, [])

            for tiger_id in appearing_tigers:
                if tiger_id not in video_stat['stats']['tiger_stats']:
                    continue

                tiger_data = video_stat['stats']['tiger_stats'][tiger_id]
                period_stats[tiger_id]['total_mentions'] += tiger_data['N_tiger']
                period_stats[tiger_id]['appearance_count'] += 1
                period_stats[tiger_id]['total_rate_total'] += tiger_data['Rate_total']
                period_stats[tiger_id]['total_rate_entity'] += tiger_data['Rate_entity']

        # 平均値を計算
        for tiger_id, stats in period_stats.items():
            if stats['appearance_count'] > 0:
                stats['avg_rate_total'] = stats['total_rate_total'] / stats['appearance_count']
                stats['avg_rate_entity'] = stats['total_rate_entity'] / stats['appearance_count']

        # total_mentionsでソートして順位を付与
        sorted_stats = sorted(
            period_stats.values(),
            key=lambda x: x['total_mentions'],
            reverse=True
        )

        for rank, stat in enumerate(sorted_stats, start=1):
            stat['rank'] = rank

        return {
            'tiger_stats': {s['tiger_id']: s for s in sorted_stats}
        }


# 使用例
if __name__ == '__main__':
    from src.analyzers.comment_analyzer import CommentAnalyzer

    # テストデータ
    test_comments = [
        {'comment_id': '1', 'text': '林社長すごい!', 'video_id': 'test', 'like_count': 100},
        {'comment_id': '2', 'text': '岩井社長と林社長の対決が面白い', 'video_id': 'test', 'like_count': 50},
        {'comment_id': '3', 'text': 'あすかさんのアドバイスが的確', 'video_id': 'test', 'like_count': 30},
        {'comment_id': '4', 'text': '面白かった', 'video_id': 'test', 'like_count': 10},
        {'comment_id': '5', 'text': 'FC林と佐々木社長の掛け合いが最高', 'video_id': 'test', 'like_count': 80},
        {'comment_id': '6', 'text': '岩井社長の意見に賛成', 'video_id': 'test', 'like_count': 40},
    ]

    # コメント解析
    analyzer = CommentAnalyzer()
    appearing_tigers = ['hayashi', 'iwai', 'asuka', 'sasaki']
    analyzed_comments = analyzer.analyze_comments(test_comments, appearing_tigers)

    # 統計集計
    aggregator = StatsAggregator()
    stats = aggregator.calculate_video_stats(analyzed_comments, appearing_tigers)

    print("=== 動画統計 ===")
    print(f"総コメント数 (N_total): {stats['N_total']}")
    print(f"社長言及コメント数 (N_entity): {stats['N_entity']}")
    print()

    print("=== 社長別統計 ===")
    for tiger_id in appearing_tigers:
        tiger_stat = stats['tiger_stats'][tiger_id]
        print(f"第{tiger_stat['rank']}位: {tiger_stat['display_name']}")
        print(f"  言及数: {tiger_stat['N_tiger']}")
        print(f"  Rate_total: {tiger_stat['Rate_total']:.2f}%")
        print(f"  Rate_entity: {tiger_stat['Rate_entity']:.2f}%")
        print()

    # 上位コメント取得
    print("=== 林社長への言及コメント（いいね数順） ===")
    top_comments = aggregator.get_top_mentioned_comments(analyzed_comments, 'hayashi', top_n=3)
    for i, comment in enumerate(top_comments, start=1):
        print(f"{i}. {comment['text']} (いいね: {comment['like_count']})")
