#!/bin/bash
set -e

echo "=== Starting build process ==="

# Python依存関係インストール
echo "Installing Python dependencies..."
pip install -r requirements.txt

# フロントエンドビルド
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

# フロントエンドをfrontend_distにコピー
echo "Copying frontend build..."
rm -rf frontend_dist
cp -r frontend/dist frontend_dist

# 必要なディレクトリ作成
echo "Creating required directories..."
mkdir -p data logs static

echo "=== Build completed! ==="
