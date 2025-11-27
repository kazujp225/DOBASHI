"""UI/UXコンポーネントユーティリティ - Professional Design System"""
import streamlit as st


def apply_custom_css():
    """統一されたデザインシステムのCSSを適用"""
    st.markdown("""
    <!-- Font Awesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <style>
    /* ==================== カラーパレット ==================== */
    :root {
        --primary: #1E3A8A;
        --primary-light: #3B82F6;
        --secondary: #10B981;
        --accent: #F59E0B;
        --danger: #EF4444;
        --bg-primary: #FFFFFF;
        --bg-secondary: #F9FAFB;
        --bg-tertiary: #F3F4F6;
        --text-primary: #111827;
        --text-secondary: #6B7280;
        --text-muted: #9CA3AF;
        --border: #E5E7EB;
        --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        --radius-sm: 6px;
        --radius: 8px;
        --radius-lg: 12px;
        --radius-xl: 16px;
    }

    /* ==================== 基本スタイル ==================== */
    .main .block-container {
        padding: 2rem 1rem;
        max-width: 1400px;
    }

    /* ==================== Typography ==================== */
    h1, h2, h3, h4, h5, h6 {
        color: var(--text-primary) !important;
        font-weight: 600 !important;
        letter-spacing: -0.02em !important;
    }

    h1 { font-size: 2rem !important; margin-bottom: 0.5rem !important; }
    h2 { font-size: 1.5rem !important; margin-top: 2rem !important; }
    h3 { font-size: 1.25rem !important; }

    /* ==================== カード ==================== */
    .stat-card {
        background: var(--bg-primary);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 1.5rem;
        box-shadow: var(--shadow);
        transition: all 0.2s ease;
    }

    .stat-card:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
    }

    .stat-card-icon {
        width: 48px;
        height: 48px;
        border-radius: var(--radius);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        margin-bottom: 1rem;
    }

    .stat-card-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0.5rem 0;
    }

    .stat-card-label {
        font-size: 0.875rem;
        color: var(--text-secondary);
        font-weight: 500;
    }

    /* ==================== ボタン ==================== */
    .stButton > button {
        border-radius: var(--radius) !important;
        font-weight: 500 !important;
        border: none !important;
        transition: all 0.2s ease !important;
        box-shadow: var(--shadow-sm) !important;
    }

    .stButton > button:hover {
        transform: translateY(-1px) !important;
        box-shadow: var(--shadow) !important;
    }

    .stButton > button[kind="primary"] {
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%) !important;
    }

    /* ==================== サイドバー ==================== */
    [data-testid="stSidebar"] {
        background: var(--bg-primary);
        border-right: 1px solid var(--border);
    }

    [data-testid="stSidebar"] .stRadio > label {
        background: var(--bg-secondary);
        padding: 0.75rem 1rem;
        border-radius: var(--radius);
        margin-bottom: 0.5rem;
        border: 1px solid var(--border);
        transition: all 0.2s ease;
    }

    [data-testid="stSidebar"] .stRadio > label:hover {
        background: var(--bg-tertiary);
        border-color: var(--primary-light);
    }

    /* ==================== メトリクス ==================== */
    [data-testid="stMetricValue"] {
        font-size: 1.875rem !important;
        font-weight: 700 !important;
        color: var(--text-primary) !important;
    }

    [data-testid="stMetricLabel"] {
        font-size: 0.875rem !important;
        color: var(--text-secondary) !important;
        font-weight: 500 !important;
    }

    /* ==================== データテーブル ==================== */
    .dataframe {
        border: 1px solid var(--border) !important;
        border-radius: var(--radius) !important;
    }

    /* ==================== プログレスバー ==================== */
    .stProgress > div > div > div {
        background: linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 100%);
    }

    /* ==================== エクスパンダー ==================== */
    .streamlit-expanderHeader {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        font-weight: 500;
        transition: all 0.2s ease;
    }

    .streamlit-expanderHeader:hover {
        background: var(--bg-tertiary);
        border-color: var(--primary-light);
    }

    /* ==================== タブ ==================== */
    .stTabs [data-baseweb="tab-list"] {
        gap: 0.5rem;
        background: var(--bg-secondary);
        padding: 0.25rem;
        border-radius: var(--radius);
    }

    .stTabs [data-baseweb="tab"] {
        border-radius: var(--radius-sm);
        padding: 0.625rem 1.25rem;
        font-weight: 500;
        border: none;
    }

    .stTabs [data-baseweb="tab"][aria-selected="true"] {
        background: var(--bg-primary);
        box-shadow: var(--shadow-sm);
    }

    /* ==================== インフォボックス ==================== */
    .info-box {
        background: var(--bg-secondary);
        border-left: 4px solid var(--primary-light);
        border-radius: var(--radius);
        padding: 1rem 1.25rem;
        margin: 1rem 0;
    }

    .success-box {
        background: #ECFDF5;
        border-left: 4px solid var(--secondary);
    }

    .warning-box {
        background: #FEF3C7;
        border-left: 4px solid var(--accent);
    }

    .error-box {
        background: #FEE2E2;
        border-left: 4px solid var(--danger);
    }

    /* ==================== アイコン ==================== */
    .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .icon-sm { width: 1rem; height: 1rem; font-size: 0.875rem; }
    .icon-md { width: 1.5rem; height: 1.5rem; font-size: 1.125rem; }
    .icon-lg { width: 2rem; height: 2rem; font-size: 1.5rem; }
    .icon-xl { width: 3rem; height: 3rem; font-size: 2rem; }

    /* ==================== バッジ ==================== */
    .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 500;
        gap: 0.25rem;
    }

    .badge-primary { background: #DBEAFE; color: #1E40AF; }
    .badge-success { background: #D1FAE5; color: #065F46; }
    .badge-warning { background: #FEF3C7; color: #92400E; }
    .badge-danger { background: #FEE2E2; color: #991B1B; }
    .badge-gray { background: #F3F4F6; color: #374151; }
    </style>
    """, unsafe_allow_html=True)


