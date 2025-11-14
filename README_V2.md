# 令和の虎 コメント分析システム v2.0

React + TypeScript + FastAPI バージョン

## 🎯 概要

YouTube番組「令和の虎」の視聴者コメントを自動分析し、出演社長ごとの言及数・人気度を可視化するシステムです。

**v2.0の主な変更点:**
- ✨ モダンなReact + TypeScriptフロントエンド
- 🚀 FastAPI による高速なRESTful API
- 🎨 Tailwind CSS によるスタイリッシュなUI
- 📊 Recharts による美しいグラフ表示
- 🔄 React Query によるデータフェッチング

---

## 🏗️ システム構成

```
DOBASHIYOUTUBE/
├── backend/              # FastAPI バックエンド
│   ├── main.py          # FastAPIエントリーポイント
│   ├── api/
│   │   ├── routers/     # APIルーター
│   │   └── schemas.py   # Pydanticスキーマ
│   ├── collectors/      # YouTubeデータ収集
│   ├── analyzers/       # コメント分析
│   └── aggregators/     # 統計集計
│
├── frontend/            # React フロントエンド
│   ├── src/
│   │   ├── components/  # Reactコンポーネント
│   │   ├── pages/       # ページコンポーネント
│   │   ├── services/    # API通信
│   │   └── types/       # TypeScript型定義
│   └── package.json
│
├── data/                # データファイル
│   ├── tigers.json      # 社長マスタ
│   └── videos.json      # 動画データ
│
└── package.json         # ルート設定
```

---

## 🚀 クイックスタート

### 1. 環境構築

**前提条件:**
- Python 3.11+
- Node.js 18+
- YouTube Data API v3 キー

**依存パッケージのインストール:**

```bash
# バックエンド（Python）
cd backend
python -m venv venv
source venv/bin/activate  # Windowsの場合: venv\Scripts\activate
pip install -r requirements.txt

# フロントエンド（Node.js）
cd ../frontend
npm install
```

または、ルートディレクトリから一括インストール：

```bash
npm run install
```

### 2. YouTube API キーの設定

**APIキーの取得方法:**
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新規プロジェクトを作成
3. YouTube Data API v3 を有効化
4. 「認証情報」からAPIキーを作成
5. 取得したAPIキーをコピー

**環境変数の設定:**

```bash
# ルートディレクトリの .env.example をコピー
cp .env.example .env

# .env ファイルを編集して、APIキーを設定
# YOUTUBE_API_KEY=your_api_key_here
```

または、起動時に環境変数として直接指定：

```bash
# macOS/Linux
export YOUTUBE_API_KEY="your_api_key_here"
npm run dev

# Windows (PowerShell)
$env:YOUTUBE_API_KEY="your_api_key_here"
npm run dev
```

### 3. 起動方法

#### オプション1: フルスタック起動（推奨）

```bash
npm run dev
```

これで以下が同時に起動します：
- バックエンド: http://localhost:8000
- フロントエンド: http://localhost:5173

#### オプション2: 個別起動

```bash
# バックエンドのみ
npm run dev:backend

# フロントエンドのみ
npm run dev:frontend

# Streamlit版（v1.0）
npm run dev:streamlit
```

---

## 📖 使い方

### 1. ダッシュボード
- 登録社長数、分析動画数、総コメント数を確認
- 社長別ランキングをグラフとテーブルで表示

### 2. データ収集
1. YouTube動画URLを入力
2. 「コメントを収集」ボタンをクリック
3. 収集完了まで待機（進捗表示あり）

### 3. 動画分析
1. 分析する動画を選択
2. 出演社長を選択（複数可）
3. 「分析を開始」ボタンをクリック
4. 社長別の言及数・割合をグラフとテーブルで確認

### 4. 社長マスタ
- 登録されている社長の一覧を表示
- 社長の追加・編集・削除（今後実装）

---

## 🔌 API エンドポイント

### Tigers（社長マスタ）
- `GET /api/tigers` - 全社長取得
- `GET /api/tigers/{tiger_id}` - 特定社長取得
- `POST /api/tigers` - 社長追加
- `PUT /api/tigers/{tiger_id}` - 社長更新
- `DELETE /api/tigers/{tiger_id}` - 社長削除

### Videos（動画）
- `GET /api/videos` - 全動画取得
- `GET /api/videos/{video_id}` - 特定動画取得（統計付き）

### Analysis（分析）
- `POST /api/analysis/collect` - コメント収集開始
- `GET /api/analysis/collect/{video_id}` - 収集進捗取得
- `POST /api/analysis/analyze` - コメント分析実行

### Stats（統計）
- `GET /api/stats/video/{video_id}` - 動画統計取得
- `GET /api/stats/ranking?period={period}` - ランキング取得

**API ドキュメント:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 🛠️ 技術スタック

### フロントエンド
- **React 18** - UIライブラリ
- **TypeScript** - 型安全な開発
- **Vite** - 高速ビルドツール
- **React Router** - ページナビゲーション
- **TanStack Query** - データフェッチング・キャッシング
- **Tailwind CSS** - ユーティリティファーストCSS
- **Recharts** - グラフ描画
- **Lucide React** - アイコン

### バックエンド
- **FastAPI** - 高速なPython Webフレームワーク
- **Pydantic** - データバリデーション
- **Uvicorn** - ASGIサーバー
- **YouTube Data API v3** - 動画・コメント取得
- **Pandas** - データ処理
- **Matplotlib** - グラフ生成

---

## 📊 主要指標

### Rate_total（絶対的存在感）
```
Rate_total = 社長言及コメント数 / 動画の総コメント数
```
動画全体で、その社長がどれだけ視聴者の意識を占有したか

### Rate_entity（相対的主役度）
```
Rate_entity = 社長言及コメント数 / 社長に関するコメント数
```
社長が話題になったコメントの中で、その社長がどれだけ話題の中心か

---

## 🔄 開発ワークフロー

### 開発サーバー起動
```bash
npm run dev
```

### フロントエンドビルド
```bash
npm run build:frontend
```

### コード整形
```bash
# フロントエンド
cd frontend
npm run lint

# バックエンド
cd backend
black .
isort .
```

---

## 📝 今後の実装予定

- [ ] 社長の追加・編集・削除機能
- [ ] センチメント分析
- [ ] 時系列トレンドグラフ
- [ ] CSVエクスポート
- [ ] ユーザー認証
- [ ] ダークモード対応
- [ ] モバイルレスポンシブ最適化

---

## 🐛 トラブルシューティング

### ポート競合エラー
別のプロセスがポートを使用している場合：

```bash
# macOS/Linux
lsof -ti:8000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### CORS エラー
バックエンドの `main.py` で CORS設定を確認：
```python
allow_origins=["http://localhost:3000", "http://localhost:5173"]
```

### YouTube API クォータ超過
1日のクォータ上限（10,000 units）を超えた場合、翌日まで待つか、別のAPIキーを使用してください。

---

## 📄 ライセンス

MIT License

---

## 🙏 謝辞

- 令和の虎 公式チャンネル
- YouTube Data API v3
- Reactコミュニティ
- FastAPIコミュニティ

---

**Version:** 2.0.0
**Last Updated:** 2025-11-14
