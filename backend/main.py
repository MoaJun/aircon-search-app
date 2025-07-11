import os
import requests
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# --- 設定 --------------------------------------------------------------------->

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://aircon-search-frontend1.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ★★★ APIキーの設定 ★★★
# Vercelの環境変数からAPIキーを読み込む
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# 新しいPlaces APIのエンドポイント
PLACES_API_URL = "https://places.googleapis.com/v1/places:searchText"

# --- データモデル --------------------------------------------------------------->

class Review(BaseModel):
    author: Optional[str] = None
    rating: int
    text: Optional[str] = None
    relative_time_description: Optional[str] = None

class Repairer(BaseModel):
    id: str
    name: str
    address: str
    rating: float
    reviews_count: int
    phone: Optional[str] = None
    website: Optional[str] = None
    reviews: List[Review] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None

# --- ダミーデータ（APIキーがない場合に使用） ------------------------------------->

dummy_repairers = [
    Repairer(
        id="dummy-1",
        name="【ダミー】快適エアサービス",
        address="東京都渋谷区神宮前1-1-1",
        rating=4.5,
        reviews_count=30,
        phone="03-1234-5678",
        website="https://example.com",
        reviews=[
            Review(author="テストユーザー", rating=5, text="これはダミーのレビューです。素晴らしいサービスでした！", relative_time_description="1週間前")
        ],
        latitude=35.661777,
        longitude=139.704051 # 適当な渋谷の座標
    ),
]

# --- APIエンドポイント --------------------------------------------------------->

@app.get("/api/repairers", response_model=dict)
async def get_repairers(zip_code: str, service_type: Optional[str] = None):
    """
    郵便番号に基づいてエアコン修理業者を検索するAPI (Places API (New) 対応版)
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"repairers": dummy_repairers}

    # --- 新しいPlaces APIのリクエスト形式 ---
    # 検索クエリを「サービス内容 郵便番号」の形式に変更し、精度を向上させる
    service_name = "エアコン修理" # Default service
    if service_type:
        if service_type == "クリーニング":
            service_name = "エアコンクリーニング"
        elif service_type == "修理":
            service_name = "エアコン修理"
        elif service_type == "設置":
            service_name = "エアコン設置"
    
    query = f"{service_name} {zip_code}"
    
    payload = {
        'textQuery': query,
        'languageCode': 'ja',
        'maxResultCount': 10
    }
    
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.reviews,places.location'
    }

    try:
        response = requests.post(PLACES_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

        # --- デバッグログ ---
        print("--- Google API Response ---")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print("---------------------------")

        results = []
        for place in data.get('places', []):
            
            place_reviews = place.get('reviews', [])
            reviews_list = []
            for review_data in place_reviews:
                reviews_list.append(
                    Review(
                        author=review_data.get('authorAttribution', {}).get('displayName'),
                        rating=review_data.get('rating'),
                        text=review_data.get('originalText', {}).get('text'),
                        relative_time_description=review_data.get('relativePublishTimeDescription')
                    )
                )

            location_data = place.get('location', {})
            latitude = location_data.get('latitude')
            longitude = location_data.get('longitude')

            results.append(
                Repairer(
                    id=place.get('id', 'N/A'),
                    name=place.get('displayName', {}).get('text', '情報なし'),
                    address=place.get('formattedAddress', '情報なし'),
                    rating=float(place.get('rating', 0)),
                    reviews_count=int(place.get('userRatingCount', 0)),
                    phone=place.get('nationalPhoneNumber'),
                    website=place.get('websiteUri'),
                    reviews=reviews_list,
                    latitude=latitude,
                    longitude=longitude
                )
            )
        
        results.sort(key=lambda x: x.rating, reverse=True)

        return {"repairers": results}

    except requests.exceptions.RequestException as e:
        return {"error": f"APIへの接続に失敗しました: {e}"}
    except Exception as e:
        return {"error": f"サーバー内部でエラーが発生しました: {e}"}
