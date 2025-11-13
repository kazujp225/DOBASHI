# 🐯 令和の虎 社長別コメント言及分析システム

YouTube番組「令和の虎」の視聴者コメントを自動分析し、出演社長ごとの言及数・人気度を可視化するブラウザ型ツールです。

## ✨ 主な機能

- 📥 **YouTube動画コメント自動収集** - YouTube Data API v3を使用
- 🔍 **社長言及自動判定** - ルールベースマッチングで各社長への言及を検出
- 📊 **統計指標の自動計算** - Rate_total（絶対的存在感）、Rate_entity（相対的主役度）
- 📈 **リアルタイム可視化** - グラフ・ランキング表示
- 🌐 **ブラウザ型UI** - Streamlitによる直感的なWebインターフェース
- 👥 **社長マスタ管理** - Web UIから社長の登録・編集・削除が可能（NEW!）

## 🎯 指標の説明

### Rate_total（絶対的存在感）
= 社長言及コメント数 / 動画の総コメント数

**意味**: 動画全体で、その社長がどれだけ視聴者の意識を占有したか

### Rate_entity（相対的主役度）
= 社長言及コメント数 / 社長に関するコメント数

**意味**: 社長が話題になったコメントの中で、その社長がどれだけ話題の中心か

## 🚀 クイックスタート

### 1. 環境準備

```bash
# Pythonバージョン: 3.11以上推奨

# リポジトリのクローン
git clone <repository-url>
cd DOBASHIYOUTUBE

# 仮想環境作成（推奨）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージのインストール
pip install -r requirements.txt
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
4. 「📥 コメント収集」ボタンをクリック
5. 収集完了後、「🔍 動画分析」ページで分析を実行

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
├── app.py                           # Streamlit メインアプリケーション
├── requirements.txt                 # Python依存パッケージ
├── README.md                        # このファイル
├── USAGE.md                         # 使い方詳細ガイド
├── GUIDE_TIGER_REGISTRATION.md     # 社長登録ガイド（NEW!）
├── claude.md                        # プロジェクト概要
├── plan.md                          # 詳細要件定義書
│
├── src/
│   ├── collectors/
│   │   └── youtube_collector.py    # YouTube API コメント収集
│   ├── analyzers/
│   │   └── comment_analyzer.py     # コメント解析・言及判定
│   ├── aggregators/
│   │   └── stats_aggregator.py     # 統計集計
│   └── managers/                    # NEW!
│       └── tiger_manager.py        # 社長マスタ管理
│
├── data/
│   ├── tigers.json                 # 社長マスタデータ
│   ├── aliases.json                # 社長呼称辞書
│   └── cache/                      # 収集・分析データのキャッシュ
│
└── tests/                          # テストコード（予定）
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

## 📈 今後の開発予定

- [ ] LLM補助判定の導入（GPT/Claude API）
- [ ] センチメント分析（ポジティブ・ネガティブ判定）
- [ ] 期間別ランキング機能
- [ ] CSVエクスポート機能
- [ ] 時系列トレンド分析
- [ ] データベース対応（PostgreSQL）
- [ ] ユーザー認証機能

## 📝 ライセンス

このプロジェクトは個人・研究目的で使用してください。
商用利用の際は別途ご相談ください。

## 🤝 貢献

バグ報告・機能提案・プルリクエストを歓迎します！

## 📧 お問い合わせ

質問や提案がありましたら、Issueを作成してください。

---

**作成日**: 2025-11-13
**作成者**: Claude Code
**バージョン**: 1.0.0
