"""YouTube動画とコメントを収集するモジュール"""
import json
from typing import List, Dict, Optional
from datetime import datetime
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


class YouTubeCollector:
    """YouTube Data API v3を使用して動画とコメントを収集"""

    def __init__(self, api_key: str):
        """
        初期化

        Args:
            api_key: YouTube Data API v3のAPIキー
        """
        self.api_key = api_key
        self.youtube = build('youtube', 'v3', developerKey=api_key)

    def get_channel_videos(
        self,
        channel_id: str,
        max_results: int = 50,
        published_after: Optional[str] = None
    ) -> List[Dict]:
        """
        チャンネルから動画一覧を取得

        Args:
            channel_id: YouTubeチャンネルID
            max_results: 取得する動画の最大数
            published_after: この日時以降の動画のみ取得 (ISO 8601形式)

        Returns:
            動画情報のリスト
        """
        videos = []

        try:
            # チャンネルのアップロード再生リストIDを取得
            channel_response = self.youtube.channels().list(
                part='contentDetails',
                id=channel_id
            ).execute()

            if not channel_response['items']:
                return videos

            uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']

            # 再生リストから動画を取得
            next_page_token = None

            while len(videos) < max_results:
                playlist_request = self.youtube.playlistItems().list(
                    part='snippet,contentDetails',
                    playlistId=uploads_playlist_id,
                    maxResults=min(50, max_results - len(videos)),
                    pageToken=next_page_token
                )

                playlist_response = playlist_request.execute()

                for item in playlist_response['items']:
                    video_id = item['contentDetails']['videoId']
                    published_at = item['snippet']['publishedAt']

                    # 公開日フィルタリング
                    if published_after and published_at < published_after:
                        continue

                    # 動画の詳細情報を取得
                    video_details = self.get_video_details(video_id)
                    if video_details:
                        videos.append(video_details)

                next_page_token = playlist_response.get('nextPageToken')
                if not next_page_token:
                    break

            return videos

        except HttpError as e:
            print(f"YouTube API Error: {e}")
            return videos

    def get_video_details(self, video_id: str) -> Optional[Dict]:
        """
        動画の詳細情報を取得

        Args:
            video_id: YouTube動画ID

        Returns:
            動画詳細情報の辞書
        """
        try:
            response = self.youtube.videos().list(
                part='snippet,statistics',
                id=video_id
            ).execute()

            if not response['items']:
                return None

            item = response['items'][0]
            snippet = item['snippet']
            statistics = item['statistics']

            return {
                'video_id': video_id,
                'title': snippet['title'],
                'description': snippet['description'],
                'published_at': snippet['publishedAt'],
                'channel_id': snippet['channelId'],
                'channel_title': snippet['channelTitle'],
                'view_count': int(statistics.get('viewCount', 0)),
                'like_count': int(statistics.get('likeCount', 0)),
                'comment_count': int(statistics.get('commentCount', 0)),
                'thumbnail_url': snippet['thumbnails']['high']['url']
            }

        except HttpError as e:
            print(f"Error getting video details for {video_id}: {e}")
            return None

    def get_video_comments(
        self,
        video_id: str,
        max_results: Optional[int] = None,
        include_replies: bool = True,
        order: str = 'time',
        progress_callback=None
    ) -> List[Dict]:
        """
        動画のコメントを取得

        Args:
            video_id: YouTube動画ID
            max_results: 取得するコメントの最大数（Noneの場合は全て取得）
            include_replies: 返信コメントも含めるか（デフォルト: True）
            order: 取得順序 ('time': 新しい順, 'relevance': 関連性順)
            progress_callback: 進捗コールバック関数 callback(current, total_fetched)

        Returns:
            コメント情報のリスト
        """
        comments = []
        max_retries = 5  # 3→5に増やす
        retry_delay = 3  # 2→3秒に増やす

        try:
            next_page_token = None
            total_fetched = 0

            page_count = 0
            while True:
                page_count += 1

                # max_resultsが指定されている場合は、その数まで取得
                if max_results is not None and len(comments) >= max_results:
                    break

                # 1回のリクエストで取得する件数を決定
                if max_results is None:
                    page_size = 100  # 最大値
                else:
                    page_size = min(100, max_results - len(comments))

                print(f"📄 ページ {page_count}: {len(comments)}件取得済み...")

                # リトライロジック
                retry_count = 0
                while retry_count < max_retries:
                    try:
                        request = self.youtube.commentThreads().list(
                            part='snippet,replies',
                            videoId=video_id,
                            maxResults=page_size,
                            pageToken=next_page_token,
                            textFormat='plainText',
                            order=order
                        )

                        response = request.execute()
                        break  # 成功したらループを抜ける

                    except HttpError as e:
                        retry_count += 1
                        error_detail = str(e)

                        # エラーの詳細を表示
                        if hasattr(e, 'resp') and hasattr(e.resp, 'status'):
                            status_code = e.resp.status
                            print(f"⚠️ API Error {status_code} (リトライ {retry_count}/{max_retries}): {error_detail}")
                        else:
                            print(f"⚠️ API Error (リトライ {retry_count}/{max_retries}): {error_detail}")

                        if retry_count >= max_retries:
                            print(f"❌ 最大リトライ回数 ({max_retries}) に達しました")
                            raise  # 最大リトライ回数に達したら例外を投げる

                        import time
                        wait_time = retry_delay * retry_count  # 指数バックオフ
                        print(f"⏱️  {wait_time}秒待機してリトライします...")
                        time.sleep(wait_time)

                # コメントを処理
                for item in response['items']:
                    top_comment = item['snippet']['topLevelComment']['snippet']

                    # トップレベルコメント
                    comments.append({
                        'comment_id': item['snippet']['topLevelComment']['id'],
                        'video_id': video_id,
                        'author': top_comment['authorDisplayName'],
                        'author_channel_id': top_comment.get('authorChannelId', {}).get('value', ''),
                        'text': top_comment['textDisplay'],
                        'like_count': top_comment['likeCount'],
                        'published_at': top_comment['publishedAt'],
                        'updated_at': top_comment['updatedAt'],
                        'is_reply': False,
                        'parent_id': None
                    })

                    total_fetched += 1

                    # 返信コメントを含める場合
                    if include_replies and 'replies' in item:
                        for reply in item['replies']['comments']:
                            reply_snippet = reply['snippet']

                            comments.append({
                                'comment_id': reply['id'],
                                'video_id': video_id,
                                'author': reply_snippet['authorDisplayName'],
                                'author_channel_id': reply_snippet.get('authorChannelId', {}).get('value', ''),
                                'text': reply_snippet['textDisplay'],
                                'like_count': reply_snippet['likeCount'],
                                'published_at': reply_snippet['publishedAt'],
                                'updated_at': reply_snippet['updatedAt'],
                                'is_reply': True,
                                'parent_id': reply_snippet['parentId']
                            })

                            total_fetched += 1

                    # 進捗コールバック
                    if progress_callback:
                        progress_callback(len(comments), total_fetched)

                # 次のページトークンをチェック
                next_page_token = response.get('nextPageToken')
                if not next_page_token:
                    print(f"✅ 全ページ取得完了（ページ数: {page_count}）")
                    break  # これ以上ページがない

            print(f"🎉 取得完了: {len(comments)}件のコメント（返信含む）")
            print(f"   📊 取得ページ数: {page_count}ページ")
            print(f"   📝 トップレベルコメント + 返信: {total_fetched}件")
            return comments

        except HttpError as e:
            error_reason = None
            if hasattr(e, 'resp') and hasattr(e.resp, 'status'):
                status_code = e.resp.status
                if status_code == 403:
                    if 'commentsDisabled' in str(e):
                        error_reason = "この動画はコメントが無効になっています"
                    elif 'quotaExceeded' in str(e):
                        error_reason = "YouTube API のクォータ制限に達しました（1日の上限）"
                    else:
                        error_reason = "APIアクセス権限エラー"
                elif status_code == 404:
                    error_reason = "動画が見つかりません"

            if error_reason:
                print(f"❌ Error getting comments for video {video_id}: {error_reason}")
            else:
                print(f"❌ Error getting comments for video {video_id}: {e}")

            # 途中まで取得できていればそれを返す（ログに警告を出す）
            if comments:
                print(f"⚠️ 警告: {len(comments)}件のコメントを取得しましたが、全件取得できませんでした")
                print(f"   理由: {error_reason or str(e)}")

            return comments

    def save_to_json(self, data: Dict, filename: str):
        """
        データをJSONファイルに保存

        Args:
            data: 保存するデータ
            filename: ファイル名
        """
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


# 使用例
if __name__ == '__main__':
    # APIキーは環境変数から読み込むことを推奨
    import os

    api_key = os.environ.get('YOUTUBE_API_KEY', '')
    if not api_key:
        print("環境変数 YOUTUBE_API_KEY を設定してください")
        exit(1)

    collector = YouTubeCollector(api_key)

    # テスト用のチャンネルID（令和の虎のチャンネルID）
    # 実際のチャンネルIDに置き換えてください
    channel_id = 'YOUR_CHANNEL_ID'

    # 動画を取得
    print("動画を取得中...")
    videos = collector.get_channel_videos(channel_id, max_results=5)
    print(f"{len(videos)}件の動画を取得しました")

    # 最初の動画のコメントを取得
    if videos:
        video_id = videos[0]['video_id']
        print(f"\n動画 '{videos[0]['title']}' のコメントを取得中...")
        comments = collector.get_video_comments(video_id, max_results=100)
        print(f"{len(comments)}件のコメントを取得しました")
