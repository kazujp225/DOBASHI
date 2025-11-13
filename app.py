"""
令和の虎 社長別コメント言及分析システム
Streamlit Web UI - Enhanced Version
"""
import streamlit as st
import json
import os
from datetime import datetime
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from src.collectors.youtube_collector import YouTubeCollector
from src.analyzers.comment_analyzer import CommentAnalyzer
from src.aggregators.stats_aggregator import StatsAggregator
from src.managers.tiger_manager import TigerManager
from src.utils.ui_components import (
    apply_custom_css,
    create_metric_card,
    create_progress_indicator,
    create_info_card,
    create_status_badge,
    create_empty_state,
    create_statistic_row,
    create_loading_spinner,
    icon,
    create_stat_card
)


# ページ設定
st.set_page_config(
    page_title="令和の虎 コメント分析システム",
    page_icon="🐯",
    layout="wide",
    initial_sidebar_state="expanded"
)

# カスタムCSSを適用
apply_custom_css()


def load_tigers():
    """社長マスタを読み込み"""
    with open('data/tigers.json', 'r', encoding='utf-8') as f:
        tigers = json.load(f)
    return {t['tiger_id']: t for t in tigers}


def save_data(data, filename):
    """データをJSONファイルに保存"""
    os.makedirs('data/cache', exist_ok=True)
    filepath = f'data/cache/{filename}'
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return filepath


