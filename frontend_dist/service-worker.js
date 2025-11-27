// Service Worker for PWA
const CACHE_NAME = 'tora-analysis-v1';
const API_CACHE_NAME = 'tora-api-v1';

// キャッシュするファイル
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// インストールイベント
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('キャッシュを開きました');
        return cache.addAll(urlsToCache);
      })
  );
  // すぐにアクティブ化
  self.skipWaiting();
});

// アクティベートイベント
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // すぐにクライアントをコントロール
  self.clients.claim();
});

// フェッチイベント
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API呼び出しの場合
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功したレスポンスをキャッシュ
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // オフライン時はキャッシュから返す
          return caches.match(request);
        })
    );
    return;
  }

  // 静的ファイルの場合
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // キャッシュがあればそれを返す
        if (response) {
          return response;
        }

        // なければネットワークから取得
        return fetch(request).then((response) => {
          // 有効なレスポンスでない場合はそのまま返す
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // レスポンスをキャッシュに保存
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // オフライン時のフォールバック
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// プッシュ通知の受信
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('令和の虎 分析システム', options)
  );
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

// バックグラウンド同期
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-analysis') {
    event.waitUntil(syncAnalysisData());
  }
});

async function syncAnalysisData() {
  try {
    // バックグラウンドでデータを同期
    const response = await fetch('/api/v1/stats/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return response;
  } catch (error) {
    console.error('同期エラー:', error);
    throw error;
  }
}