def icon(name, size="md", color=None, style="fas"):
    """Font Awesomeアイコンを表示

    Args:
        name: アイコン名 (例: "chart-line", "users", "cog")
        size: サイズ ("sm", "md", "lg", "xl")
        color: 色 (CSSカラー)
        style: スタイル ("fas"=solid, "far"=regular, "fab"=brands)
    """
    color_style = f"color: {color};" if color else ""
    return f'<i class="{style} fa-{name} icon icon-{size}" style="{color_style}"></i>'


def create_stat_card(icon_name, label, value, color="#3B82F6"):
    """統計カードを作成"""
    html = f"""
    <div class="stat-card">
        <div class="stat-card-icon" style="background: {color}20;">
            <i class="fas fa-{icon_name}" style="color: {color};"></i>
        </div>
        <div class="stat-card-value">{value}</div>
        <div class="stat-card-label">{label}</div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def create_metric_card(title, value, delta=None, icon_name="chart-line", color="#3B82F6"):
    """メトリックカードを作成"""
    delta_html = ""
    if delta is not None:
        delta_color = "#10B981" if delta >= 0 else "#EF4444"
        delta_icon = "arrow-up" if delta >= 0 else "arrow-down"
        delta_html = f'''
        <div style="display: flex; align-items: center; gap: 0.25rem; margin-top: 0.5rem;">
            <i class="fas fa-{delta_icon}" style="color: {delta_color}; font-size: 0.875rem;"></i>
            <span style="color: {delta_color}; font-weight: 600; font-size: 0.875rem;">{abs(delta)}%</span>
        </div>
        '''

    html = f"""
    <div style="
        background: white;
        border: 1px solid #E5E7EB;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    ">
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
                <div style="color: #6B7280; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem;">
                    {title}
                </div>
                <div style="color: #111827; font-size: 2rem; font-weight: 700;">
                    {value}
                </div>
                {delta_html}
            </div>
            <div style="
                width: 48px;
                height: 48px;
                background: {color}20;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <i class="fas fa-{icon_name}" style="color: {color}; font-size: 1.5rem;"></i>
            </div>
        </div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def create_progress_indicator(current_step, total_steps, step_labels):
    """ステップ進捗インジケーターを作成"""
    steps_html = ""

    for i in range(total_steps):
        is_completed = i < current_step - 1
        is_current = i == current_step - 1

        if is_completed:
            status_color = "#10B981"
            icon_html = '<i class="fas fa-check"></i>'
        elif is_current:
            status_color = "#3B82F6"
            icon_html = '<i class="fas fa-circle"></i>'
        else:
            status_color = "#E5E7EB"
            icon_html = '<i class="far fa-circle"></i>'

        steps_html += f"""
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
            <div style="
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: {status_color};
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.125rem;
                margin-bottom: 0.5rem;
            ">
                {icon_html}
            </div>
            <div style="font-size: 0.875rem; color: {status_color}; font-weight: 500;">
                {step_labels[i]}
            </div>
        </div>
        """

        if i < total_steps - 1:
            line_color = "#10B981" if is_completed else "#E5E7EB"
            steps_html += f"""
            <div style="flex: 0.5; display: flex; align-items: center; margin-bottom: 2rem;">
                <div style="width: 100%; height: 2px; background: {line_color};"></div>
            </div>
            """

    html = f'<div style="display: flex; align-items: start; margin: 2rem 0;">{steps_html}</div>'
    st.markdown(html, unsafe_allow_html=True)


