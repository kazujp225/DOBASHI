# YouTube API クォータ管理ガイド

## 📊 クォータの基本

### 1日の制限
- **デフォルト**: 10,000 units/日
- **リセット時刻**: 太平洋標準時の深夜0時（日本時間 17:00）

### 主な操作のコスト

| 操作 | コスト | 備考 |
|------|--------|------|
| videos.list | 1 unit | 動画情報取得 |
| commentThreads.list | 1 unit | コメント100件まで |
| search.list | 100 units | ⚠️ 高コスト |

## 📈 実際の取得可能数

### 通常利用
```
1日で取得可能:
- 動画情報: 100本
- コメント: 約10,000件
- 動画10本 × 各1,000コメント
```

### 効率的な使い方
```python
# 👍 良い例: 関連性の高いコメントのみ取得
comments = collector.get_video_comments(
    video_id,
    max_results=500,      # 必要な分だけ
    order='relevance'     # 関連性順
)

# 👎 悪い例: 全コメント無制限取得
comments = collector.get_video_comments(
    video_id,
    max_results=None      # ❌ クォータ浪費
)
```

## 🔧 クォータ対策

### 1. キャッシュ戦略（推奨）

```python
# 一度取得したデータは再利用
# data/comments_{video_id}.json にキャッシュ
# 再分析時はAPIを叩かない
```

### 2. 複数APIキーのローテーション

```bash
# .env ファイル
YOUTUBE_API_KEY_1=key1
YOUTUBE_API_KEY_2=key2
YOUTUBE_API_KEY_3=key3

# → 1日 30,000 コメント取得可能
```

### 3. クォータ増加申請

Google Cloud Consoleで申請可能：
1. [Quotas & System Limits](https://console.cloud.google.com/iam-admin/quotas) にアクセス
2. "YouTube Data API v3" を検索
3. "Queries per day" を選択
4. "EDIT QUOTAS" をクリック
5. 理由を記入して申請

**増加可能な範囲:**
- 無料: 10,000 → 50,000 units
- 有料: さらに増加可能（要審査）

### 4. 取得コメント数の最適化

**動画の規模に応じて調整:**

```python
# 小規模動画（100-500コメント）
max_results = None  # 全取得でOK

# 中規模動画（500-5,000コメント）
max_results = 1000  # 上位1,000件

# 大規模動画（5,000+コメント）
max_results = 500   # 上位500件
order = 'relevance' # 関連性の高いもの優先
```

## 📉 クォータ使用状況の確認

Google Cloud Console で確認:
1. [APIs & Services → Dashboard](https://console.cloud.google.com/apis/dashboard)
2. "YouTube Data API v3" をクリック
3. "Quotas" タブで使用状況を確認

## ⚠️ クォータ超過時の対処

### エラーメッセージ
```
HttpError 403: quotaExceeded
```

### 対処法

**1. 翌日まで待つ（推奨）**
- 最もシンプルな方法
- 深夜0時（PST）にリセット

**2. 別のAPIキーを使用**
```bash
# 環境変数を切り替え
export YOUTUBE_API_KEY=$YOUTUBE_API_KEY_2
```

**3. キャッシュデータで分析**
```python
# 既に収集済みのデータを再分析
# APIを叩かずに分析可能
```

## 💡 ベストプラクティス

### ✅ 推奨

1. **キャッシュを活用**
   - 同じ動画は1回だけ取得
   - 再分析時はキャッシュを使用

2. **必要な分だけ取得**
   - max_results を適切に設定
   - 全コメント不要なら制限する

3. **クォータ使用量を記録**
   - ログに取得件数を記録
   - 1日の使用量を把握

4. **エラーハンドリング**
   - クォータ超過時の適切なメッセージ
   - ユーザーに次回取得可能時刻を通知

### ❌ 非推奨

1. **無制限取得**
   - max_results=None は避ける
   - 大規模動画では特に注意

2. **重複取得**
   - キャッシュチェックを怠る
   - 同じデータを何度も取得

3. **search API の多用**
   - 1回100 unitsと高コスト
   - 代わりに videos.list を使用

## 📊 使用例シナリオ

### シナリオ1: 毎日1動画分析
```
1動画 × 1,000コメント = 10 units
→ 余裕で運用可能（10,000 units余り）
```

### シナリオ2: 週末に10動画分析
```
10動画 × 各1,000コメント = 100 units
→ 問題なし
```

### シナリオ3: 月次レポート（30動画）
```
30動画 × 各500コメント = 150 units
→ 1日で完了可能
```

## 🎯 まとめ

**個人的な分析・研究用途なら、デフォルトの10,000 unitsで十分です！**

- キャッシュを活用
- 必要な分だけ取得
- クォータ管理を意識

これで快適に運用できます。
