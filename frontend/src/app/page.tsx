'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface Review {
  author: string;
  rating: number;
  text: string;
  relative_time_description: string;
}

interface Repairer {
  id: string;
  name: string;
  address: string;
  rating: number;
  reviews_count: number;
  phone?: string;
  website?: string;
  reviews: Review[];
  latitude?: number;
  longitude?: number;
}

export default function Home() {
  const [zipCode, setZipCode] = useState('');
  const [repairers, setRepairers] = useState<Repairer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string>('');
  const [expandedReviews, setExpandedReviews] = useState<string[]>([]);
  const [cache, setCache] = useState<Record<string, Repairer[]>>({}); // キャッシュ用のStateを追加
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);

  const toggleReviews = (repairerId: string) => {
    setExpandedReviews(prev =>
      prev.includes(repairerId)
        ? prev.filter(id => id !== repairerId)
        : [...prev, repairerId]
    );
  };

  useEffect(() => {
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      version: "weekly",
      libraries: ["places", "marker"], // markerライブラリを追加
    });

    loader.load().then(() => {
      if (mapRef.current) {
        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: { lat: 35.6895, lng: 139.6917 }, // 東京の中心
          zoom: 10,
          mapId: 'YOUR_MAP_ID' // Map ID for advanced markers
        });
      }
    });
  }, []);

  useEffect(() => {
    if (mapInstance.current && repairers.length > 0) {
      markers.current.forEach(marker => marker.setMap(null));
      markers.current = [];

      const bounds = new google.maps.LatLngBounds();

      repairers.forEach(repairer => {
        if (repairer.latitude && repairer.longitude) {
          const position = { lat: repairer.latitude, lng: repairer.longitude };
          const marker = new google.maps.Marker({
            position: position,
            map: mapInstance.current,
            title: repairer.name,
          });

          marker.addListener('click', () => {
            const element = document.getElementById(`repairer-${repairer.id}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.style.transition = 'background-color 0.5s ease';
              element.style.backgroundColor = '#e0f2fe';
              setTimeout(() => {
                element.style.backgroundColor = '';
              }, 1500);
            }
          });

          markers.current.push(marker);
          bounds.extend(position);
        }
      });

      if (!bounds.isEmpty()) {
        mapInstance.current.fitBounds(bounds);
      }
    }
  }, [repairers]);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    const cacheKey = `${zipCode}-${serviceType || 'all'}`;
    if (cache[cacheKey]) {
      setRepairers(cache[cacheKey]);
      setLoading(false);
      return; // キャッシュから結果をセットして終了
    }

    try {
      const queryParams = new URLSearchParams({ zip_code: zipCode });
      if (serviceType) {
        queryParams.append('service_type', serviceType);
      }
      const response = await fetch(`http://localhost:8000/api/repairers?${queryParams.toString()}`);
      
      if (!response.ok) {
        // HTTPエラーの場合
        const errorText = await response.text();
        throw new Error(`サーバーエラーが発生しました (ステータス: ${response.status}). 詳細: ${errorText.substring(0, 100)}...`);
      }
      
      const data = await response.json();
      if (data.error) {
        // バックエンドからのカスタムエラーメッセージがある場合
        throw new Error(`検索に失敗しました: ${data.error}`);
      }
      
      const newRepairers = data.repairers || [];
      setRepairers(newRepairers);
      setCache(prevCache => ({
        ...prevCache,
        [cacheKey]: newRepairers,
      }));

    } catch (e: unknown) {
      setError(`検索中にエラーが発生しました: ${e instanceof Error ? e.message : '不明なエラー'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleZipCodeSearch = async () => {
    if (!zipCode) {
      setError('郵便番号を入力してください。');
      return;
    }
    if (!mapInstance.current) {
      setError('地図が初期化されていません。しばらくお待ちください。');
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: zipCode, componentRestrictions: { country: 'JP' } }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        mapInstance.current?.setCenter(location);
        mapInstance.current?.setZoom(12);
        setError(null);
      } else {
        let errorMessage = '郵便番号から場所を特定できませんでした。';
        if (status === 'ZERO_RESULTS') {
          errorMessage = '入力された郵便番号では場所が見つかりませんでした。正しい郵便番号かご確認ください。';
        } else if (status === 'OVER_QUERY_LIMIT') {
          errorMessage = '地図の検索回数が上限に達しました。しばらくしてからお試しください。';
        } else if (status === 'REQUEST_DENIED') {
          errorMessage = '地図サービスへのアクセスが拒否されました。APIキーの設定をご確認ください。';
        } else if (status === 'INVALID_REQUEST') {
          errorMessage = '無効なリクエストです。郵便番号の形式をご確認ください。';
        }
        setError(errorMessage);
      }
    });
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            エアコン修理業者検索
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Search Results */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="space-y-6">
              {loading && (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-teal-500"></div>
                </div>
              )}
              {!loading && repairers.length > 0 ? (
                repairers.map((repairer) => (
                  <div 
                    key={repairer.id} 
                    id={`repairer-${repairer.id}`}
                    className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex flex-col transform hover:-translate-y-1"
                  >
                    <h2 className="text-2xl font-semibold text-slate-800 mb-2">{repairer.name}</h2>
                    <p className="text-slate-600 text-sm mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                      {repairer.address}
                    </p>
                    <div className="flex items-center mb-4">
                      <span className="text-yellow-400 text-xl mr-1">{'★'.repeat(Math.floor(repairer.rating))}</span>
                      <span className="text-slate-300 text-xl mr-2">{'★'.repeat(5 - Math.floor(repairer.rating))}</span>
                      <span className="text-slate-600 text-sm font-medium">{repairer.rating.toFixed(1)}</span>
                      <span className="text-slate-500 text-sm ml-2">({repairer.reviews_count}件のレビュー)</span>
                    </div>
                    
                    <div className="text-sm mb-4 space-y-2">
                      {repairer.phone && 
                        <a href={`tel:${repairer.phone}`} className="inline-flex items-center text-teal-600 hover:text-teal-800 transition-colors">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                          {repairer.phone}
                        </a>
                      }
                      {repairer.website && 
                        <a href={repairer.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-teal-600 hover:text-teal-800 transition-colors ml-4">
                           <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                          ウェブサイト
                        </a>
                      }
                    </div>

                    {repairer.reviews && repairer.reviews.length > 0 && (
                      <div className="border-t border-slate-200 pt-4 mt-auto">
                        <h4 className="font-semibold text-slate-700 text-sm mb-3">最新のレビュー</h4>
                        <div className="text-slate-600 text-sm mb-3">
                          <p className="mb-1">
                            <span className="text-yellow-400">{'★'.repeat(repairer.reviews[0].rating)}</span>
                            <span className="ml-2 font-medium text-slate-800">{repairer.reviews[0].author}</span>
                            <span className="text-slate-500 ml-2">({repairer.reviews[0].relative_time_description})</span>
                          </p>
                          <p className="line-clamp-3">{repairer.reviews[0].text}</p>
                        </div>
                        {repairer.reviews.length > 1 && (
                          <button 
                            onClick={() => toggleReviews(repairer.id)}
                            className="text-teal-600 hover:text-teal-800 text-sm font-medium transition-colors"
                          >
                            {expandedReviews.includes(repairer.id) ? 
                              'レビューを閉じる' : 
                              `他${repairer.reviews.length - 1}件のレビューを見る`
                            }
                          </button>
                        )}
                        {expandedReviews.includes(repairer.id) && (
                          <div className="mt-4 space-y-4">
                            {repairer.reviews.slice(1).map((review, index) => (
                              <div key={index} className="text-slate-600 text-sm border-t border-slate-200 pt-3">
                                <p className="mb-1">
                                  <span className="text-yellow-400">{'★'.repeat(review.rating)}</span>
                                  <span className="ml-2 font-medium text-slate-800">{review.author}</span>
                                  <span className="text-slate-500 ml-2">({review.relative_time_description})</span>
                                </p>
                                <p>{review.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                !loading && <p className="text-center text-slate-500 py-16">お住まいの地域の郵便番号を入力して、業者を検索しましょう。</p>
              )}
            </div>
          </div>

          {/* Right Column: Map and Search */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="sticky top-24 space-y-8">
              {/* Search Form */}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="mb-4">
                  <label htmlFor="zipCode" className="block text-slate-700 text-sm font-bold mb-2">
                    郵便番号
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      id="zipCode"
                      className="shadow-sm appearance-none border border-slate-300 rounded-lg w-full py-2 px-3 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="例: 150-0001 (ハイフン必須)"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                    />
                    <button
                      onClick={handleZipCodeSearch}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 flex-shrink-0 transition-colors"
                      disabled={loading}
                      aria-label="地図を移動"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="serviceType" className="block text-slate-700 text-sm font-bold mb-2">
                    サービス内容
                  </label>
                  <select
                    id="serviceType"
                    className="shadow-sm appearance-none border border-slate-300 rounded-lg w-full py-2 px-3 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                  >
                    <option value="">全て</option>
                    <option value="クリーニング">クリーニング</option>
                    <option value="修理">修理</option>
                    <option value="設置">設置</option>
                  </select>
                </div>

                <button
                  onClick={handleSearch}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 w-full transition-colors duration-300 disabled:bg-teal-300"
                  disabled={loading}
                >
                  {loading ? '検索中...' : 'このエリアで業者を探す'}
                </button>
                {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              </div>

              {/* Map Area */}
              <div ref={mapRef} className="w-full h-96 lg:h-[32rem] bg-slate-200 rounded-xl shadow-md overflow-hidden"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