def create_info_card(title, content, icon_name="info-circle", color="#3B82F6"):
    """情報カードを作成"""
    html = f"""
    <div style="
        background: white;
        border-left: 4px solid {color};
        border-radius: 8px;
        padding: 1rem 1.25rem;
        margin: 1rem 0;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    ">
        <div style="display: flex; align-items: start; gap: 1rem;">
            <div style="
                width: 40px;
                height: 40px;
                background: {color}20;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            ">
                <i class="fas fa-{icon_name}" style="color: {color}; font-size: 1.25rem;"></i>
            </div>
            <div>
                <div style="font-weight: 600; color: #111827; margin-bottom: 0.25rem;">
                    {title}
                </div>
                <div style="color: #6B7280; font-size: 0.875rem; line-height: 1.5;">
                    {content}
                </div>
            </div>
        </div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def create_status_badge(status, text=None):
    """ステータスバッジを作成"""
    status_config = {
        'success': {'class': 'badge-success', 'icon': 'check-circle', 'text': '成功'},
        'warning': {'class': 'badge-warning', 'icon': 'exclamation-triangle', 'text': '警告'},
        'error': {'class': 'badge-danger', 'icon': 'times-circle', 'text': 'エラー'},
        'info': {'class': 'badge-primary', 'icon': 'info-circle', 'text': '情報'},
        'pending': {'class': 'badge-gray', 'icon': 'clock', 'text': '保留中'},
    }

    config = status_config.get(status, status_config['info'])
    display_text = text or config['text']

    return f'''
    <span class="badge {config['class']}">
        <i class="fas fa-{config['icon']}"></i>
        {display_text}
    </span>
    '''


def create_empty_state(icon_name, title, description, action_text=None):
    """空の状態を表示"""
    action_html = f'<div style="color: #3B82F6; font-weight: 600; margin-top: 1rem;">{action_text}</div>' if action_text else ''

    html = f"""
    <div style="
        text-align: center;
        padding: 4rem 2rem;
        background: #F9FAFB;
        border-radius: 12px;
        margin: 2rem 0;
    ">
        <div style="
            width: 80px;
            height: 80px;
            background: #E5E7EB;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
        ">
            <i class="fas fa-{icon_name}" style="color: #9CA3AF; font-size: 2.5rem;"></i>
        </div>
        <h3 style="color: #374151; margin-bottom: 0.5rem; font-size: 1.25rem;">{title}</h3>
        <p style="color: #6B7280; margin-bottom: 0; max-width: 500px; margin-left: auto; margin-right: auto;">
            {description}
        </p>
        {action_html}
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def create_statistic_row(stats_list):
    """統計情報の行を作成"""
    cols = st.columns(len(stats_list))
    for col, stat in zip(cols, stats_list):
        with col:
            create_stat_card(
                icon_name=stat['icon'],
                label=stat['label'],
                value=stat['value'],
                color=stat.get('color', '#3B82F6')
            )


def show_help_tooltip(text):
    """ヘルプツールチップを表示"""
    return f'''
    <span style="
        background: #3B82F6;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        cursor: help;
        margin-left: 0.25rem;
    " title="{text}">
        <i class="fas fa-question"></i>
    </span>
    '''


def create_loading_spinner(text="処理中..."):
    """ローディングスピナーを作成"""
    return st.spinner(f"⚙️ {text}")