def load_data(filename):
    """JSONファイルからデータを読み込み"""
    filepath = f'data/cache/{filename}'
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def main():
    # ヘッダー
    col1, col2 = st.columns([3, 1])
    with col1:
        st.markdown(f"""
        <h1 style="display: flex; align-items: center; gap: 0.5rem;">
            {icon('paw', size='lg', color='#F59E0B')} 令和の虎 コメント分析システム
        </h1>
        """, unsafe_allow_html=True)
        st.caption("YouTube コメントから社長の人気度を可視化")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button(f"{icon('book', size='sm')} ヘルプ", use_container_width=True):
            show_help_dialog()

    st.markdown("---")

    # サイドバー
    with st.sidebar:
        # ロゴ・アプリ情報
        st.markdown(f"""
        <div style="text-align: center; padding: 1rem 0;">
            <div style="font-size: 3rem; margin: 0;">{icon('paw', size='2xl', color='#F59E0B')}</div>
            <h3 style="margin: 0.5rem 0;">令和の虎</h3>
            <p style="color: #7f8c8d; font-size: 0.9rem;">コメント分析システム</p>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("---")

        # ナビゲーション
        st.markdown(f"<h4>{icon('bars', size='sm')} ナビゲーション</h4>", unsafe_allow_html=True)

        pages = {
            "chart-line": {
                "icon": "chart-line",
                "name": "ダッシュボード",
                "description": "分析結果の概要"
            },
            "magnifying-glass": {
                "icon": "magnifying-glass",
                "name": "動画分析",
                "description": "コメントを詳細分析"
            },
            "download": {
                "icon": "download",
                "name": "データ収集",
                "description": "YouTubeから収集"
            },
            "users": {
                "icon": "users",
                "name": "社長マスタ",
                "description": "社長情報を管理"
            }
        }

        page = st.radio(
            "ページを選択",
            list(pages.keys()),
            format_func=lambda x: f"{icon(pages[x]['icon'], size='sm')} {pages[x]['name']}",
            label_visibility="collapsed"
        )

        # 選択されたページの説明
        st.markdown(f"""
        <div class="info-box" style="background: #E0F2FE; padding: 0.75rem; border-radius: 8px; border-left: 4px solid #0284C7;">
            {icon('lightbulb', size='sm', color='#0284C7')} {pages[page]['description']}
        </div>
        """, unsafe_allow_html=True)

        st.markdown("---")

        # クイックスタッツ
        tigers = load_tigers()
        st.markdown(f"<h4>{icon('chart-simple', size='sm')} クイックスタッツ</h4>", unsafe_allow_html=True)
        st.metric(label=f"{icon('user-tie', size='sm')} 登録社長数", value=f"{len(tigers)}名")

        # キャッシュファイルの数
        cache_dir = 'data/cache'
        if os.path.exists(cache_dir):
            cache_files = len([f for f in os.listdir(cache_dir) if f.endswith('.json')])
            st.metric(label=f"{icon('database', size='sm')} 収集データ数", value=f"{cache_files}件")
        else:
            st.metric(label=f"{icon('database', size='sm')} 収集データ数", value="0件")

        st.markdown("---")

        # フッター
        st.markdown(f"""
        <div style="text-align: center; padding: 1rem 0; color: #7f8c8d; font-size: 0.8rem;">
            <p>{icon('code-branch', size='xs', color='#7f8c8d')} Version 2.0</p>
            <p>© 2025 令和の虎分析</p>
        </div>
        """, unsafe_allow_html=True)

    # ページ振り分け
    if page == "chart-line":
        show_dashboard(tigers)
    elif page == "magnifying-glass":
        show_video_analysis(tigers)
    elif page == "download":
        show_data_collection()
    elif page == "users":
        show_tiger_master(tigers)


def show_help_dialog():
    """ヘルプダイアログを表示"""
    with st.expander(f"{icon('book-open', size='sm')} 使い方ガイド", expanded=True):
        st.markdown(f"""
        ### {icon('rocket', size='sm')} クイックスタート

        1. **{icon('download', size='sm')} データ収集**: YouTube動画からコメントを収集
        2. **{icon('magnifying-glass', size='sm')} 動画分析**: 収集したコメントを分析
        3. **{icon('chart-line', size='sm')} ダッシュボード**: 分析結果を確認
        4. **{icon('users', size='sm')} 社長マスタ**: 社長情報を管理

        ### {icon('book', size='sm')} 詳細ドキュメント

        - [README.md](https://github.com/your-repo) - 全体概要
        - [USAGE.md](https://github.com/your-repo) - 詳細な使い方
        - [GUIDE_TIGER_REGISTRATION.md](https://github.com/your-repo) - 社長登録ガイド

        ### {icon('lightbulb', size='sm')} Tips

        - デモ分析はAPIキー不要で試せます
        - 社長マスタは Web UI から簡単に編集できます
        - エイリアス（呼称）を充実させると精度が向上します
        """, unsafe_allow_html=True)


def show_dashboard(tigers):
    """ダッシュボードページ（改善版）"""
    st.markdown(f"<h2>{icon('chart-line', size='md')} ダッシュボード</h2>", unsafe_allow_html=True)

    # キャッシュされたデータを確認
    cache_dir = 'data/cache'
    cached_files = []
    if os.path.exists(cache_dir):
        cached_files = [f for f in os.listdir(cache_dir) if f.startswith('analysis_')]

    if not cached_files:
        # 空の状態
        create_empty_state(
            icon_name="chart-line",
            title="まだ分析データがありません",
            description="「データ収集」ページでYouTube動画からコメントを収集し、\n「動画分析」ページで分析を実行してください。",
            action_text=f"{icon('arrow-right', size='sm')} サイドバーから「データ収集」を選択してスタート！"
        )

        # クイックガイド
        st.markdown(f"### {icon('rocket', size='sm')} はじめ方", unsafe_allow_html=True)
        cols = st.columns(4)

        with cols[0]:
            create_info_card(
                "ステップ1",
                "社長マスタを確認・編集",
                icon_name="users",
                color="#9b59b6"
            )

        with cols[1]:
            create_info_card(
                "ステップ2",
                "YouTubeから\nコメントを収集",
                icon_name="download",
                color="#3498db"
            )

        with cols[2]:
            create_info_card(
                "ステップ3",
                "コメントを\n分析",
                icon_name="magnifying-glass",
                color="#e74c3c"
            )

        with cols[3]:
            create_info_card(
                "ステップ4",
                "結果を\n確認",
                icon_name="chart-line",
                color="#2ecc71"
            )

        return

    # データがある場合
    st.markdown(f"""
    <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        {icon('circle-check', size='sm', color='#10B981')} {len(cached_files)}件の分析済みデータがあります
    </div>
    """, unsafe_allow_html=True)

    # 統計サマリー
    total_comments = 0
    total_mentions = 0
    all_tiger_stats = {}

    for filename in cached_files:
        data = load_data(filename)
        if data and 'stats' in data:
            total_comments += data['stats']['N_total']
            total_mentions += data['stats']['N_entity']

            # 社長別の累計
            for tiger_id, stat in data['stats']['tiger_stats'].items():
                if tiger_id not in all_tiger_stats:
                    all_tiger_stats[tiger_id] = {
                        'display_name': stat['display_name'],
                        'total_mentions': 0,
                        'appearances': 0
                    }
                all_tiger_stats[tiger_id]['total_mentions'] += stat['N_tiger']
                all_tiger_stats[tiger_id]['appearances'] += 1

    # 総計表示
    st.markdown(f"### {icon('chart-simple', size='sm')} 全体統計", unsafe_allow_html=True)
    mention_rate = (total_mentions / total_comments * 100) if total_comments > 0 else 0

    cols = st.columns(4)
    with cols[0]:
        create_stat_card("comments", "総コメント数", f'{total_comments:,}', "#3B82F6")
    with cols[1]:
        create_stat_card("bullseye", "言及コメント数", f'{total_mentions:,}', "#10B981")
    with cols[2]:
        create_stat_card("chart-line", "平均言及率", f'{mention_rate:.1f}%', "#F59E0B")
    with cols[3]:
        create_stat_card("video", "分析動画数", f'{len(cached_files)}', "#EF4444")

    st.markdown("---")

    # 社長別ランキング
    st.markdown(f"### {icon('trophy', size='sm')} 社長別ランキング（全期間）", unsafe_allow_html=True)

    if all_tiger_stats:
        # ランキングデータを作成
        ranking_data = []
        for tiger_id, stat in all_tiger_stats.items():
            ranking_data.append({
                '社長': stat['display_name'],
                '総言及数': stat['total_mentions'],
                '出演回数': stat['appearances'],
                '平均言及数': stat['total_mentions'] / stat['appearances'] if stat['appearances'] > 0 else 0
            })

        df_ranking = pd.DataFrame(ranking_data)
        df_ranking = df_ranking.sort_values('総言及数', ascending=False).reset_index(drop=True)
        df_ranking.index += 1
        df_ranking.index.name = '順位'

        # データテーブル表示
        st.dataframe(
            df_ranking.style.format({
                '総言及数': '{:,}',
                '出演回数': '{}回',
                '平均言及数': '{:.1f}'
            }).background_gradient(subset=['総言及数'], cmap='Greens'),
            use_container_width=True
        )

        # グラフ表示
        col1, col2 = st.columns(2)

        with col1:
            st.markdown(f"#### {icon('chart-bar', size='sm')} 総言及数", unsafe_allow_html=True)
            fig1 = px.bar(
                df_ranking.head(10),
                x='総言及数',
                y='社長',
                orientation='h',
                color='総言及数',
                color_continuous_scale='Blues',
                title='トップ10社長（総言及数）'
            )
            fig1.update_layout(yaxis={'categoryorder': 'total ascending'}, height=400)
            st.plotly_chart(fig1, use_container_width=True)

        with col2:
            st.markdown(f"#### {icon('chart-pie', size='sm')} 言及数分布", unsafe_allow_html=True)
            fig2 = px.pie(
                df_ranking.head(10),
                values='総言及数',
                names='社長',
                title='トップ10社長の言及数分布'
            )
            fig2.update_layout(height=400)
            st.plotly_chart(fig2, use_container_width=True)

    st.markdown("---")

    # 最近の分析結果
    st.markdown(f"### {icon('folder', size='sm')} 最近の分析結果", unsafe_allow_html=True)

    for filename in sorted(cached_files, reverse=True)[:5]:  # 最新5件
        data = load_data(filename)
        if data:
            with st.expander(f"{icon('video', size='sm')} {data['video_info']['title']}", expanded=False):
                col1, col2, col3, col4 = st.columns(4)

                with col1:
                    st.metric("総コメント数", f"{data['stats']['N_total']:,}")

                with col2:
                    st.metric("言及コメント数", f"{data['stats']['N_entity']:,}")

                with col3:
                    rate = (data['stats']['N_entity'] / data['stats']['N_total'] * 100) if data['stats']['N_total'] > 0 else 0
                    st.metric("言及率", f"{rate:.1f}%")

                with col4:
                    published_date = data['video_info'].get('published_at', 'N/A')
                    st.metric("公開日", published_date[:10] if published_date != 'N/A' else 'N/A')

                # 社長別ランキング
                st.markdown("#### 社長別ランキング")
                tiger_stats = data['stats']['tiger_stats']
                df = pd.DataFrame([
                    {
                        '順位': stat['rank'],
                        '社長': stat['display_name'],
                        '言及数': stat['N_tiger'],
                        'Rate_total': f"{stat['Rate_total']:.2f}%",
                        'Rate_entity': f"{stat['Rate_entity']:.2f}%"
                    }
                    for stat in sorted(tiger_stats.values(), key=lambda x: x['rank'])
                ])
                st.dataframe(df, use_container_width=True, hide_index=True)


def show_video_analysis(tigers):
    """動画分析ページ（改善版）"""
    st.markdown(f"<h2>{icon('magnifying-glass', size='md')} 動画分析</h2>", unsafe_allow_html=True)

    # 分析進捗インジケーター
    create_progress_indicator(
        current_step=2,
        total_steps=4,
        step_labels=["収集", "分析", "集計", "表示"]
    )

    # デモモード
    st.markdown(f"### {icon('file-lines', size='sm')} デモ分析", unsafe_allow_html=True)
    create_info_card(
        "APIキー不要で試せます",
        "サンプルコメントを使って、システムの動作を確認できます。\n実際のYouTube動画を分析するには、「データ収集」ページを使用してください。",
        icon_name="lightbulb",
        color="#3498db"
    )

    col1, col2 = st.columns([2, 1])

    with col1:
        # サンプルコメント入力
        sample_comments_text = st.text_area(
            f"{icon('file-lines', size='sm')} サンプルコメント（1行につき1コメント）",
            value="林社長すごい!\n岩井社長と林社長の対決が面白い\nあすかさんのアドバイスが的確\n面白かった\nFC林と佐々木社長の掛け合いが最高\n田中社長の質問が鋭い\n不動産岩井と林さんの掛け合い最高",
            height=250,
            help="各行が1つのコメントとして扱われます"
        )

    with col2:
        # 出演社長選択
        st.markdown(f"#### {icon('user-tie', size='sm')} 出演社長を選択", unsafe_allow_html=True)
        tiger_options = {tid: t['display_name'] for tid, t in tigers.items()}
        selected_tigers = st.multiselect(
            "出演社長",
            options=list(tiger_options.keys()),
            format_func=lambda x: f"{tiger_options[x]}",
            default=['hayashi', 'iwai', 'asuka', 'sasaki'],
            help="この動画に出演している社長を選択してください",
            label_visibility="collapsed"
        )

        st.markdown("---")

        # 選択された社長の表示
        if selected_tigers:
            st.markdown("**選択中:**")
            for tid in selected_tigers:
                st.markdown(f"{icon('check', size='sm', color='#10B981')} {tiger_options[tid]}", unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 0.75rem; border-radius: 6px;">
                {icon('triangle-exclamation', size='sm', color='#F59E0B')} 社長を選択してください
            </div>
            """, unsafe_allow_html=True)

    st.markdown("---")

    if st.button(f"{icon('magnifying-glass', size='sm')} 分析を開始", type="primary", use_container_width=True):
        if not selected_tigers:
            st.markdown(f"""
            <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 6px;">
                {icon('circle-xmark', size='sm', color='#EF4444')} 出演社長を少なくとも1名選択してください。
            </div>
            """, unsafe_allow_html=True)
            return

        # コメントを解析
        comments = []
        for i, line in enumerate(sample_comments_text.strip().split('\n')):
            if line.strip():
                comments.append({
                    'comment_id': str(i + 1),
                    'text': line.strip(),
                    'video_id': 'demo',
                    'like_count': 0
                })

        if not comments:
            st.markdown(f"""
            <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 6px;">
                {icon('circle-xmark', size='sm', color='#EF4444')} コメントを入力してください。
            </div>
            """, unsafe_allow_html=True)
            return

        # プログレスバーと分析実行
        progress_bar = st.progress(0)
        status_text = st.empty()

        status_text.markdown(f"{icon('file-lines', size='sm')} コメントを正規化中...", unsafe_allow_html=True)
        progress_bar.progress(25)

        analyzer = CommentAnalyzer()

        status_text.markdown(f"{icon('magnifying-glass', size='sm')} 社長への言及を検出中...", unsafe_allow_html=True)
        progress_bar.progress(50)

        analyzed_comments = analyzer.analyze_comments(comments, selected_tigers)

        status_text.markdown(f"{icon('chart-simple', size='sm')} 統計を計算中...", unsafe_allow_html=True)
        progress_bar.progress(75)

        aggregator = StatsAggregator()
        stats = aggregator.calculate_video_stats(analyzed_comments, selected_tigers)

        progress_bar.progress(100)
        status_text.markdown(f"{icon('circle-check', size='sm', color='#10B981')} 分析完了！", unsafe_allow_html=True)

        st.balloons()

        st.markdown("---")

        # 結果表示
        st.markdown(f"## {icon('chart-line', size='md')} 分析結果", unsafe_allow_html=True)

        # サマリーカード
        cols = st.columns(4)
        with cols[0]:
            create_stat_card("comments", "総コメント数", f"{stats['N_total']}", "#3B82F6")
        with cols[1]:
            create_stat_card("bullseye", "言及コメント数", f"{stats['N_entity']}", "#10B981")
        with cols[2]:
            create_stat_card("chart-line", "言及率", f"{(stats['N_entity'] / stats['N_total'] * 100):.1f}%", "#F59E0B")
        with cols[3]:
            create_stat_card("users", "出演社長数", f"{len(selected_tigers)}", "#8B5CF6")

        st.markdown("---")

        # 社長別統計テーブル
        st.markdown(f"### {icon('trophy', size='sm')} 社長別ランキング", unsafe_allow_html=True)

        tiger_stats = stats['tiger_stats']

        # メダル用のアイコン
        rank_icons = {
            1: icon('trophy', size='sm', color='#FFD700'),
            2: icon('medal', size='sm', color='#C0C0C0'),
            3: icon('medal', size='sm', color='#CD7F32')
        }

        df = pd.DataFrame([
            {
                '順位': rank_icons.get(stat['rank'], f"{stat['rank']}位"),
                '社長': stat['display_name'],
                '言及数': stat['N_tiger'],
                'Rate_total (%)': f"{stat['Rate_total']:.2f}",
                'Rate_entity (%)': f"{stat['Rate_entity']:.2f}"
            }
            for stat in sorted(tiger_stats.values(), key=lambda x: x['rank'])
        ])

        st.dataframe(
            df,
            use_container_width=True,
            hide_index=True,
            column_config={
                "順位": st.column_config.TextColumn("順位", width="small"),
                "社長": st.column_config.TextColumn("社長", width="medium"),
                "言及数": st.column_config.NumberColumn("言及数", format="%d件"),
            }
        )

        # グラフ表示
        col1, col2 = st.columns(2)

        with col1:
            st.markdown(f"#### {icon('chart-bar', size='sm')} Rate_total（絶対的存在感）", unsafe_allow_html=True)
            fig1 = px.bar(
                df,
                x='Rate_total (%)',
                y='社長',
                orientation='h',
                color='Rate_total (%)',
                color_continuous_scale='Blues',
                text='Rate_total (%)'
            )
            fig1.update_traces(texttemplate='%{text:.1f}%', textposition='outside')
            fig1.update_layout(
                yaxis={'categoryorder': 'total ascending'},
                height=400,
                showlegend=False
            )
            st.plotly_chart(fig1, use_container_width=True)

        with col2:
            st.markdown(f"#### {icon('chart-bar', size='sm')} Rate_entity（相対的主役度）", unsafe_allow_html=True)
            fig2 = px.bar(
                df,
                x='Rate_entity (%)',
                y='社長',
                orientation='h',
                color='Rate_entity (%)',
                color_continuous_scale='Greens',
                text='Rate_entity (%)'
            )
            fig2.update_traces(texttemplate='%{text:.1f}%', textposition='outside')
            fig2.update_layout(
                yaxis={'categoryorder': 'total ascending'},
                height=400,
                showlegend=False
            )
            st.plotly_chart(fig2, use_container_width=True)

        # 円グラフ
        st.markdown(f"### {icon('chart-pie', size='sm')} 言及数分布", unsafe_allow_html=True)
        fig3 = go.Figure(data=[go.Pie(
            labels=[stat['display_name'] for stat in sorted(tiger_stats.values(), key=lambda x: x['N_tiger'], reverse=True)],
            values=[stat['N_tiger'] for stat in sorted(tiger_stats.values(), key=lambda x: x['N_tiger'], reverse=True)],
            hole=.3,
            textinfo='label+percent',
            textposition='auto'
        )])
        fig3.update_layout(height=500)
        st.plotly_chart(fig3, use_container_width=True)

        # コメント詳細
        st.markdown("---")
        st.markdown(f"### {icon('comments', size='sm')} コメント詳細", unsafe_allow_html=True)

        # フィルター
        filter_option = st.selectbox(
            "表示フィルター",
            ["すべて表示", "言及あり", "言及なし"],
            index=0
        )

        filtered_comments = analyzed_comments
        if filter_option == "言及あり":
            filtered_comments = [c for c in analyzed_comments if c['tiger_mentions']]
        elif filter_option == "言及なし":
            filtered_comments = [c for c in analyzed_comments if not c['tiger_mentions']]

        st.caption(f"表示件数: {len(filtered_comments)}/{len(analyzed_comments)}")

        for comment in filtered_comments:
            with st.expander(f"{icon('comment', size='sm')} {comment['text']}", expanded=False):
                col1, col2 = st.columns([3, 1])

                with col1:
                    st.markdown(f"**正規化テキスト:** `{comment['normalized_text']}`")

                    if comment['tiger_mentions']:
                        st.markdown("**言及社長:**")
                        for mention in comment['tiger_mentions']:
                            tiger_name = tigers[mention['tiger_id']]['display_name']
                            st.markdown(f"""
                            <div class="badge badge-success" style="display: inline-block; padding: 0.25rem 0.75rem; background: #D1FAE5; color: #065F46; border-radius: 12px; margin: 0.25rem;">
                                {icon('check', size='sm', color='#10B981')} {tiger_name} (マッチ: {mention['matched_alias']})
                            </div>
                            """, unsafe_allow_html=True)
                    else:
                        st.markdown(f"""
                        <div class="badge badge-info" style="display: inline-block; padding: 0.25rem 0.75rem; background: #DBEAFE; color: #1E40AF; border-radius: 12px; margin: 0.25rem;">
                            {icon('circle-info', size='sm', color='#3B82F6')} 言及なし
                        </div>
                        """, unsafe_allow_html=True)

                with col2:
                    st.metric(f"{icon('heart', size='sm')} いいね数", comment.get('like_count', 0))


def show_data_collection():
    """データ収集ページ"""
    st.markdown(f"<h2>{icon('download', size='md')} データ収集</h2>", unsafe_allow_html=True)

    st.markdown(f"""
    <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        {icon('circle-info', size='sm', color='#3B82F6')} YouTube Data API v3のAPIキーが必要です。
    </div>
    """, unsafe_allow_html=True)

    api_key = st.text_input(f"{icon('key', size='sm')} YouTube API キー", type="password")

    if not api_key:
        st.markdown(f"""
        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 1rem; border-radius: 8px;">
            {icon('triangle-exclamation', size='sm', color='#F59E0B')} APIキーを入力してください。
        </div>
        """, unsafe_allow_html=True)
        return

    # 動画ID直接入力
    st.markdown(f"<h3>{icon('video', size='sm')} 動画IDを指定して収集</h3>", unsafe_allow_html=True)
    video_id = st.text_input(f"{icon('film', size='sm')} 動画ID", placeholder="例: dQw4w9WgXcQ")
    max_comments = st.number_input(f"{icon('hashtag', size='sm')} 最大コメント数", min_value=10, max_value=1000, value=100)

    if st.button(f"{icon('download', size='sm')} コメント収集", type="primary"):
        if not video_id:
            st.markdown(f"""
            <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px;">
                {icon('circle-xmark', size='sm', color='#EF4444')} 動画IDを入力してください。
            </div>
            """, unsafe_allow_html=True)
            return

        try:
            with st.spinner(f"{icon('spinner', size='sm')} 動画情報とコメントを収集中..."):
                collector = YouTubeCollector(api_key)

                # 動画情報取得
                video_info = collector.get_video_details(video_id)
                if not video_info:
                    st.markdown(f"""
                    <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px;">
                        {icon('circle-xmark', size='sm', color='#EF4444')} 動画情報を取得できませんでした。
                    </div>
                    """, unsafe_allow_html=True)
                    return

                st.markdown(f"""
                <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                    {icon('circle-check', size='sm', color='#10B981')} 動画情報を取得: {video_info['title']}
                </div>
                """, unsafe_allow_html=True)

                # コメント取得
                comments = collector.get_video_comments(video_id, max_comments)
                st.markdown(f"""
                <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                    {icon('circle-check', size='sm', color='#10B981')} {len(comments)}件のコメントを取得しました。
                </div>
                """, unsafe_allow_html=True)

                # データを保存
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                data = {
                    'video_info': video_info,
                    'comments': comments,
                    'collected_at': timestamp
                }
                filename = f"collected_{video_id}_{timestamp}.json"
                save_data(data, filename)

                st.markdown(f"""
                <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                    {icon('floppy-disk', size='sm', color='#3B82F6')} データを保存しました: {filename}
                </div>
                """, unsafe_allow_html=True)

                # プレビュー表示
                with st.expander(f"{icon('chart-simple', size='sm')} データプレビュー"):
                    st.write(f"### {icon('video', size='sm')} 動画情報")
                    st.json(video_info)

                    st.write(f"### {icon('comments', size='sm')} コメントサンプル（最初の5件）")
                    for comment in comments[:5]:
                        st.write(f"{icon('comment', size='sm')} {comment['text']}")

        except Exception as e:
            st.markdown(f"""
            <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px;">
                {icon('circle-xmark', size='sm', color='#EF4444')} エラーが発生しました: {str(e)}
            </div>
            """, unsafe_allow_html=True)


def show_tiger_master(tigers):
    """社長マスタページ"""
    st.markdown(f"<h2>{icon('users', size='md')} 社長マスタ管理</h2>", unsafe_allow_html=True)

    manager = TigerManager()

    # タブを作成
    tab1, tab2 = st.tabs([f"{icon('list', size='sm')} 社長一覧", f"{icon('plus', size='sm')} 新規登録"])

    # タブ1: 社長一覧
    with tab1:
        st.markdown(f"<h3>{icon('list', size='sm')} 登録されている社長</h3>", unsafe_allow_html=True)

        if not tigers:
            st.markdown(f"""
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 1rem; border-radius: 8px;">
                {icon('triangle-exclamation', size='sm', color='#F59E0B')} まだ社長が登録されていません。「新規登録」タブから追加してください。
            </div>
            """, unsafe_allow_html=True)
        else:
            for tiger_id, tiger in tigers.items():
                with st.expander(f"{icon('user-tie', size='sm')} {tiger['display_name']}", expanded=False):
                    # 編集モードの切り替え
                    edit_mode = st.checkbox(f"編集モード", key=f"edit_{tiger_id}")

                    if edit_mode:
                        # 編集モード
                        st.markdown("### 基本情報の編集")
                        col1, col2 = st.columns(2)

                        with col1:
                            new_display_name = st.text_input(
                                "表示名",
                                value=tiger['display_name'],
                                key=f"display_{tiger_id}"
                            )
                            new_full_name = st.text_input(
                                "本名",
                                value=tiger['full_name'],
                                key=f"full_{tiger_id}"
                            )

                        with col2:
                            new_description = st.text_area(
                                "説明",
                                value=tiger['description'],
                                key=f"desc_{tiger_id}"
                            )
                            new_image_url = st.text_input(
                                "画像URL",
                                value=tiger['image_url'],
                                key=f"img_{tiger_id}"
                            )

                        col1, col2 = st.columns([1, 4])
                        with col1:
                            if st.button(f"{icon('floppy-disk', size='sm')} 保存", key=f"save_{tiger_id}", type="primary"):
                                if manager.update_tiger(
                                    tiger_id,
                                    display_name=new_display_name,
                                    full_name=new_full_name,
                                    description=new_description,
                                    image_url=new_image_url
                                ):
                                    st.markdown(f"""
                                    <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                                        {icon('circle-check', size='sm', color='#10B981')} 更新しました！
                                    </div>
                                    """, unsafe_allow_html=True)
                                    st.rerun()
                                else:
                                    st.markdown(f"""
                                    <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                                        {icon('circle-xmark', size='sm', color='#EF4444')} 更新に失敗しました
                                    </div>
                                    """, unsafe_allow_html=True)

                        with col2:
                            if st.button(f"{icon('trash', size='sm')} この社長を削除", key=f"del_{tiger_id}"):
                                if st.session_state.get(f"confirm_del_{tiger_id}", False):
                                    if manager.delete_tiger(tiger_id):
                                        st.markdown(f"""
                                        <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                                            {icon('circle-check', size='sm', color='#10B981')} 削除しました！
                                        </div>
                                        """, unsafe_allow_html=True)
                                        st.rerun()
                                    else:
                                        st.markdown(f"""
                                        <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                                            {icon('circle-xmark', size='sm', color='#EF4444')} 削除に失敗しました
                                        </div>
                                        """, unsafe_allow_html=True)
                                else:
                                    st.session_state[f"confirm_del_{tiger_id}"] = True
                                    st.markdown(f"""
                                    <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                                        {icon('triangle-exclamation', size='sm', color='#F59E0B')} もう一度クリックすると削除されます
                                    </div>
                                    """, unsafe_allow_html=True)

                        # エイリアス管理
                        st.markdown("---")
                        st.markdown(f"### {icon('tag', size='sm')} 呼称（エイリアス）の管理", unsafe_allow_html=True)

                        aliases = manager.get_aliases(tiger_id)

                        # 既存のエイリアス表示
                        if aliases:
                            st.write("**登録済みの呼称:**")
                            for i, alias_info in enumerate(aliases):
                                col1, col2, col3, col4 = st.columns([3, 2, 1, 1])
                                with col1:
                                    st.markdown(f"{icon('bookmark', size='sm')} {alias_info['alias']}", unsafe_allow_html=True)
                                with col2:
                                    st.write(f"タイプ: {alias_info['type']}")
                                with col3:
                                    st.write(f"優先度: {alias_info['priority']}")
                                with col4:
                                    if st.button(f"{icon('trash', size='xs')}", key=f"del_alias_{tiger_id}_{i}"):
                                        if manager.delete_alias(tiger_id, alias_info['alias']):
                                            st.markdown(f"""
                                            <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 0.5rem; border-radius: 8px; margin: 0.25rem 0;">
                                                {icon('check', size='xs', color='#10B981')} 削除しました
                                            </div>
                                            """, unsafe_allow_html=True)
                                            st.rerun()
                        else:
                            st.markdown(f"""
                            <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 0.75rem; border-radius: 8px;">
                                {icon('circle-info', size='sm', color='#3B82F6')} まだ呼称が登録されていません
                            </div>
                            """, unsafe_allow_html=True)

                        # 新しいエイリアスを追加
                        st.markdown("**新しい呼称を追加:**")
                        col1, col2, col3, col4 = st.columns([3, 2, 1, 1])

                        with col1:
                            new_alias = st.text_input(
                                "呼称",
                                key=f"new_alias_{tiger_id}",
                                placeholder="例: 林社長、林さん"
                            )

                        with col2:
                            alias_type = st.selectbox(
                                "タイプ",
                                ["formal", "casual", "nickname", "short", "fullname", "custom"],
                                key=f"alias_type_{tiger_id}"
                            )

                        with col3:
                            priority = st.number_input(
                                "優先度",
                                min_value=1,
                                max_value=10,
                                value=5,
                                key=f"priority_{tiger_id}"
                            )

                        with col4:
                            st.write("")
                            st.write("")
                            if st.button(f"{icon('plus', size='sm')} 追加", key=f"add_alias_{tiger_id}"):
                                if new_alias:
                                    if manager.add_alias(tiger_id, new_alias, alias_type, priority):
                                        st.markdown(f"""
                                        <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                                            {icon('circle-check', size='sm', color='#10B981')} 追加しました！
                                        </div>
                                        """, unsafe_allow_html=True)
                                        st.rerun()
                                    else:
                                        st.markdown(f"""
                                        <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                                            {icon('circle-xmark', size='sm', color='#EF4444')} 追加に失敗しました（重複している可能性があります）
                                        </div>
                                        """, unsafe_allow_html=True)
                                else:
                                    st.markdown(f"""
                                    <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 0.75rem; border-radius: 8px;">
                                        {icon('triangle-exclamation', size='sm', color='#F59E0B')} 呼称を入力してください
                                    </div>
                                    """, unsafe_allow_html=True)

                        # 一括登録セクション
                        st.markdown("---")
                        st.markdown(f"**{icon('layer-group', size='sm')} 一括登録（カンマ区切り）:**", unsafe_allow_html=True)

                        st.markdown(f"""
                        <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
                            {icon('circle-info', size='sm', color='#3B82F6')} 例: 林社長,林さん,FC林,フランチャイズの林
                        </div>
                        """, unsafe_allow_html=True)

                        bulk_aliases_text = st.text_area(
                            f"{icon('tags', size='sm')} 呼称をカンマ区切りで入力",
                            key=f"bulk_aliases_{tiger_id}",
                            placeholder="例: 林社長,林さん,FC林,フランチャイズの林",
                            height=80
                        )

                        col1, col2, col3 = st.columns([2, 2, 2])

                        with col1:
                            bulk_alias_type = st.selectbox(
                                "一括設定タイプ",
                                ["formal", "casual", "nickname", "short", "fullname", "custom"],
                                index=2,  # nickname
                                key=f"bulk_alias_type_{tiger_id}"
                            )

                        with col2:
                            bulk_start_priority = st.number_input(
                                "開始優先度",
                                min_value=1,
                                max_value=10,
                                value=5,
                                key=f"bulk_start_priority_{tiger_id}",
                                help="各呼称に順番に優先度が割り当てられます（例: 5, 6, 7...）"
                            )

                        with col3:
                            st.write("")
                            st.write("")
                            if st.button(f"{icon('layer-group', size='sm')} 一括追加", key=f"bulk_add_{tiger_id}", type="primary"):
                                if bulk_aliases_text.strip():
                                    # カンマで分割
                                    alias_list = [a.strip() for a in bulk_aliases_text.split(',') if a.strip()]

                                    if alias_list:
                                        success_count = 0
                                        failed_aliases = []

                                        for i, alias in enumerate(alias_list):
                                            current_priority = bulk_start_priority + i
                                            if manager.add_alias(tiger_id, alias, bulk_alias_type, current_priority):
                                                success_count += 1
                                            else:
                                                failed_aliases.append(alias)

                                        # 結果表示
                                        if success_count > 0:
                                            st.markdown(f"""
                                            <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                                                {icon('circle-check', size='sm', color='#10B981')} {success_count}件の呼称を追加しました！
                                            </div>
                                            """, unsafe_allow_html=True)

                                        if failed_aliases:
                                            st.markdown(f"""
                                            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                                                {icon('triangle-exclamation', size='sm', color='#F59E0B')} 追加できなかった呼称: {', '.join(failed_aliases)}
                                            </div>
                                            """, unsafe_allow_html=True)

                                        if success_count > 0:
                                            st.rerun()
                                    else:
                                        st.markdown(f"""
                                        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 0.75rem; border-radius: 8px;">
                                            {icon('triangle-exclamation', size='sm', color='#F59E0B')} 有効な呼称が入力されていません
                                        </div>
                                        """, unsafe_allow_html=True)
                                else:
                                    st.markdown(f"""
                                    <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 0.75rem; border-radius: 8px;">
                                        {icon('triangle-exclamation', size='sm', color='#F59E0B')} 呼称を入力してください
                                    </div>
                                    """, unsafe_allow_html=True)

                    else:
                        # 表示モード
                        col1, col2 = st.columns([1, 3])

                        with col1:
                            if tiger['image_url']:
                                st.image(tiger['image_url'])
                            else:
                                st.info("画像なし")

                        with col2:
                            st.write(f"**ID:** `{tiger['tiger_id']}`")
                            st.write(f"**表示名:** {tiger['display_name']}")
                            st.write(f"**本名:** {tiger['full_name']}")
                            st.write(f"**説明:** {tiger['description']}")

                        # エイリアス表示
                        aliases = manager.get_aliases(tiger_id)
                        if aliases:
                            st.write("**登録されている呼称:**")
                            for alias_info in aliases:
                                st.write(f"- {alias_info['alias']} (タイプ: {alias_info['type']}, 優先度: {alias_info['priority']})")
                        else:
                            st.info("呼称が登録されていません")

    # タブ2: 新規登録
    with tab2:
        st.markdown(f"<h3>{icon('user-plus', size='sm')} 新しい社長を登録</h3>", unsafe_allow_html=True)

        with st.form("add_tiger_form"):
            col1, col2 = st.columns(2)

            with col1:
                tiger_id = st.text_input(
                    "社長ID（一意）*",
                    placeholder="例: hayashi",
                    help="半角英数字とアンダースコアのみ使用可能"
                )
                display_name = st.text_input(
                    "表示名*",
                    placeholder="例: 林社長"
                )
                full_name = st.text_input(
                    "本名*",
                    placeholder="例: 林修一"
                )

            with col2:
                description = st.text_area(
                    "説明",
                    placeholder="例: フランチャイズコンサルタント"
                )
                image_url = st.text_input(
                    "画像URL（オプション）",
                    placeholder="https://..."
                )

            st.markdown("---")
            st.markdown(f"<h4>{icon('tags', size='sm')} 初期呼称の登録</h4>", unsafe_allow_html=True)
            st.markdown(f"""
            <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
                {icon('lightbulb', size='sm', color='#3B82F6')} 最低1つの呼称を登録してください。後から追加・編集できます。
            </div>
            """, unsafe_allow_html=True)

            # 登録方法を選択
            registration_method = st.radio(
                "呼称の登録方法を選択",
                ["個別入力（最大3つ）", "一括入力（カンマ区切り）"],
                horizontal=True,
                key="registration_method"
            )

            initial_aliases = []

            if registration_method == "個別入力（最大3つ）":
                alias_cols = st.columns(3)

                for i in range(3):
                    with alias_cols[i]:
                        alias = st.text_input(f"{icon('tag', size='xs')} 呼称 {i+1}", key=f"init_alias_{i}")
                        if alias:
                            alias_type = st.selectbox(
                                f"タイプ {i+1}",
                                ["formal", "casual", "nickname", "short", "fullname"],
                                key=f"init_type_{i}"
                            )
                            initial_aliases.append({
                                'alias': alias,
                                'type': alias_type,
                                'priority': i + 1
                            })
            else:
                # 一括入力
                st.markdown(f"""
                <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
                    {icon('circle-info', size='sm', color='#3B82F6')} 例: 林社長,林さん,FC林,フランチャイズの林
                </div>
                """, unsafe_allow_html=True)

                bulk_aliases = st.text_area(
                    f"{icon('tags', size='sm')} 呼称をカンマ区切りで入力",
                    key="bulk_init_aliases",
                    placeholder="例: 林社長,林さん,FC林,フランチャイズの林",
                    height=100
                )

                col1, col2 = st.columns(2)

                with col1:
                    bulk_type = st.selectbox(
                        "一括設定タイプ",
                        ["formal", "casual", "nickname", "short", "fullname"],
                        index=2,  # nickname
                        key="bulk_init_type"
                    )

                with col2:
                    bulk_start_priority = st.number_input(
                        "開始優先度",
                        min_value=1,
                        max_value=10,
                        value=1,
                        key="bulk_init_priority",
                        help="各呼称に順番に優先度が割り当てられます（例: 1, 2, 3...）"
                    )

                if bulk_aliases.strip():
                    alias_list = [a.strip() for a in bulk_aliases.split(',') if a.strip()]
                    for i, alias in enumerate(alias_list):
                        initial_aliases.append({
                            'alias': alias,
                            'type': bulk_type,
                            'priority': bulk_start_priority + i
                        })

            submitted = st.form_submit_button(f"{icon('plus', size='sm')} 社長を登録", type="primary")

            if submitted:
                # バリデーション
                if not tiger_id or not display_name or not full_name:
                    st.markdown(f"""
                    <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                        {icon('circle-xmark', size='sm', color='#EF4444')} 必須項目（*）を入力してください
                    </div>
                    """, unsafe_allow_html=True)
                elif not initial_aliases:
                    st.markdown(f"""
                    <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                        {icon('circle-xmark', size='sm', color='#EF4444')} 最低1つの呼称を登録してください
                    </div>
                    """, unsafe_allow_html=True)
                elif not tiger_id.replace('_', '').isalnum():
                    st.markdown(f"""
                    <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                        {icon('circle-xmark', size='sm', color='#EF4444')} 社長IDは半角英数字とアンダースコアのみ使用できます
                    </div>
                    """, unsafe_allow_html=True)
                else:
                    # 社長を追加
                    if manager.add_tiger(
                        tiger_id=tiger_id,
                        display_name=display_name,
                        full_name=full_name,
                        description=description,
                        image_url=image_url
                    ):
                        # エイリアスを追加
                        for alias_info in initial_aliases:
                            manager.add_alias(
                                tiger_id,
                                alias_info['alias'],
                                alias_info['type'],
                                alias_info['priority']
                            )

                        st.markdown(f"""
                        <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                            {icon('circle-check', size='sm', color='#10B981')} {display_name} を登録しました！
                        </div>
                        """, unsafe_allow_html=True)
                        st.balloons()
                        st.rerun()
                    else:
                        st.markdown(f"""
                        <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 1rem; border-radius: 8px; margin: 0.5rem 0;">
                            {icon('circle-xmark', size='sm', color='#EF4444')} 登録に失敗しました（IDが重複している可能性があります）
                        </div>
                        """, unsafe_allow_html=True)


if __name__ == '__main__':
    main()
