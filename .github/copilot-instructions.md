## Copilot / AIエージェント向け簡易ガイド — DOBASHIYOUTUBE

目的: このファイルは、AIコーディングエージェントが素早く開発・修正をできるよう、リポジトリ固有の構成・コマンド・実装パターンを短くまとめたものです。

重要ポイント（サマリ）
- アプリは2つの利用形態が同居しています:
  - Streamlit 単体UI (簡易実行、開発に便利): `backend/app_streamlit.py`
  - FastAPI バックエンド + React フロントエンド (本格的なAPI/SPA): `backend/main.py` と `frontend/`
- 永続設定は JSON ファイル (`data/tigers.json`, `data/aliases.json`) を使う設計。キャッシュ/分析結果は `data/cache/analysis_*.json`。
- 環境変数 `.env` はプロジェクトルートを優先して読み込む（フォールバックで `backend/.env` をチェック）。重要キー: `YOUTUBE_API_KEY`。

必ず確認するファイル（最初に読む）
- `backend/app_streamlit.py` — Streamlit UI のエントリ。UIのページ構成や、どのJSONを参照・保存するかが分かる。
- `backend/main.py` — FastAPI エントリ。ルーター登録(`/api/videos`, `/api/tigers`, `/api/analysis`, `/api/stats`) と CORS 設定（dev用 origin: 3000/5173）を確認。
- `src/analyzers/comment_analyzer.py` — 言及判定ロジック（ルールベース）。正規化やエイリアスの扱いをここで確認。
- `src/collectors/youtube_collector.py` — YouTube データ取得の振る舞い・リトライ・ページング。
- `src/aggregators/stats_aggregator.py` — 指標計算（Rate_total / Rate_entity 等）。

開発・実行コマンド（リポジトリ固有）
- 仮想環境 + パッケージ（推奨）:
  - python -m venv venv && source venv/bin/activate
  - pip install -r requirements.txt
- Streamlit 単体（素早い操作/デバッグ）:
  - streamlit run backend/app_streamlit.py
  - 注意: ルート README に `app.py` とあるが、実際のUIは `backend/app_streamlit.py` を使う。
- FastAPI バックエンド（APIモード）:
  - python backend/main.py
  - もしくは: uvicorn backend.main:app --reload --port 8000
- フロントエンド (React/Vite):
  - cd frontend && npm install && npm run dev
  - Reactは `/api/*` を叩く想定（CORSは `backend/main.py` が dev-origin を許可）

データ/設定の慣例
- 社長マスタ: `data/tigers.json` — 各要素に `tiger_id`, `display_name`, `full_name`, `description`, `image_url`。
- 呼称(エイリアス): `data/aliases.json` — 例: `"hayashi": [{"alias":"林社長","type":"formal","priority":1}, ...]`。
- キャッシュ/分析結果: `data/cache/analysis_YYYYMMDD_*.json` — Streamlit と API はここを読み書きする。

実装パターン / 注意点（具体例）
- 言及判定はルールベースで、優先度付きエイリアスを採用。
  - 参考: `src/analyzers/comment_analyzer.py` の alias 検査と短いトークン（単漢字など）の文脈チェック。
- データ読み書きはファイルベースで行われるため、同時書き込みに注意（簡易ロックや一時ファイル戦略を使うと安全）。
- Streamlit 側は作業ディレクトリをルート想定で `data/` を参照している（`streamlit run` のカレントディレクトリをルートにすること）。

よくある変更の例（参考スニペットは実コード参照）
- 新しい社長を追加: `data/tigers.json` にオブジェクトを追加し、`data/aliases.json` に呼称を登録。
- API ルート追加: `backend/main.py` に `app.include_router(...)` を追加し、`backend/api/routers/` に実装ファイルを置く。

デバッグのヒント
- .env 読み込み: `backend/main.py` はプロジェクトルートの `.env` を優先して読む。キーが見つからない場合は `backend/.env` を参照する実装。
- CORS: React dev (port 3000) / Vite (5173) を開発用に許可している。API の呼び出し先をローカルで確認する時はこの点を確認。
- API ドキュメント: FastAPI 実行後に `/docs` を開くとルートのペイロード定義が確認できる。

作業優先順（AI が修正・実装する際の指針）
1. 影響範囲が小さいユニット（例: alias JSON, UI 表示文）から始める
2. 解析ロジックに関わる変更は `src/analyzers/comment_analyzer.py` と `src/aggregators/stats_aggregator.py` を同時にチェック
3. API 追加・変更は FastAPI ルーター（`backend/api/routers/*.py`）を編集し、`backend/main.py` で登録

最後に
- まずは `backend/app_streamlit.py` を起動して機能フロー（データ収集 → 分析 → ダッシュボード）が想定通り動くかを確認してください。
- 変更後は `data/cache` の新規analysisファイルと `/api/*` の動作を確認するのが早い検証手段です。

フィードバックください: ここに載せきれない「頻繁に行う作業」や「チームルール」があれば追記します。
