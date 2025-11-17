"""
感情分析モジュール
日本語コメントのポジティブ・ネガティブ・ニュートラル判定
"""
import re
from typing import Dict, List, Tuple
from dataclasses import dataclass

@dataclass
class SentimentResult:
    """感情分析結果"""
    sentiment: str  # positive, negative, neutral
    score: float  # 確信度（0.0 - 1.0）
    positive_score: float
    negative_score: float
    neutral_score: float

class SentimentAnalyzer:
    """
    ルールベースの日本語感情分析器
    将来的にLLMやBERTモデルに置き換え可能
    """

    def __init__(self):
        # ポジティブワード辞書
        self.positive_words = [
            # 称賛
            "すごい", "素晴らしい", "最高", "神", "かっこいい", "イケメン",
            "流石", "さすが", "感動", "感心", "尊敬", "憧れ",
            # 支持
            "応援", "頑張", "支持", "賛成", "いいね", "好き", "推し",
            # 評価
            "面白い", "楽しい", "嬉しい", "良い", "よい", "いい",
            "正しい", "素敵", "綺麗", "美しい", "格好いい",
            # 成功
            "成功", "達成", "勝利", "優勝", "合格", "昇進",
            # 感嘆
            "やばい", "ヤバい", "エモい", "えぐい", "激アツ",
            # 令和の虎特有
            "投資", "出資", "札", "虎", "成立", "決定"
        ]

        # ネガティブワード辞書
        self.negative_words = [
            # 批判
            "ダメ", "だめ", "悪い", "最悪", "ひどい", "酷い", "ゴミ",
            "クソ", "くそ", "糞", "無理", "無駄", "意味ない",
            # 否定
            "嫌い", "きらい", "嫌", "つまらない", "面白くない",
            "ダサい", "ださい", "微妙", "イマイチ", "いまいち",
            # 失敗
            "失敗", "失望", "がっかり", "ガッカリ", "残念",
            "負け", "敗北", "挫折", "諦め",
            # 不満
            "うざい", "ウザい", "邪魔", "迷惑", "困る",
            "イライラ", "ムカつく", "腹立つ",
            # 令和の虎特有
            "不成立", "撤退", "辞退", "降り", "見送り"
        ]

        # 強調表現
        self.intensifiers = ["とても", "すごく", "めっちゃ", "超", "激", "マジ", "ガチ", "本当に", "ほんとに"]

        # 否定表現
        self.negations = ["ない", "ません", "なかった", "じゃない", "ではない"]

    def analyze(self, text: str) -> SentimentResult:
        """
        テキストの感情を分析

        Args:
            text: 分析対象のテキスト

        Returns:
            感情分析結果
        """
        # テキストの前処理
        text = self._preprocess(text)

        # スコア計算
        positive_score = self._calculate_positive_score(text)
        negative_score = self._calculate_negative_score(text)

        # 正規化
        total = positive_score + negative_score
        if total > 0:
            positive_score = positive_score / total
            negative_score = negative_score / total
        else:
            positive_score = 0.5
            negative_score = 0.5

        # ニュートラル判定のしきい値
        neutral_threshold = 0.2

        # 感情の判定
        if abs(positive_score - negative_score) < neutral_threshold:
            sentiment = "neutral"
            neutral_score = 1.0 - abs(positive_score - negative_score)
        elif positive_score > negative_score:
            sentiment = "positive"
            neutral_score = 0.0
        else:
            sentiment = "negative"
            neutral_score = 0.0

        # 確信度の計算
        score = max(positive_score, negative_score, neutral_score)

        return SentimentResult(
            sentiment=sentiment,
            score=score,
            positive_score=positive_score,
            negative_score=negative_score,
            neutral_score=neutral_score
        )

    def _preprocess(self, text: str) -> str:
        """テキストの前処理"""
        # 小文字化（英語部分のみ）
        text = text.lower()

        # 絵文字の簡単な処理（より詳細な処理は別途実装可能）
        # ポジティブ絵文字
        positive_emojis = ["😊", "😄", "😃", "😀", "🥰", "😍", "❤️", "♥️", "👍", "✨", "🎉", "🔥"]
        for emoji in positive_emojis:
            if emoji in text:
                text += " すごい "  # ポジティブワードを追加

        # ネガティブ絵文字
        negative_emojis = ["😢", "😭", "😞", "😔", "😠", "😡", "💔", "👎", "😱", "😨"]
        for emoji in negative_emojis:
            if emoji in text:
                text += " 残念 "  # ネガティブワードを追加

        return text

    def _calculate_positive_score(self, text: str) -> float:
        """ポジティブスコアの計算"""
        score = 0.0

        for word in self.positive_words:
            if word in text:
                # 基本スコア
                base_score = 1.0

                # 強調表現があれば増幅
                for intensifier in self.intensifiers:
                    if intensifier + word in text:
                        base_score *= 1.5
                        break

                # 否定表現があれば反転
                for negation in self.negations:
                    if word + negation in text:
                        base_score *= -0.5
                        break

                score += base_score

        # 文字「！」の数に応じて微調整
        score += text.count("！") * 0.1
        score += text.count("!") * 0.1

        return max(0.0, score)

    def _calculate_negative_score(self, text: str) -> float:
        """ネガティブスコアの計算"""
        score = 0.0

        for word in self.negative_words:
            if word in text:
                # 基本スコア
                base_score = 1.0

                # 強調表現があれば増幅
                for intensifier in self.intensifiers:
                    if intensifier + word in text:
                        base_score *= 1.5
                        break

                # 否定表現があれば反転（二重否定）
                for negation in self.negations:
                    if word + negation in text:
                        base_score *= -0.5
                        break

                score += base_score

        # 文字「？」が多い場合は疑問・批判的な可能性
        score += text.count("？") * 0.05
        score += text.count("?") * 0.05

        return max(0.0, score)

    def analyze_batch(self, texts: List[str]) -> List[SentimentResult]:
        """
        複数テキストの一括分析

        Args:
            texts: 分析対象のテキストリスト

        Returns:
            感情分析結果のリスト
        """
        return [self.analyze(text) for text in texts]

    def get_summary_stats(self, results: List[SentimentResult]) -> Dict:
        """
        分析結果の統計サマリー

        Args:
            results: 感情分析結果のリスト

        Returns:
            統計情報の辞書
        """
        if not results:
            return {
                "total": 0,
                "positive": 0,
                "negative": 0,
                "neutral": 0,
                "positive_ratio": 0.0,
                "negative_ratio": 0.0,
                "neutral_ratio": 0.0,
                "average_confidence": 0.0
            }

        total = len(results)
        positive = sum(1 for r in results if r.sentiment == "positive")
        negative = sum(1 for r in results if r.sentiment == "negative")
        neutral = sum(1 for r in results if r.sentiment == "neutral")

        return {
            "total": total,
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "positive_ratio": positive / total,
            "negative_ratio": negative / total,
            "neutral_ratio": neutral / total,
            "average_confidence": sum(r.score for r in results) / total
        }


# 使用例
if __name__ == "__main__":
    analyzer = SentimentAnalyzer()

    # テストコメント
    test_comments = [
        "林社長すごい！最高です！",
        "今回は微妙だったなぁ...",
        "普通のコメント",
        "めっちゃ面白い！応援してます！",
        "つまらない。もう見ない",
        "岩井社長かっこいい！！！"
    ]

    for comment in test_comments:
        result = analyzer.analyze(comment)
        print(f"コメント: {comment}")
        print(f"  感情: {result.sentiment} (確信度: {result.score:.2f})")
        print(f"  詳細: Pos={result.positive_score:.2f}, Neg={result.negative_score:.2f}, Neu={result.neutral_score:.2f}")
        print()