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

        # HTML生成（見やすいUI）
        html = f"""
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self.config.title}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, sans-serif;
            line-height: 1.8;
            color: #2d3748;
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 900px;
            margin: 0 auto;
        }}
        .header {{
            background: linear-gradient(135deg, #4c51bf 0%, #6b46c1 100%);
            color: white;
            padding: 40px;
            border-radius: 16px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(107, 70, 193, 0.3);
        }}
        h1 {{
            font-size: 1.75em;
            font-weight: 700;
            margin-bottom: 8px;
        }}
        .subtitle {{
            opacity: 0.9;
            font-size: 0.95em;
        }}
        .card {{
            background: white;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }}
        h2 {{
            font-size: 1.1em;
            font-weight: 700;
            color: #4a5568;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        h2::before {{
            content: '';
            display: inline-block;
            width: 4px;
            height: 20px;
            background: linear-gradient(135deg, #4c51bf 0%, #6b46c1 100%);
            border-radius: 2px;
        }}
        .metrics {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
        }}
        .metric-card {{
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            transition: transform 0.2s;
        }}
        .metric-card:hover {{
            transform: translateY(-2px);
        }}
        .metric-value {{
            font-size: 2em;
            font-weight: 700;
            color: #4c51bf;
            line-height: 1.2;
        }}
        .metric-label {{
            font-size: 0.85em;
            color: #718096;
            margin-top: 6px;
            font-weight: 500;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        th {{
            font-weight: 600;
            font-size: 0.75em;
            color: #a0aec0;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            padding: 12px 16px;
            text-align: left;
            border-bottom: 2px solid #edf2f7;
        }}
        td {{
            padding: 16px;
            border-bottom: 1px solid #f7fafc;
            font-size: 0.95em;
        }}
        tr:hover {{
            background: #f7fafc;
        }}
        tr:last-child td {{
            border-bottom: none;
        }}
        .rank {{
            font-weight: 700;
            width: 50px;
            text-align: center;
        }}
        .rank-1 {{
            background: linear-gradient(135deg, #f6e05e 0%, #ecc94b 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 1.2em;
        }}
        .rank-2 {{
            color: #a0aec0;
            font-size: 1.1em;
        }}
        .rank-3 {{
            color: #c67d4e;
            font-size: 1.05em;
        }}
        .name {{
            font-weight: 600;
            color: #2d3748;
        }}
        .number {{
            font-variant-numeric: tabular-nums;
            color: #4a5568;
            font-weight: 500;
        }}
        .chart {{
            margin: 20px 0;
            text-align: center;
        }}
        .chart img {{
            max-width: 100%;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }}
        .analysis {{
            color: #4a5568;
            font-size: 1em;
            line-height: 2;
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #4c51bf;
        }}
        .footer {{
            text-align: center;
            color: #a0aec0;
            font-size: 0.85em;
            margin-top: 40px;
            padding: 20px;
        }}
        @media (max-width: 700px) {{
            .metrics {{ grid-template-columns: repeat(2, 1fr); }}
            .metric-value {{ font-size: 1.5em; }}
            .header {{ padding: 30px 20px; }}
            h1 {{ font-size: 1.4em; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{self.config.title}</h1>
            <div class="subtitle">{datetime.now().strftime('%Y年%m月%d日')} | {data.get('period', self.config.period)}</div>
        </div>

        <div class="card">
            <h2>概要</h2>
            <div class="metrics">
                <div class="metric-card">
                    <div class="metric-value">{data.get('total_videos', 0)}</div>
                    <div class="metric-label">分析動画数</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">{data.get('total_comments', 0):,}</div>
                    <div class="metric-label">総コメント</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">{data.get('tiger_mentions', 0):,}</div>
                    <div class="metric-label">社長言及</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">{data.get('mention_rate', 0):.1f}%</div>
                    <div class="metric-label">言及率</div>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>社長ランキング</h2>
            {self._generate_ranking_table_html(data.get('tiger_rankings', []))}
        </div>

        {self._generate_charts_html(charts) if charts else ''}

        <div class="card">
            <h2>分析サマリー</h2>
            <p class="analysis">{self._generate_trend_analysis(data)}</p>
        </div>

        <div class="footer">
            令和の虎 コメント分析システム
        </div>
    </div>
</body>
</html>
        """

        return html.encode('utf-8')

    def _generate_ranking_table_html(self, rankings: List[Dict]) -> str:
        """ランキングテーブルのHTML生成"""
        if not rankings:
            return "<p style='color: #718096; text-align: center; padding: 40px;'>データがありません</p>"

        html = """
        <table>
            <thead>
                <tr>
                    <th style="width: 60px;">順位</th>
                    <th>社長名</th>
                    <th style="text-align: right;">言及数</th>
                    <th style="text-align: right;">言及率</th>
                </tr>
            </thead>
            <tbody>
        """

        for i, tiger in enumerate(rankings[:self.config.max_tigers], 1):
            rank_class = f"rank-{i}" if i <= 3 else ""
            rank_display = ["🥇", "🥈", "🥉"][i-1] if i <= 3 else str(i)

            html += f"""
                <tr>
                    <td class="rank {rank_class}">{rank_display}</td>
                    <td class="name">{tiger.get('display_name', 'Unknown')}</td>
                    <td class="number" style="text-align: right;">{tiger.get('total_mentions', 0):,}</td>
                    <td class="number" style="text-align: right;">{tiger.get('avg_rate_total', 0):.1f}%</td>
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
        fig, ax = plt.subplots(figsize=(8, 5))
        fig.patch.set_facecolor('white')
        ax.set_facecolor('white')

        tigers = [r['display_name'][:8] for r in rankings[:8]]
        mentions = [r['total_mentions'] for r in rankings[:8]]

        # 紫のグラデーション
        colors = ['#4c51bf', '#5a5fc4', '#6b6ecb', '#7b7dd2', '#8c8dd9', '#9d9ee0', '#aeafe7', '#bfc0ee']
        bars = ax.barh(tigers, mentions, color=colors[:len(tigers)], height=0.6)
        ax.invert_yaxis()

        # スタイリング
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_visible(False)
        ax.spines['bottom'].set_color('#edf2f7')
        ax.tick_params(left=False, bottom=True, colors='#4a5568')
        ax.xaxis.set_tick_params(color='#edf2f7')

        for i, (bar, value) in enumerate(zip(bars, mentions)):
            ax.text(value + max(mentions)*0.02, bar.get_y() + bar.get_height()/2,
                   f'{value:,}', ha='left', va='center', fontsize=9, color='#4a5568', fontweight='500')

        plt.tight_layout()

        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=150, facecolor='white', edgecolor='none')
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()

        return f"data:image/png;base64,{img_base64}"

    def _create_sentiment_pie_chart(self, sentiment: Dict) -> str:
        """感情分析円グラフを作成"""
        fig, ax = plt.subplots(figsize=(6, 6))
        fig.patch.set_facecolor('white')

        labels = ['ポジティブ', 'ネガティブ', 'ニュートラル']
        sizes = [
            sentiment.get('positive', 0),
            sentiment.get('negative', 0),
            sentiment.get('neutral', 0)
        ]
        colors = ['#48bb78', '#fc8181', '#a0aec0']

        wedges, texts, autotexts = ax.pie(
            sizes, labels=labels, colors=colors,
            autopct='%1.0f%%', startangle=90,
            textprops={'fontsize': 10, 'color': '#4a5568'}
        )
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontsize(10)
            autotext.set_fontweight('bold')

        plt.tight_layout()

        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=150, facecolor='white', edgecolor='none')
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()

        return f"data:image/png;base64,{img_base64}"

    def _create_trend_line_chart(self, trend_data: List[Dict]) -> str:
        """トレンドライングラフを作成"""
        fig, ax = plt.subplots(figsize=(8, 4))
        fig.patch.set_facecolor('white')
        ax.set_facecolor('white')

        dates = [d['date'] for d in trend_data]
        values = [d['value'] for d in trend_data]

        ax.plot(dates, values, marker='o', linestyle='-', linewidth=2, markersize=6, color='#4c51bf')
        ax.fill_between(dates, values, alpha=0.1, color='#4c51bf')

        # スタイリング
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#edf2f7')
        ax.spines['bottom'].set_color('#edf2f7')
        ax.tick_params(colors='#4a5568')
        ax.grid(True, alpha=0.3, color='#edf2f7')

        plt.xticks(rotation=45, ha='right', fontsize=8)
        plt.tight_layout()

        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=150, facecolor='white', edgecolor='none')
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()

        return f"data:image/png;base64,{img_base64}"

    def _generate_charts_html(self, charts: Dict[str, str]) -> str:
        """チャートセクションのHTML生成"""
        html = '<div class="card"><h2>グラフ</h2>'

        for chart_name, chart_data in charts.items():
            html += f'<div class="chart"><img src="{chart_data}" alt="{chart_name}"></div>'

        html += '</div>'
        return html

    def _generate_trend_analysis(self, data: Dict) -> str:
        """トレンド分析の文章生成"""
        analysis = []

        # トップ社長の分析
        if 'tiger_rankings' in data and data['tiger_rankings']:
            rankings = data['tiger_rankings']
            if len(rankings) >= 1:
                top_tiger = rankings[0]
                analysis.append(
                    f"最も注目を集めたのは{top_tiger['display_name']}で、"
                    f"合計{top_tiger['total_mentions']:,}回の言及がありました。"
                )
            if len(rankings) >= 3:
                top3 = [r['display_name'] for r in rankings[:3]]
                analysis.append(
                    f"トップ3は{top3[0]}、{top3[1]}、{top3[2]}でした。"
                )

        # 言及率の分析
        mention_rate = data.get('mention_rate', 0)
        if mention_rate > 20:
            analysis.append("社長への言及率が高く、視聴者の関心が高いことがわかります。")
        elif mention_rate > 10:
            analysis.append("社長への言及率は平均的な水準です。")

        return " ".join(analysis) or "分析データが不足しています。"

    def _generate_markdown_report(self, data: Dict[str, Any]) -> bytes:
        """
        Markdownレポートを生成
        """
        md = f"""# {self.config.title}

生成日時: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}
期間: {data.get('period', self.config.period)}

## 概要

| メトリクス | 値 |
|-----------|-----|
| 分析動画数 | {data.get('total_videos', 0)} |
| 総コメント数 | {data.get('total_comments', 0):,} |
| 社長言及数 | {data.get('tiger_mentions', 0):,} |
| 言及率 | {data.get('mention_rate', 0):.1f}% |

## 社長ランキング

| 順位 | 社長名 | 言及数 | 言及率 |
|------|--------|--------|--------|
"""

        # ランキングデータを追加
        for i, tiger in enumerate(data.get('tiger_rankings', [])[:self.config.max_tigers], 1):
            md += f"| {i} | {tiger['display_name']} | {tiger['total_mentions']:,} | "
            md += f"{tiger['avg_rate_total']:.1f}% |\n"

        md += f"""

## 分析サマリー

{self._generate_trend_analysis(data)}

---

*このレポートは令和の虎コメント分析システムによって自動生成されました*
"""

        return md.encode('utf-8')