# Node.jsの公式イメージをベースにする
FROM node:18

# ネイティブモジュールのビルドに必要なツールは通常不要になるが、念のため残す
# RUN apt-get update && apt-get install -y build-essential python3

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# アプリケーションコードをコピー
COPY . .

# Next.jsの開発サーバーを起動
CMD ["npm", "run", "dev"]
