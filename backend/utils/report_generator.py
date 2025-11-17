"""
自動レポート生成モジュール
PDF形式での定期レポート自動生成
"""
import io
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import matplotlib
matplotlib.use('Agg')  # GUIバックエンドを使用しない
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from matplotlib.figure import Figure
import numpy as np

# 日本語フォントの設定
try:
    # システムに日本語フォントがある場合
    prop = fm.FontProperties(fname='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc')
    plt.rcParams['font.family'] = prop.get_name()
except:
    # フォントが見つからない場合はデフォルト
    plt.rcParams['font.family'] = 'sans-serif'

@dataclass
class ReportConfig:
    """レポート生成設定"""
    title: str = "令和の虎 コメント分析レポート"
    period: str = "monthly"  # daily, weekly, monthly, quarterly
    include_charts: bool = True
    include_details: bool = True
    include_sentiment: bool = True
    include_wordcloud: bool = False
    max_tigers: int = 10
    max_videos: int = 20


class ReportGenerator:
    """
    定期レポート生成クラス
    """

    def __init__(self, config: ReportConfig = None):
        self.config = config or ReportConfig()

    def generate_report(
        self,
        stats_data: Dict[str, Any],
        output_format: str = "html"
    ) -> bytes:
        """
        レポートを生成

        Args:
            stats_data: 統計データ
            output_format: 出力形式（html, pdf, markdown）

        Returns:
            レポートのバイナリデータ
        """
        if output_format == "html":
            return self._generate_html_report(stats_data)
        elif output_format == "markdown":
            return self._generate_markdown_report(stats_data)
        else:
            raise ValueError(f"Unsupported format: {output_format}")

    def _generate_html_report(self, data: Dict[str, Any]) -> bytes:
        """
        HTMLレポートを生成
        """
        # チャートを生成
        charts = {}
        if self.config.include_charts:
            charts = self._generate_charts(data)

        # HTML生成
        html = f"""
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self.config.title}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        h1 {{
            margin: 0;
            font-size: 2.5em;
        }}
        .subtitle {{
            opacity: 0.9;
            margin-top: 10px;
        }}
        .section {{
            background: white;
            padding: 25px;
            margin-bottom: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h2 {{
            color: #667eea;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }}
        .metrics {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }}
        .metric-card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}
        .metric-value {{
            font-size: 2.5em;
            font-weight: bold;
            margin: 10px 0;
        }}
        .metric-label {{
            opacity: 0.9;
            font-size: 0.9em;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th {{
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
        }}
        td {{
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }}
        tr:hover {{
            background: #f5f5f5;
        }}
        .chart {{
            margin: 20px 0;
            text-align: center;
        }}
        .chart img {{
            max-width: 100%;
            border-radius: 8px;
        }}
        .rank-badge {{
            display: inline-block;
            width: 30px;
            height: 30px;
            line-height: 30px;
            text-align: center;
            border-radius: 50%;
            font-weight: bold;
            margin-right: 10px;
        }}
        .rank-1 {{ background: gold; color: #333; }}
        .rank-2 {{ background: silver; color: #333; }}
        .rank-3 {{ background: #cd7f32; color: white; }}
        .rank-other {{ background: #667eea; color: white; }}
        .positive {{ color: #10b981; }}
        .negative {{ color: #ef4444; }}
        .neutral {{ color: #6b7280; }}
        .footer {{
            text-align: center;
            color: #666;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{self.config.title}</h1>
        <div class="subtitle">
            生成日時: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}
            | 期間: {data.get('period', self.config.period)}
        </div>
    </div>

    <div class="section">
        <h2>📊 概要メトリクス</h2>
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-label">分析動画数</div>
                <div class="metric-value">{data.get('total_videos', 0)}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">総コメント数</div>
                <div class="metric-value">{data.get('total_comments', 0):,}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">社長言及率</div>
                <div class="metric-value">{data.get('mention_rate', 0):.1f}%</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">ポジティブ率</div>
                <div class="metric-value">{data.get('positive_rate', 0):.1f}%</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🏆 社長ランキング</h2>
        {self._generate_ranking_table_html(data.get('tiger_rankings', []))}
    </div>

    {self._generate_charts_html(charts) if charts else ''}

    <div class="section">
        <h2>📈 トレンド分析</h2>
        <p>{self._generate_trend_analysis(data)}</p>
    </div>

    <div class="footer">
        <p>© 2025 令和の虎 コメント分析システム</p>
        <p>このレポートは自動生成されました</p>
    </div>
</body>
</html>
        """

        return html.encode('utf-8')

    def _generate_ranking_table_html(self, rankings: List[Dict]) -> str:
        """ランキングテーブルのHTML生成"""
        if not rankings:
            return "<p>データがありません</p>"

        html = """
        <table>
            <thead>
                <tr>
                    <th>順位</th>
                    <th>社長名</th>
                    <th>総言及数</th>
                    <th>Rate_total</th>
                    <th>Rate_entity</th>
                    <th>感情スコア</th>
                </tr>
            </thead>
            <tbody>
        """

        for i, tiger in enumerate(rankings[:self.config.max_tigers], 1):
            rank_class = f"rank-{i}" if i <= 3 else "rank-other"
            sentiment_score = tiger.get('sentiment_score', 0)
            sentiment_class = "positive" if sentiment_score > 0 else "negative" if sentiment_score < 0 else "neutral"

            html += f"""
                <tr>
                    <td><span class="rank-badge {rank_class}">{i}</span></td>
                    <td><strong>{tiger.get('display_name', 'Unknown')}</strong></td>
                    <td>{tiger.get('total_mentions', 0):,}</td>
                    <td>{tiger.get('avg_rate_total', 0):.2f}%</td>
                    <td>{tiger.get('avg_rate_entity', 0):.2f}%</td>
                    <td class="{sentiment_class}">{sentiment_score:+.2f}</td>
                </tr>
            """

        html += """
            </tbody>
        </table>
        """

        return html

    def _generate_charts(self, data: Dict[str, Any]) -> Dict[str, str]:
        """チャートを生成してBase64エンコード"""
        charts = {}

        # 社長ランキング棒グラフ
        if 'tiger_rankings' in data:
            charts['ranking_bar'] = self._create_ranking_bar_chart(data['tiger_rankings'])

        # 感情分析円グラフ
        if self.config.include_sentiment and 'sentiment_summary' in data:
            charts['sentiment_pie'] = self._create_sentiment_pie_chart(data['sentiment_summary'])

        # トレンドライングラフ
        if 'trend_data' in data:
            charts['trend_line'] = self._create_trend_line_chart(data['trend_data'])

        return charts

    def _create_ranking_bar_chart(self, rankings: List[Dict]) -> str:
        """ランキング棒グラフを作成"""
        fig, ax = plt.subplots(figsize=(10, 6))

        tigers = [r['display_name'][:10] for r in rankings[:10]]  # 上位10名
        mentions = [r['total_mentions'] for r in rankings[:10]]

        bars = ax.barh(tigers, mentions, color='#667eea')
        ax.set_xlabel('言及数')
        ax.set_title('社長別言及数ランキング')
        ax.invert_yaxis()  # 上位が上に来るように

        # 値をバーの右に表示
        for i, (bar, value) in enumerate(zip(bars, mentions)):
            ax.text(value, bar.get_y() + bar.get_height()/2,
                   f'{value:,}', ha='left', va='center')

        plt.tight_layout()

        # Base64エンコード
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=100)
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()

        return f"data:image/png;base64,{img_base64}"

    def _create_sentiment_pie_chart(self, sentiment: Dict) -> str:
        """感情分析円グラフを作成"""
        fig, ax = plt.subplots(figsize=(8, 6))

        labels = ['ポジティブ', 'ネガティブ', 'ニュートラル']
        sizes = [
            sentiment.get('positive', 0),
            sentiment.get('negative', 0),
            sentiment.get('neutral', 0)
        ]
        colors = ['#10b981', '#ef4444', '#6b7280']

        ax.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
        ax.set_title('コメントの感情分析')

        plt.tight_layout()

        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=100)
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()

        return f"data:image/png;base64,{img_base64}"

    def _create_trend_line_chart(self, trend_data: List[Dict]) -> str:
        """トレンドライングラフを作成"""
        fig, ax = plt.subplots(figsize=(12, 6))

        dates = [d['date'] for d in trend_data]
        values = [d['value'] for d in trend_data]

        ax.plot(dates, values, marker='o', linestyle='-', linewidth=2, markersize=6, color='#667eea')
        ax.set_xlabel('日付')
        ax.set_ylabel('言及数')
        ax.set_title('言及数の推移')
        ax.grid(True, alpha=0.3)

        # X軸のラベルを回転
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()

        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=100)
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()

        return f"data:image/png;base64,{img_base64}"

    def _generate_charts_html(self, charts: Dict[str, str]) -> str:
        """チャートセクションのHTML生成"""
        html = '<div class="section"><h2>📊 グラフ分析</h2><div class="charts">'

        for chart_name, chart_data in charts.items():
            html += f'<div class="chart"><img src="{chart_data}" alt="{chart_name}"></div>'

        html += '</div></div>'
        return html

    def _generate_trend_analysis(self, data: Dict) -> str:
        """トレンド分析の文章生成"""
        analysis = []

        # トップ社長の分析
        if 'tiger_rankings' in data and data['tiger_rankings']:
            top_tiger = data['tiger_rankings'][0]
            analysis.append(
                f"最も注目を集めたのは{top_tiger['display_name']}で、"
                f"合計{top_tiger['total_mentions']:,}回の言及がありました。"
            )

        # 感情分析
        if 'sentiment_summary' in data:
            sentiment = data['sentiment_summary']
            positive_rate = sentiment.get('positive_ratio', 0)
            if positive_rate > 60:
                analysis.append("全体的に非常にポジティブな反応が見られました。")
            elif positive_rate > 40:
                analysis.append("バランスの取れた反応が見られました。")
            else:
                analysis.append("批判的な意見が多く見られました。")

        return " ".join(analysis) or "分析データが不足しています。"

    def _generate_markdown_report(self, data: Dict[str, Any]) -> bytes:
        """
        Markdownレポートを生成
        """
        md = f"""# {self.config.title}

生成日時: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}
期間: {data.get('period', self.config.period)}

## 📊 概要メトリクス

| メトリクス | 値 |
|-----------|-----|
| 分析動画数 | {data.get('total_videos', 0)} |
| 総コメント数 | {data.get('total_comments', 0):,} |
| 社長言及率 | {data.get('mention_rate', 0):.1f}% |
| ポジティブ率 | {data.get('positive_rate', 0):.1f}% |

## 🏆 社長ランキング

| 順位 | 社長名 | 総言及数 | Rate_total | Rate_entity |
|------|--------|----------|------------|-------------|
"""

        # ランキングデータを追加
        for i, tiger in enumerate(data.get('tiger_rankings', [])[:self.config.max_tigers], 1):
            md += f"| {i} | {tiger['display_name']} | {tiger['total_mentions']:,} | "
            md += f"{tiger['avg_rate_total']:.2f}% | {tiger['avg_rate_entity']:.2f}% |\n"

        md += f"""

## 📈 トレンド分析

{self._generate_trend_analysis(data)}

---

*このレポートは令和の虎コメント分析システムによって自動生成されました*
"""

        return md.encode('utf-8')