# 🐯 令和の虎 社長別コメント言及分析システム

YouTube番組「令和の虎」の視聴者コメントを自動分析し、出演社長ごとの言及数・人気度を可視化するブラウザ型ツールです。

## ✨ 主な機能

### 基本機能
- 📥 **YouTube動画コメント自動収集** - YouTube Data API v3を使用
  - ✅ 全コメント取得対応 - 動画の全てのコメントを自動収集
  - ✅ 返信コメントも含む - トップレベルだけでなく返信も取得
  - ✅ 進捗表示 - 取得中のコメント数をリアルタイム表示
  - ✅ 自動リトライ - API一時エラー時の自動再試行機能
  - ✅ 取得順序選択 - 新しい順/関連性順を選択可能
- 🔍 **社長言及自動判定** - ルールベースマッチングで各社長への言及を検出
- 📊 **統計指標の自動計算** - Rate_total（絶対的存在感）、Rate_entity（相対的主役度）
- 📈 **リアルタイム可視化** - グラフ・ランキング表示
- 🎯 **動画別ランキング比較** - どの動画でどの社長が1位かを一覧表示
- 👥 **社長マスタ管理** - Web UIから社長の登録・編集・削除が可能

### 新機能（v3.0）
- 💭 **感情分析機能** - コメントの感情（ポジティブ/ネガティブ/ニュートラル）を自動判定
- 🔄 **WebSocketリアルタイム更新** - 10秒ごとに統計情報を自動更新
- ☁️ **ワードクラウド生成** - 頻出キーワードを視覚化
- 📊 **比較分析ダッシュボード** - 動画間・社長間・期間別の詳細比較
- 📱 **PWA対応** - モバイル最適化とオフライン対応
- 📄 **自動レポート生成** - HTML/Markdown形式でのレポート出力
- 🗃️ **デュアルデータベース** - SQLite（開発）/PostgreSQL（本番）切り替え対応
- 🔐 **JWT認証システム** - セキュアなトークンベース認証

## 🎯 指標の説明

### Rate_total（絶対的存在感）
= 社長言及コメント数 / 動画の総コメント数

**意味**: 動画全体で、その社長がどれだけ視聴者の意識を占有したか

### Rate_entity（相対的主役度）
= 社長言及コメント数 / 社長に関するコメント数

**意味**: 社長が話題になったコメントの中で、その社長がどれだけ話題の中心か

## 🧠 システムロジック

### 処理フロー
1. **データ収集**: YouTube APIから動画情報とコメントを取得
2. **前処理**: コメントテキストの正規化（NFKC正規化、HTMLエンティティ除去）
3. **言及判定**: エイリアス辞書を使用したマッチング（完全一致→部分一致→文脈推定）
4. **感情分析**: 辞書ベース＋絵文字解析＋否定/強調表現の考慮
5. **統計集計**: Rate_total、Rate_entity、パフォーマンススコアの計算
6. **可視化**: リアルタイム更新とインタラクティブな表示

### コア判定アルゴリズム

#### 社長言及判定
```python
# エイリアス優先度
1. 本名完全形 (林尚弘) - 優先度: 100
2. 敬称付き姓 (林社長) - 優先度: 90
3. 会社名付き (モビリティーランドの林) - 優先度: 85
4. ニックネーム (FC社長) - 優先度: 70
5. 姓のみ (林) - 優先度: 50（文脈チェック必須）
```

#### 感情判定
```python
# スコア計算
1. 辞書ベース判定（ポジティブ/ネガティブワード）
2. 絵文字判定（😊 → +0.5、😢 → -0.5）
3. 否定表現の反転（スコア × -0.8）
4. 強調表現の増幅（スコア × 1.5）
5. 閾値判定（>0.3: ポジティブ、<-0.3: ネガティブ）
```

### データベース設計
- **videos**: 動画メタデータ
- **comments**: コメント本文と正規化テキスト
- **tigers**: 社長マスタ情報
- **tiger_aliases**: 社長別名辞書
- **comment_tiger_relations**: コメント×社長の関連
- **video_tiger_stats**: 動画×社長の統計結果

