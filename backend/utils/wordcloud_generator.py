"""
ワードクラウド生成モジュール
日本語コメントから頻出単語を可視化
"""
import io
import base64
from typing import List, Dict, Optional
from collections import Counter
import re

# 形態素解析とワードクラウド生成のための簡易実装
# 本番環境では MeCab や janome を使用推奨

class WordCloudGenerator:
    """
    ワードクラウド生成クラス
    日本語テキストから頻出単語を抽出して可視化
    """

    def __init__(self):
        # ストップワード（除外する単語）
        self.stop_words = set([
            # 助詞・助動詞
            "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ",
            "ある", "いる", "も", "する", "から", "な", "こと", "として", "い", "や",
            "など", "なし", "ない", "この", "ため", "その", "あっ", "よう", "また",
            "もの", "という", "あり", "まで", "られ", "なる", "へ", "か", "だ", "これ",
            "によって", "により", "おり", "より", "による", "ず", "なり", "られる",
            "において", "ば", "なっ", "なく", "しかし", "について", "だっ", "その他",
            "それ", "ところ", "もの", "ね", "よ", "わ", "んだ", "です", "ます",
            # 記号・数字
            "、", "。", "！", "？", "「", "」", "（", "）", "・", "ー", "『", "』",
            # URL・メンション
            "http", "https", "www", "com", "jp"
        ])

        # 令和の虎関連の重要キーワード
        self.important_words = set([
            "社長", "投資", "出資", "虎", "令和", "札", "成立", "不成立",
            "ビジネス", "起業", "経営", "会社", "事業", "売上", "利益"
        ])

    def extract_words(self, text: str) -> List[str]:
        """
        テキストから単語を抽出（簡易版）
        本番環境では形態素解析器を使用
        """
        # 前処理
        text = self._preprocess_text(text)

        # 簡易的な単語分割（スペースと句読点で分割）
        # 実際はMeCabやjanomeで形態素解析すべき
        words = []

        # 漢字、ひらがな、カタカナの連続を抽出
        pattern = r'[一-龥ぁ-ゔァ-ヴー々〆〤ヶ]+'
        matches = re.findall(pattern, text)

        for word in matches:
            # 1文字の単語は除外（ただし重要な漢字は残す）
            if len(word) == 1 and word not in ["虎", "札"]:
                continue
            # ストップワードは除外
            if word in self.stop_words:
                continue
            # 長すぎる単語は除外（ノイズの可能性）
            if len(word) > 10:
                continue
            words.append(word)

        return words

    def _preprocess_text(self, text: str) -> str:
        """テキストの前処理"""
        # URLを除去
        text = re.sub(r'https?://[\w/:%#\$&\?\(\)~\.=\+\-]+', '', text)

        # メンションを除去
        text = re.sub(r'@[\w]+', '', text)

        # ハッシュタグは内容を残す
        text = re.sub(r'#', ' ', text)

        # 数字を除去（金額等は残したい場合は要調整）
        text = re.sub(r'\d+', '', text)

        # 絵文字を除去（簡易版）
        text = re.sub(r'[^\u0000-\u007F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]+', '', text)

        return text

    def generate_word_frequency(
        self,
        texts: List[str],
        max_words: int = 100
    ) -> Dict[str, int]:
        """
        複数テキストから単語頻度を生成

        Args:
            texts: テキストのリスト
            max_words: 最大単語数

        Returns:
            単語と頻度の辞書
        """
        all_words = []
        for text in texts:
            words = self.extract_words(text)
            all_words.extend(words)

        # 単語頻度をカウント
        word_freq = Counter(all_words)

        # 重要キーワードはブースト
        for word in self.important_words:
            if word in word_freq:
                word_freq[word] = int(word_freq[word] * 1.5)

        # 上位N個を返す
        return dict(word_freq.most_common(max_words))

    def generate_wordcloud_data(
        self,
        texts: List[str],
        max_words: int = 50
    ) -> Dict:
        """
        ワードクラウド用のデータを生成

        Args:
            texts: テキストのリスト
            max_words: 最大単語数

        Returns:
            ワードクラウド表示用データ
        """
        word_freq = self.generate_word_frequency(texts, max_words)

        if not word_freq:
            return {
                "words": [],
                "error": "単語を抽出できませんでした"
            }

        # 最大頻度で正規化
        max_freq = max(word_freq.values())

        # D3.js等のライブラリ用にデータを整形
        words_data = []
        for word, freq in word_freq.items():
            # サイズを10-100の範囲に正規化
            size = 10 + (freq / max_freq) * 90

            words_data.append({
                "text": word,
                "value": freq,
                "size": size,
                "color": self._get_word_color(word, freq, max_freq)
            })

        return {
            "words": words_data,
            "total_words": len(all_words := [w for text in texts for w in self.extract_words(text)]),
            "unique_words": len(set(all_words))
        }

    def _get_word_color(self, word: str, freq: int, max_freq: int) -> str:
        """
        単語の色を決定

        Args:
            word: 単語
            freq: 頻度
            max_freq: 最大頻度

        Returns:
            色コード（hex）
        """
        # 重要キーワードは赤系
        if word in self.important_words:
            return "#ff4444"

        # 頻度に応じて色を変更
        ratio = freq / max_freq
        if ratio > 0.7:
            return "#ff6b6b"  # 高頻度：赤
        elif ratio > 0.4:
            return "#4ecdc4"  # 中頻度：青緑
        elif ratio > 0.2:
            return "#45b7d1"  # 低頻度：青
        else:
            return "#96a3a3"  # 最低頻度：グレー

    def generate_svg_wordcloud(
        self,
        word_freq: Dict[str, int],
        width: int = 800,
        height: int = 400
    ) -> str:
        """
        シンプルなSVG形式のワードクラウドを生成

        Args:
            word_freq: 単語頻度辞書
            width: 幅
            height: 高さ

        Returns:
            SVG文字列
        """
        import random

        svg = f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">'
        svg += '<rect width="100%" height="100%" fill="white"/>'

        # 単語を配置（簡易版 - ランダム配置）
        max_freq = max(word_freq.values()) if word_freq else 1

        for word, freq in word_freq.items():
            # フォントサイズを計算
            font_size = 12 + (freq / max_freq) * 48

            # ランダムな位置（重なりを考慮しない簡易版）
            x = random.randint(50, width - 100)
            y = random.randint(50, height - 50)

            # 色を決定
            color = self._get_word_color(word, freq, max_freq)

            # テキスト要素を追加
            svg += f'<text x="{x}" y="{y}" font-size="{font_size}" fill="{color}" font-family="sans-serif">{word}</text>'

        svg += '</svg>'
        return svg

    def extract_tiger_mentions(
        self,
        texts: List[str],
        tiger_aliases: Dict[str, List[str]]
    ) -> Dict[str, int]:
        """
        社長への言及を抽出してカウント

        Args:
            texts: テキストのリスト
            tiger_aliases: 社長IDとエイリアスの辞書

        Returns:
            社長IDと言及数の辞書
        """
        tiger_mentions = Counter()

        for text in texts:
            for tiger_id, aliases in tiger_aliases.items():
                for alias in aliases:
                    if alias in text:
                        tiger_mentions[tiger_id] += 1
                        break  # 同じテキストで同じ社長を重複カウントしない

        return dict(tiger_mentions)


# 使用例
if __name__ == "__main__":
    generator = WordCloudGenerator()

    # テストコメント
    test_comments = [
        "林社長の投資判断が素晴らしい！",
        "今回の虎は厳しかったですね",
        "令和の虎で一番好きな社長です",
        "投資額が大きすぎる気がする",
        "ビジネスモデルが面白い",
        "社長の経営方針に共感",
        "虎たちの議論が白熱していた",
        "札が上がるのが早かった"
    ]

    # 単語頻度を生成
    word_freq = generator.generate_word_frequency(test_comments)
    print("単語頻度:", word_freq)

    # ワードクラウドデータを生成
    wordcloud_data = generator.generate_wordcloud_data(test_comments)
    print("ワードクラウドデータ:", wordcloud_data)