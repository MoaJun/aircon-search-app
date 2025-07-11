# Pythonの公式イメージをベースにする
FROM python:3.9-slim

# 作業ディレクトリを設定
WORKDIR /app

# 依存関係ファイルをコピーしてインストール
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

# アプリケーションコードをコピー
COPY . /app

# uvicornを起動するためのコマンド
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