### パフォーマンス最適化
- **キャッシュ戦略**: Redis/インメモリの2層キャッシュ
- **インデックス**: 頻繁検索列に複合インデックス
- **バッチ処理**: 1000件単位でのバルクインサート
- **N+1回避**: Eager Loadingの活用

詳細な実装ロジックは [システムロジック詳細](README_SYSTEM_LOGIC.md) を参照してください。

## 🚀 クイックスタート

### モダンアーキテクチャ版（FastAPI + React）

#### 1. 環境準備

```bash
# Pythonバージョン: 3.11以上推奨
# Node.js: 18以上推奨

# リポジトリのクローン
git clone <repository-url>
cd DOBASHIYOUTUBE

# Python仮想環境作成
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# バックエンド依存パッケージ
cd backend
pip install -r requirements.txt

# フロントエンド依存パッケージ
cd ../frontend
npm install
```

#### 2. 環境設定

```bash
# .env ファイルを作成
cp .env.example .env

# 必要な設定を編集
# - YOUTUBE_API_KEY: YouTube Data APIキー
# - DATABASE_TYPE: sqlite または postgresql
# - SECRET_KEY: JWT署名用（ランダム文字列）
```

#### 3. システム起動

```bash
# Terminal 1: バックエンド起動
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: フロントエンド起動
cd frontend
npm run dev
```

#### 4. アクセス

- **フロントエンド**: http://localhost:5173
- **API ドキュメント**: http://localhost:8000/docs
- **WebSocket**: ws://localhost:8000/ws

### レガシー版（Streamlit）

```bash
# 環境準備
pip install -r requirements.txt

# アプリ起動
streamlit run app.py
```

### 2. YouTube API キーの取得

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新規プロジェクトを作成
3. YouTube Data API v3を有効化
4. APIキーを作成
5. APIキーを控えておく

### 3. アプリケーションの起動

```bash
streamlit run app.py
```

ブラウザが自動的に開き、`http://localhost:8501` でアプリケーションにアクセスできます。

## 📖 使い方

### デモ分析（APIキー不要）

1. サイドバーから「🔍 動画分析」を選択
2. サンプルコメントを入力（または既存のサンプルを使用）
3. 出演社長を選択
4. 「🔍 分析実行」ボタンをクリック
5. 結果をグラフとテーブルで確認

### 実際の動画分析（APIキー必要）

1. サイドバーから「📥 データ収集」を選択
2. YouTube API キーを入力
3. 動画ID（YouTubeのURL `youtube.com/watch?v=XXXXX` の`XXXXX`部分）を入力
4. オプション設定:
   - **全コメントを取得**: チェックすると動画の全コメントを取得（推奨）
   - **返信コメントも含める**: 返信も分析対象に含める（推奨）
   - **取得順序**: 新しい順 or 関連性順を選択
5. 「📥 コメント収集」ボタンをクリック
6. 進捗バーで取得状況を確認
7. 収集完了後、「🔍 動画分析」ページで分析を実行
8. 「📊 ダッシュボード」で動画別ランキングを確認

### 社長の登録・管理（NEW!）

#### 新しい社長を登録

1. サイドバーから「👥 社長マスタ」を選択
2. 「➕ 新規登録」タブをクリック
3. 基本情報を入力:
   - 社長ID（例: `hayashi`）
   - 表示名（例: `林社長`）
   - 本名（例: `林修一`）
   - 説明（オプション）
4. 初期呼称を登録（最低1つ必要）
5. 「➕ 社長を登録」ボタンをクリック

#### 社長情報を編集

1. 「📋 社長一覧」タブで社長を選択
2. 「編集モード」チェックボックスをON
3. 情報を変更して「💾 保存」

#### 呼称（エイリアス）を追加

1. 編集モードで「新しい呼称を追加」セクションに移動
2. 呼称とタイプ、優先度を入力
3. 「➕ 追加」ボタンをクリック

**詳細は** [社長登録ガイド](GUIDE_TIGER_REGISTRATION.md) **を参照してください**

## 📂 プロジェクト構成

