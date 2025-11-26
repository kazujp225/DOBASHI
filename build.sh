#!/bin/bash
set -e

# フロントエンドビルド
cd frontend
npm install
npm run build
cd ..

# バックエンド準備
pip install -r backend/requirements.txt

# フロントエンドをバックエンドにコピー
cp -r frontend/dist backend/frontend_dist

# 必要なディレクトリ作成
mkdir -p backend/data backend/logs backend/static

echo "Build completed!"
