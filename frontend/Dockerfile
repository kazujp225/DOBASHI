# Node.jsベースイメージ
FROM node:18-alpine as builder

# 作業ディレクトリの設定
WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci

# アプリケーションのビルド
COPY . .
RUN npm run build

# 実行用イメージ
FROM nginx:alpine

# Nginxの設定
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ポート公開
EXPOSE 3000

# Nginx起動
CMD ["nginx", "-g", "daemon off;"]