```
DOBASHIYOUTUBE/
├── backend/                         # FastAPIバックエンド（新アーキテクチャ）
│   ├── main.py                     # FastAPIアプリケーション
│   ├── requirements.txt            # Python依存パッケージ
│   ├── api/
│   │   ├── routers/               # APIエンドポイント
│   │   │   ├── auth.py           # JWT認証
│   │   │   ├── sentiment.py      # 感情分析API
│   │   │   ├── wordcloud.py      # ワードクラウドAPI
│   │   │   └── comparison.py     # 比較分析API
│   │   ├── schemas.py            # Pydanticスキーマ
│   │   └── websocket.py          # WebSocket処理
│   ├── models/                    # データベースモデル
│   │   ├── database.py           # DB接続設定（SQLite/PostgreSQL）
│   │   └── models.py             # SQLAlchemyモデル
│   ├── core/                      # コア機能
│   │   ├── config.py             # 環境設定
│   │   ├── security.py           # セキュリティ（JWT/bcrypt）
│   │   └── cache.py              # キャッシュ管理（Redis/メモリ）
│   ├── analyzers/                 # 分析ロジック
│   │   ├── comment_analyzer.py   # コメント分析
│   │   └── sentiment_analyzer.py # 感情分析
│   └── utils/                     # ユーティリティ
│       ├── wordcloud_generator.py # ワードクラウド生成
│       └── report_generator.py    # レポート生成
│
├── frontend/                       # Reactフロントエンド（新実装）
│   ├── package.json               # Node依存パッケージ
│   ├── vite.config.ts            # Vite設定
│   ├── public/
│   │   ├── manifest.json         # PWA設定
│   │   └── service-worker.js     # Service Worker
│   └── src/
│       ├── components/           # UIコンポーネント
│       │   ├── SentimentAnalysis.tsx    # 感情分析
│       │   ├── WordCloud.tsx           # ワードクラウド
│       │   ├── ComparisonDashboard.tsx # 比較ダッシュボード
│       │   └── RealtimeDashboard.tsx   # リアルタイム更新
│       ├── pages/               # ページコンポーネント
│       └── services/            # APIクライアント
│
├── src/                          # レガシーコード（Streamlit版）
│   ├── collectors/              # YouTube API連携
│   ├── analyzers/               # コメント分析
│   ├── aggregators/            # 統計集計
│   └── managers/               # 社長マスタ管理
│
├── data/                        # データファイル
│   ├── tigers.json             # 社長マスタデータ
│   ├── aliases.json            # 社長呼称辞書
│   └── cache/                  # キャッシュディレクトリ
│
├── docker-compose.yml          # Docker構成（新追加）
├── .env.example               # 環境変数テンプレート
├── README.md                  # このファイル
├── README_SYSTEM_LOGIC.md     # システムロジック詳細（新追加）
└── IMPLEMENTATION_SUMMARY.md  # 実装完了レポート（新追加）
```

## 🛠️ 主要モジュール

### `src/collectors/youtube_collector.py`
YouTube Data API v3を使用して動画情報とコメントを収集します。

主な機能:
- チャンネルから動画一覧を取得
- 動画の詳細情報（再生数、コメント数など）を取得
- 動画のコメントを取得

### `src/analyzers/comment_analyzer.py`
コメントから社長への言及を自動判定します。

主な機能:
- テキスト正規化（全角・半角統一）
- エイリアス辞書を使用したルールベースマッチング
- 複数社長への同時言及検出

### `src/aggregators/stats_aggregator.py`
統計指標を計算します。

主な機能:
- N_total、N_entity、N_tiger の算出
- Rate_total、Rate_entity の計算
- 社長別ランキング生成

### `src/managers/tiger_manager.py` (NEW!)
社長マスタとエイリアスを管理します。

主な機能:
- 社長の追加・更新・削除
- エイリアスの追加・更新・削除
- JSONファイルへの自動保存

## 🎨 カスタマイズ

### 社長マスタの編集（推奨: Web UI使用）

**推奨方法: Web UIから編集**

1. アプリを起動: `streamlit run app.py`
2. 「👥 社長マスタ」ページで直接編集

詳細は [社長登録ガイド](GUIDE_TIGER_REGISTRATION.md) を参照してください。

**直接JSONファイルを編集する場合:**

`data/tigers.json` を編集して社長情報を追加・変更できます：

```json
{
  "tiger_id": "new_tiger",
  "display_name": "新社長",
  "full_name": "新 太郎",
  "description": "新規追加の社長",
  "image_url": ""
}
```

### 呼称辞書の編集（推奨: Web UI使用）

**推奨方法: Web UIから編集**

編集モードで簡単に追加・削除できます。

**直接JSONファイルを編集する場合:**

`data/aliases.json` を編集して社長の呼称バリエーションを追加できます：

```json
"new_tiger": [
  {"alias": "新社長", "type": "formal", "priority": 1},
  {"alias": "新さん", "type": "casual", "priority": 2}
]
```

## 📊 出力データ

収集・分析されたデータは `data/cache/` に保存されます：

- `collected_*.json` - YouTube APIから収集した動画・コメントデータ
- `analysis_*.json` - 分析結果データ

## ⚠️ 注意事項

### YouTube API クォータ制限
- YouTube Data API v3には1日あたり10,000 unitsのクォータ制限があります
- コメント取得は1リクエストあたり約1 unit消費します
- クォータを超えると、翌日まで利用できなくなります

### 利用規約
- YouTube API利用規約を遵守してください
- コメント投稿者のプライバシーを尊重してください
- データの外部公開時は個人を特定できる情報を含めないでください

## 🔧 トラブルシューティング

### エラー: "YouTube API Error: 403"
→ APIキーが無効、またはYouTube Data API v3が有効化されていません

### エラー: "quota exceeded"
→ 1日のAPIクォータを使い切りました。翌日まで待つか、クォータの増加をリクエストしてください

### Streamlitが起動しない
→ 依存パッケージが正しくインストールされているか確認してください
```bash
pip install -r requirements.txt --upgrade
```

## 📈 開発状況

### 実装済み機能（v3.0）
- [x] **感情分析機能** - 日本語対応の辞書ベース判定
- [x] **データベース対応** - SQLite/PostgreSQL切り替え可能
- [x] **ユーザー認証機能** - JWT認証システム
- [x] **CSVエクスポート機能** - 各種データのエクスポート
- [x] **期間別ランキング機能** - 日/週/月単位での集計
- [x] **WebSocketリアルタイム** - 10秒ごとの自動更新
- [x] **ワードクラウド生成** - D3.jsによる可視化
- [x] **比較分析機能** - 多角的な比較ダッシュボード
- [x] **PWA対応** - モバイル最適化とオフライン対応
- [x] **自動レポート生成** - HTML/Markdown形式

### 今後の開発予定
- [ ] **LLM補助判定** - GPT-4/Claude APIによる高精度判定
- [ ] **時系列予測** - 機械学習による将来予測
- [ ] **感情の詳細分類** - 喜び/怒り/悲しみ等の細分化
- [ ] **社長間相関分析** - 共起ネットワーク可視化
- [ ] **リアルタイム通知** - 特定条件でのプッシュ通知
- [ ] **マルチ言語対応** - 英語/中国語対応

## 📝 ライセンス

このプロジェクトは個人・研究目的で使用してください。
商用利用の際は別途ご相談ください。

## 🤝 貢献

バグ報告・機能提案・プルリクエストを歓迎します！

## 📧 お問い合わせ

質問や提案がありましたら、Issueを作成してください。

---

**作成日**: 2025-11-13
**最終更新**: 2025-11-17
**作成者**: Claude Code
**バージョン**: 3.0.0

## 📚 関連ドキュメント

- [システムロジック詳細](README_SYSTEM_LOGIC.md) - 処理フローとアルゴリズムの詳細
- [実装完了レポート](IMPLEMENTATION_SUMMARY.md) - v3.0の実装内容
- [新機能説明](NEW_FEATURES.md) - 追加された全機能の詳細
- [改善内容](IMPROVEMENTS.md) - システムの改善点
- [使い方ガイド](USAGE.md) - 詳細な使用方法
- [社長登録ガイド](GUIDE_TIGER_REGISTRATION.md) - 社長マスタの管理方法
