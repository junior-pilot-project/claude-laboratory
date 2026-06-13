const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────
// 스트리밍 헬퍼: 텍스트를 3글자씩 끊어 SSE 전송
// ─────────────────────────────────────────────
async function streamText(res, text, chunkSize = 3, delayMs = 18) {
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

// ─────────────────────────────────────────────
// 시스템 프롬프트 (실제 Claude 호출 시 사용)
// ─────────────────────────────────────────────
function buildSystemPrompt() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  return `당신은 TripMind, 전문 AI 여행 플래너입니다. 현재 날짜: ${dateStr}
사용자의 여행 취향·예산을 파악해 현재 시즌에 최적화된 여행지를 추천하세요.
추천 시 아래 JSON 블록을 답변 뒤에 반드시 포함하세요.
\`\`\`json
{ "type": "recommendations", "destinations": [ ... ] }
\`\`\``;
}

// ─────────────────────────────────────────────
// Mock 시나리오 (키워드 → 미리 작성된 응답)
// retrying은 가장 마지막에 체크 (다른 키워드와 중복 방지)
// ─────────────────────────────────────────────
const MOCK_SCENARIOS = [
  {
    name: 'southeast_asia',
    keywords: ['동남아', '태국', '방콕', '발리', '베트남', '싱가포르', '더위', '열대', '가성비', '저렴한', '100만원'],
    response: `6월 동남아는 우기 시작이지만 그게 오히려 기회예요! ✈️

비수기라 항공권과 숙박이 크게 저렴해지고, 오전엔 맑고 오후에만 소나기가 내려 관광에 큰 지장은 없어요. 특히 실내 관광이 많은 방콕은 오히려 6~8월이 가성비 여행 최적 시즌이에요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "bangkok",
      "city": "방콕",
      "city_en": "Bangkok",
      "country": "태국",
      "emoji_flag": "🇹🇭",
      "reason": "6월 비수기 항공 특가 + 에어컨 빵빵한 쇼핑몰·사원 관광으로 오히려 인기",
      "season_score": 82,
      "estimated_flight_krw": 490000,
      "style_tags": ["도시", "음식", "쇼핑"],
      "highlights": ["왓 포 사원", "짜오프라야 강", "짜뚜짝 시장"],
      "best_season_reason": "비수기 특가로 항공+숙박 70만원대 가능, 물가도 동남아 최저급"
    },
    {
      "id": "hanoi",
      "city": "하노이",
      "city_en": "Hanoi",
      "country": "베트남",
      "emoji_flag": "🇻🇳",
      "reason": "쌀국수·반미·분짜… 음식만으로도 충분히 가볼 만한 곳, 물가 최강",
      "season_score": 75,
      "estimated_flight_krw": 420000,
      "style_tags": ["음식", "역사", "카페"],
      "highlights": ["호안끼엠 호수", "구시가지 36거리", "하롱베이 당일치기"],
      "best_season_reason": "6월 기온 30도 내외, 우기지만 짧은 스콜 형태라 여행 가능"
    },
    {
      "id": "bali",
      "city": "발리",
      "city_en": "Bali",
      "country": "인도네시아",
      "emoji_flag": "🇮🇩",
      "reason": "6~8월이 발리 건기 성수기! 일 년 중 날씨가 가장 좋은 시즌이에요",
      "season_score": 93,
      "estimated_flight_krw": 560000,
      "style_tags": ["해변", "자연", "힐링"],
      "highlights": ["따나롯 사원", "우붓 라이스테라스", "짐바란 선셋"],
      "best_season_reason": "6~8월이 발리 최성수기, 건기라 맑고 습도 낮아 완벽한 날씨"
    }
  ]
}
\`\`\``
  },
  {
    name: 'japan',
    keywords: ['일본', '도쿄', '교토', '오사카', '후지산', '스시', '라멘', '애니', '만화'],
    response: `일본 여행이라면 6월은 조금 주의가 필요해요! 🗾

6월은 일본 장마철(쓰유)이지만, 오히려 관광객이 줄어 유명 관광지를 여유롭게 즐길 수 있고, 항공요금도 상대적으로 저렴해요. 특히 교토의 수국 시즌은 6월에만 볼 수 있는 장면이에요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "tokyo",
      "city": "도쿄",
      "city_en": "Tokyo",
      "country": "일본",
      "emoji_flag": "🇯🇵",
      "reason": "6월 장마도 도쿄에선 오후에만 비가 오는 편, 쇼핑·미식·문화 모두 최강",
      "season_score": 76,
      "estimated_flight_krw": 520000,
      "style_tags": ["도시", "음식", "쇼핑"],
      "highlights": ["시부야 스크램블", "아사쿠사 센소지", "신주쿠 골든가이"],
      "best_season_reason": "6월 장마시즌이지만 관광객 적어 오히려 쾌적, 미슐랭 예약도 쉬운 시즌"
    },
    {
      "id": "kyoto",
      "city": "교토",
      "city_en": "Kyoto",
      "country": "일본",
      "emoji_flag": "🇯🇵",
      "reason": "6월 수국 시즌! 텟코지·미무로토지의 수국은 이 시기에만 볼 수 있어요",
      "season_score": 81,
      "estimated_flight_krw": 510000,
      "style_tags": ["역사", "전통", "자연"],
      "highlights": ["기요미즈데라", "아라시야마 대나무숲", "후시미이나리"],
      "best_season_reason": "수국 시즌 6월은 교토만의 숨겨진 비수기 보석 같은 시기"
    }
  ]
}
\`\`\``
  },
  {
    name: 'europe',
    keywords: ['유럽', '파리', '로마', '바르셀로나', '암스테르담', '런던', '스페인', '이탈리아', '프랑스', '서양'],
    response: `유럽이라면 6월이 사실 최고 시즌이에요! ✈️🌞

낮이 아주 길고(파리 기준 밤 10시까지 밝아요), 날씨도 맑고 따뜻해서 야외 카페와 광장이 생동감 넘쳐요. 성수기라 비용은 올라가지만, 유럽 여행의 모든 걸 경험하기엔 지금이 최적이에요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "barcelona",
      "city": "바르셀로나",
      "city_en": "Barcelona",
      "country": "스페인",
      "emoji_flag": "🇪🇸",
      "reason": "가우디 건축 + 해변 + 타파스 바, 유럽에서 가장 핫한 도시",
      "season_score": 94,
      "estimated_flight_krw": 980000,
      "style_tags": ["건축", "해변", "음식"],
      "highlights": ["사그라다 파밀리아", "구엘 공원", "바르셀로네타 해변"],
      "best_season_reason": "6월 평균 23도, 해변과 건축 관광 모두 완벽한 시즌"
    },
    {
      "id": "paris",
      "city": "파리",
      "city_en": "Paris",
      "country": "프랑스",
      "emoji_flag": "🇫🇷",
      "reason": "6월 파리는 밤 10시까지 밝고, 테라스 카페와 센강 크루즈가 환상적이에요",
      "season_score": 91,
      "estimated_flight_krw": 1050000,
      "style_tags": ["문화", "예술", "로맨틱"],
      "highlights": ["에펠탑 야경", "루브르 박물관", "몽마르트르 언덕"],
      "best_season_reason": "6~8월이 파리 최고 시즌, 긴 낮과 야외 문화 행사 풍성"
    },
    {
      "id": "amsterdam",
      "city": "암스테르담",
      "city_en": "Amsterdam",
      "country": "네덜란드",
      "emoji_flag": "🇳🇱",
      "reason": "운하 크루즈, 자전거 여행, 세계 최고의 미술관이 모여있는 유럽의 숨은 보석",
      "season_score": 88,
      "estimated_flight_krw": 1020000,
      "style_tags": ["예술", "문화", "자전거"],
      "highlights": ["반 고흐 미술관", "운하 크루즈", "안네 프랑크 하우스"],
      "best_season_reason": "6월 네덜란드는 하루 17시간 햇빛, 자전거 여행 최적 시즌"
    }
  ]
}
\`\`\``
  },
  {
    name: 'beach',
    keywords: ['해변', '바다', '리조트', '휴양', '수영', '스노클링', '다이빙', '모래', '섬', '열대', '하와이'],
    response: `해변 여행이라면 이 세 곳이 단연 최고예요! 🏖️

맑은 바다·황금 백사장·완벽한 일몰 — 어느 것을 원해도 다 있어요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "hawaii",
      "city": "하와이",
      "city_en": "Hawaii",
      "country": "미국",
      "emoji_flag": "🌺",
      "reason": "태평양의 진짜 낙원! 와이키키 비치부터 노스쇼어 서핑까지, 해변 여행의 끝판왕",
      "season_score": 95,
      "estimated_flight_krw": 1100000,
      "style_tags": ["해변", "서핑", "허니문"],
      "highlights": ["와이키키 비치", "다이아몬드 헤드 하이킹", "노스쇼어 서핑"],
      "best_season_reason": "연중 온화하지만 4~9월 건기가 최적, 파도와 날씨 모두 완벽"
    },
    {
      "id": "bali",
      "city": "발리",
      "city_en": "Bali",
      "country": "인도네시아",
      "emoji_flag": "🇮🇩",
      "reason": "6~8월 건기 성수기, 풀빌라+선셋 바베큐+스파, 가성비 최강 해변 휴양지",
      "season_score": 95,
      "estimated_flight_krw": 560000,
      "style_tags": ["해변", "힐링", "서핑"],
      "highlights": ["꾸따 비치", "스미냑 선셋", "누사페니다 스노클링"],
      "best_season_reason": "건기 6~8월은 발리 최성수기, 맑은 바다와 저렴한 풀빌라가 동시에"
    },
    {
      "id": "phuket",
      "city": "푸켓",
      "city_en": "Phuket",
      "country": "태국",
      "emoji_flag": "🇹🇭",
      "reason": "에메랄드 바다의 피피 섬, 스노클링·다이빙·선셋 크루즈까지 완벽한 해변 패키지",
      "season_score": 88,
      "estimated_flight_krw": 510000,
      "style_tags": ["해변", "섬", "다이빙"],
      "highlights": ["피피 섬", "팡아만 카약킹", "까타 비치"],
      "best_season_reason": "11~4월 건기 시즌 최고, 피피섬 당일 투어는 평생 기억에 남아요"
    }
  ]
}
\`\`\``
  },
  {
    name: 'cityscape_night',
    keywords: ['야경', '현대도시', '홍콩', '두바이', '쇼핑', '럭셔리'],
    response: `도시적인 매력과 화려한 야경을 원하신다면 이 세 곳을 추천해요! 🌃

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "hong_kong",
      "city": "홍콩",
      "city_en": "Hong Kong",
      "country": "홍콩",
      "emoji_flag": "🇭🇰",
      "reason": "빅토리아 피크의 야경은 전 세계 1위, 딤섬부터 파인다이닝까지 미식의 도시",
      "season_score": 75,
      "estimated_flight_krw": 540000,
      "style_tags": ["야경", "쇼핑", "음식"],
      "highlights": ["빅토리아 피크", "스타의 거리 야경", "몽콕 야시장"],
      "best_season_reason": "6월 홍콩은 덥고 습하지만 야경과 실내 쇼핑은 오히려 쾌적"
    },
    {
      "id": "singapore",
      "city": "싱가포르",
      "city_en": "Singapore",
      "country": "싱가포르",
      "emoji_flag": "🇸🇬",
      "reason": "마리나 베이 샌즈 야경, 가든스 바이 더 베이, 다양한 문화가 공존하는 도시국가",
      "season_score": 79,
      "estimated_flight_krw": 580000,
      "style_tags": ["도시", "야경", "음식"],
      "highlights": ["마리나 베이 샌즈", "가든스 바이 더 베이", "호커센터"],
      "best_season_reason": "연중 덥고 비가 오지만 실내 시설이 세계 최고, 환승 포함 가성비"
    },
    {
      "id": "dubai",
      "city": "두바이",
      "city_en": "Dubai",
      "country": "아랍에미리트",
      "emoji_flag": "🇦🇪",
      "reason": "버즈 칼리파, 사막 사파리, 초호화 쇼핑몰, 모든 게 스케일이 다른 도시",
      "season_score": 68,
      "estimated_flight_krw": 760000,
      "style_tags": ["럭셔리", "사막", "야경"],
      "highlights": ["버즈 칼리파 전망대", "두바이 몰 분수쇼", "사막 사파리"],
      "best_season_reason": "6월 두바이는 42도로 덥지만 모든 것이 에어컨, 호텔 가격 비수기 저렴"
    }
  ]
}
\`\`\``
  },
  {
    name: 'food_trip',
    keywords: ['음식', '맛집', '미식', '먹방', '현지음식', '길거리음식', '스시', '파스타', '라멘', '딤섬', '쌀국수'],
    response: `미식 여행이라면 이 세 도시가 압도적이에요! 🍜🍕🍣

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "tokyo",
      "city": "도쿄",
      "city_en": "Tokyo",
      "country": "일본",
      "emoji_flag": "🇯🇵",
      "reason": "미슐랭 레스토랑 수 세계 1위 도시! 라멘부터 스시 오마카세까지 음식 천국",
      "season_score": 76,
      "estimated_flight_krw": 520000,
      "style_tags": ["음식", "미식", "일식"],
      "highlights": ["츠키지 시장", "신주쿠 이자카야", "라멘 골목"],
      "best_season_reason": "장마철이지만 음식 여행은 날씨 무관, 미슐랭 예약도 쉬운 시즌"
    },
    {
      "id": "bangkok",
      "city": "방콕",
      "city_en": "Bangkok",
      "country": "태국",
      "emoji_flag": "🇹🇭",
      "reason": "팟타이, 똠얌꿍, 망고스티키라이스, 길거리 음식만으로도 여행이 완성되는 곳",
      "season_score": 82,
      "estimated_flight_krw": 490000,
      "style_tags": ["음식", "길거리", "야시장"],
      "highlights": ["오르오르 야시장", "짜뚜짝 시장", "차이나타운 야오와랏"],
      "best_season_reason": "비수기라 저렴하고, 방콕 길거리 음식은 계절 무관 24시간 성업"
    },
    {
      "id": "rome",
      "city": "로마",
      "city_en": "Rome",
      "country": "이탈리아",
      "emoji_flag": "🇮🇹",
      "reason": "정통 까르보나라, 크림 젤라또, 피자 나폴리타나, 이탈리아 음식의 성지",
      "season_score": 88,
      "estimated_flight_krw": 1080000,
      "style_tags": ["음식", "역사", "카페"],
      "highlights": ["나보나 광장 젤라또", "트라스테베레 레스토랑 골목", "Campo de Fiori 시장"],
      "best_season_reason": "6월 로마는 28도 쾌청, 야외 레스토랑에서 먹는 파스타가 최고"
    }
  ]
}
\`\`\``
  },
  {
    name: 'romantic',
    keywords: ['커플', '허니문', '신혼', '로맨틱', '둘이', '데이트', '감성'],
    response: `커플 여행이라면 분위기와 설렘이 중요하죠! 💑✨

두 분이 오래 기억할 수 있는 특별한 순간을 만들어 줄 세 곳을 골랐어요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "paris",
      "city": "파리",
      "city_en": "Paris",
      "country": "프랑스",
      "emoji_flag": "🇫🇷",
      "reason": "에펠탑 야경, 센강 크루즈, 와인과 함께하는 저녁, 커플 여행 1위 도시",
      "season_score": 91,
      "estimated_flight_krw": 1050000,
      "style_tags": ["로맨틱", "예술", "음식"],
      "highlights": ["에펠탑 야경", "몽마르트르 예술 골목", "센강 크루즈 디너"],
      "best_season_reason": "6월 파리는 가장 낭만적인 시즌, 긴 일몰과 야외 카페가 완벽"
    },
    {
      "id": "bali",
      "city": "발리",
      "city_en": "Bali",
      "country": "인도네시아",
      "emoji_flag": "🇮🇩",
      "reason": "수영장 딸린 풀빌라, 짐바란 선셋 바베큐, 우붓 스파, 허니문의 성지",
      "season_score": 95,
      "estimated_flight_krw": 560000,
      "style_tags": ["허니문", "리조트", "스파"],
      "highlights": ["짐바란 선셋 바베큐", "우붓 풀빌라 스파", "따나롯 사원 일몰"],
      "best_season_reason": "6~8월 발리 건기 성수기, 선셋이 1년 중 가장 아름다운 계절"
    },
    {
      "id": "hawaii",
      "city": "하와이",
      "city_en": "Hawaii",
      "country": "미국",
      "emoji_flag": "🌺",
      "reason": "허니문의 최종 목적지! 와이키키 선셋, 루아우 디너쇼, 세계 1위 허니문 섬",
      "season_score": 95,
      "estimated_flight_krw": 1100000,
      "style_tags": ["허니문", "해변", "자연"],
      "highlights": ["와이키키 비치 선셋", "루아우 디너쇼", "헬기 경관 투어"],
      "best_season_reason": "연중 온화한 날씨, 세계 허니문 1순위로 꼽히는 영원한 낭만의 섬"
    }
  ]
}
\`\`\``
  },
  {
    name: 'history_culture',
    keywords: ['역사', '문화', '유적', '박물관', '사원', '건축', '고대', '문명'],
    response: `역사와 문화 여행이라면 이 세 곳이 전 세계를 통틀어도 최고예요! 🏛️

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "rome",
      "city": "로마",
      "city_en": "Rome",
      "country": "이탈리아",
      "emoji_flag": "🇮🇹",
      "reason": "콜로세움, 바티칸, 판테온, 도시 전체가 박물관인 영원의 도시",
      "season_score": 88,
      "estimated_flight_krw": 1080000,
      "style_tags": ["역사", "건축", "예술"],
      "highlights": ["콜로세움", "바티칸 시스티나 성당", "포로 로마노"],
      "best_season_reason": "6월은 무더위 전 황금 시즌, 아침 일찍 유적지 방문 추천"
    },
    {
      "id": "istanbul",
      "city": "이스탄불",
      "city_en": "Istanbul",
      "country": "튀르키예",
      "emoji_flag": "🇹🇷",
      "reason": "비잔틴+오스만 제국 2000년 역사가 한 도시에, 아야소피아는 세계 불가사의",
      "season_score": 88,
      "estimated_flight_krw": 820000,
      "style_tags": ["역사", "문화", "건축"],
      "highlights": ["아야소피아", "톱카프 궁전", "그랜드 바자르"],
      "best_season_reason": "6~7월 이스탄불 최고 시즌, 유적지 야간 조명이 환상적"
    },
    {
      "id": "kyoto",
      "city": "교토",
      "city_en": "Kyoto",
      "country": "일본",
      "emoji_flag": "🇯🇵",
      "reason": "1000년 이상 일본의 수도였던 곳, 절·신사·게이샤 문화가 살아있는 진짜 일본",
      "season_score": 81,
      "estimated_flight_krw": 510000,
      "style_tags": ["전통", "역사", "자연"],
      "highlights": ["기요미즈데라", "후시미이나리 신사", "아라시야마 대나무숲"],
      "best_season_reason": "수국 시즌 6월은 관광객 적고 비 내리는 절의 운치가 각별"
    }
  ]
}
\`\`\``
  },
  {
    name: 'short_trip',
    keywords: ['2박', '3박', '주말', '짧은', '빠른', '가까운', '근거리', '당일', '4일'],
    response: `짧은 여행이라면 한국에서 가까운 곳이 최고예요! ⚡

비행 시간이 짧아야 본 여행을 더 즐길 수 있으니, 2~4시간 이내로 갈 수 있는 곳들로 골랐어요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "taipei",
      "city": "타이베이",
      "city_en": "Taipei",
      "country": "대만",
      "emoji_flag": "🇹🇼",
      "reason": "인천에서 2.5시간, 시차 없음, 야시장·맛집·온천 모두 3박 4일에 가능",
      "season_score": 76,
      "estimated_flight_krw": 380000,
      "style_tags": ["음식", "야시장", "근거리"],
      "highlights": ["스린 야시장", "지우펀", "예류 지질공원"],
      "best_season_reason": "6월 비가 있지만 3박 정도면 충분히 즐길 수 있어요"
    },
    {
      "id": "tokyo",
      "city": "도쿄",
      "city_en": "Tokyo",
      "country": "일본",
      "emoji_flag": "🇯🇵",
      "reason": "인천에서 2시간 30분, 3박 4일로도 시부야·아사쿠사·하라주쿠 충분히 커버",
      "season_score": 76,
      "estimated_flight_krw": 520000,
      "style_tags": ["도시", "음식", "쇼핑"],
      "highlights": ["시부야 스크램블", "아사쿠사", "오모테산도"],
      "best_season_reason": "항공편 많아 당일출발 가능, 교통 패스로 효율적인 3박 여행"
    },
    {
      "id": "hong_kong",
      "city": "홍콩",
      "city_en": "Hong Kong",
      "country": "홍콩",
      "emoji_flag": "🇭🇰",
      "reason": "3.5시간 비행, 딤섬 아침+야경+쇼핑을 2박 3일에 완벽하게 즐길 수 있어요",
      "season_score": 74,
      "estimated_flight_krw": 540000,
      "style_tags": ["도시", "야경", "음식"],
      "highlights": ["빅토리아 피크", "침사추이 야경", "몽콕 딤섬"],
      "best_season_reason": "짧은 여행에도 압축적으로 즐길 수 있는 콤팩트한 도시"
    }
  ]
}
\`\`\``
  },
  {
    name: 'budget_tight',
    keywords: ['30만', '40만', '학생', '배낭', '알뜰', '절약', '무조건 싸게', '최저 예산'],
    response: `최저 예산이라면 이 두 곳이 단연 최고예요! 💸

항공권 30~40만원대에 물가도 저렴해서, 총 경비 70~80만원으로도 충분한 여행이 가능해요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "hanoi",
      "city": "하노이",
      "city_en": "Hanoi",
      "country": "베트남",
      "emoji_flag": "🇻🇳",
      "reason": "항공 40만원대 + 숙박 1박 2~3만원 + 끼니 3~5천원, 전체 예산 60만원도 가능",
      "season_score": 74,
      "estimated_flight_krw": 420000,
      "style_tags": ["배낭", "음식", "역사"],
      "highlights": ["호안끼엠 호수", "36거리 구시가지", "하롱베이 1박 투어"],
      "best_season_reason": "비수기라 항공·숙박 최저가, 물가는 동남아 최강"
    },
    {
      "id": "taipei",
      "city": "타이베이",
      "city_en": "Taipei",
      "country": "대만",
      "emoji_flag": "🇹🇼",
      "reason": "항공 35만원대, 야시장 음식 1000~3000원, 교통비 초저렴한 가성비 왕",
      "season_score": 74,
      "estimated_flight_krw": 370000,
      "style_tags": ["야시장", "음식", "근거리"],
      "highlights": ["스린 야시장", "지우펀", "용산사"],
      "best_season_reason": "저비용항공사 많아 얼리버드 티켓 20~30만원대도 가능"
    }
  ]
}
\`\`\``
  },
  {
    name: 'usa',
    keywords: ['미국', '뉴욕', '엘에이', '로스앤젤레스', '라스베이거스', '라스베가스', '미주', '아메리카', 'nyc', 'la여행'],
    response: `미국 여행이라면 도시마다 분위기가 완전히 달라요! 🗽

뉴욕의 세계적 문화, 하와이의 열대 낙원, 라스베이거스의 화려함 — 원하는 스타일에 따라 추천이 달라져요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "new_york",
      "city": "뉴욕",
      "city_en": "New York",
      "country": "미국",
      "emoji_flag": "🇺🇸",
      "reason": "브로드웨이 뮤지컬, 메트 박물관, 센트럴 파크, 세계 문화의 심장부",
      "season_score": 88,
      "estimated_flight_krw": 1300000,
      "style_tags": ["도시", "예술", "음식"],
      "highlights": ["타임스퀘어", "센트럴 파크", "브루클린 브리지"],
      "best_season_reason": "봄(4~5월)과 가을(9~10월)이 최고 시즌, 날씨 완벽하고 관광 쾌적"
    },
    {
      "id": "hawaii",
      "city": "하와이",
      "city_en": "Hawaii",
      "country": "미국",
      "emoji_flag": "🌺",
      "reason": "태평양 한가운데 열대 낙원, 서핑·스노클링·화산 국립공원까지 자연의 극치",
      "season_score": 93,
      "estimated_flight_krw": 1100000,
      "style_tags": ["해변", "자연", "허니문"],
      "highlights": ["와이키키 비치", "다이아몬드 헤드 하이킹", "할레아칼라 일출"],
      "best_season_reason": "연중 온화, 4~9월 건기가 최적. 허니문 세계 1순위 여행지"
    },
    {
      "id": "las_vegas",
      "city": "라스베이거스",
      "city_en": "Las Vegas",
      "country": "미국",
      "emoji_flag": "🇺🇸",
      "reason": "세계 최대 카지노·쇼·뷔페의 도시, 그랜드 캐니언 당일 투어도 가능",
      "season_score": 85,
      "estimated_flight_krw": 1300000,
      "style_tags": ["카지노", "엔터테인먼트", "쇼"],
      "highlights": ["라스베이거스 스트립", "벨라지오 분수쇼", "그랜드 캐니언 투어"],
      "best_season_reason": "봄(3~5월)과 가을(9~11월)이 최적, 여름 47도 극한 더위 주의"
    }
  ]
}
\`\`\``
  },
  // retrying은 항상 마지막에 체크 — "추천" 등 일반 키워드와 충돌 방지
  {
    name: 'retrying',
    keywords: ['다시추천', '재추천', '다른 여행지', '다른 곳', '바꿔줘', '다른걸로'],
    response: `네, 다른 스타일의 여행지로 다시 추천해 드릴게요! 🗺️

이번엔 조금 색다른 매력의 도시들을 골랐어요. 덜 알려졌지만 가성비와 만족도가 높은 곳들이에요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "taipei",
      "city": "타이베이",
      "city_en": "Taipei",
      "country": "대만",
      "emoji_flag": "🇹🇼",
      "reason": "한국에서 2시간 30분, 야시장·음식·자연이 모두 있는 가성비 1위 여행지예요",
      "season_score": 78,
      "estimated_flight_krw": 380000,
      "style_tags": ["음식", "야시장", "자연"],
      "highlights": ["스펀 폭포", "지우펀", "스린 야시장"],
      "best_season_reason": "6월은 비가 있지만 관광객 적고 항공료 저렴한 시즌"
    },
    {
      "id": "istanbul",
      "city": "이스탄불",
      "city_en": "Istanbul",
      "country": "튀르키예",
      "emoji_flag": "🇹🇷",
      "reason": "동서양이 만나는 유일한 도시. 역사·음식·야경 모두 압도적이에요",
      "season_score": 88,
      "estimated_flight_krw": 820000,
      "style_tags": ["역사", "문화", "음식"],
      "highlights": ["아야소피아", "그랜드 바자르", "보스포루스 크루즈"],
      "best_season_reason": "6~7월이 날씨 최고, 성수기지만 그 가치가 충분해요"
    },
    {
      "id": "sydney",
      "city": "시드니",
      "city_en": "Sydney",
      "country": "호주",
      "emoji_flag": "🇦🇺",
      "reason": "6월은 호주 겨울이지만 온화하고 관광객 적어 오히려 여유롭게 즐길 수 있어요",
      "season_score": 74,
      "estimated_flight_krw": 1150000,
      "style_tags": ["자연", "도시", "해변"],
      "highlights": ["오페라하우스", "본다이 비치", "블루마운틴"],
      "best_season_reason": "남반구라 6월은 겨울이지만 15~18도로 관광하기 쾌적해요"
    }
  ]
}
\`\`\``
  },
];

// ─────────────────────────────────────────────
// 기본 응답 (키워드 매칭 없을 때 순환)
// ─────────────────────────────────────────────
const DEFAULT_RESPONSES = [
  `어떤 여행을 꿈꾸고 계신가요? 😊

조금만 더 알려주시면 딱 맞는 여행지를 찾아드릴게요!

- **예산**은 어느 정도 생각하고 계세요? (1인 기준)
- **기간**은 어떻게 되나요? (3박 4일, 5박 6일 등)
- **선호하는 스타일**이 있나요? (휴양, 맛집, 역사, 액티비티 등)`,

  `조금 더 구체적으로 말씀해 주시면 바로 추천해 드릴 수 있어요! 🗺️

이런 식으로 물어보셔도 좋아요:
- _"동남아 5박 100만원대 추천해줘"_
- _"유럽 가을 여행 어디가 좋아?"_
- _"해변에서 쉬고 싶어"_
- _"커플 여행 로맨틱한 곳"_
- _"일본 음식 여행"_`,

  `현재 **6월**이라 시즌별로 최적지가 달라져요! ✈️

- **발리**: 6~8월이 건기 성수기, 지금이 최고예요
- **유럽(바르셀로나·파리)**: 6~8월 황금 시즌
- **동남아(방콕·하노이)**: 비수기라 항공+숙박 저렴
- **일본(교토)**: 장마철이지만 수국 시즌으로 운치 있어요

어디가 끌리시나요?`,

  `혹시 이런 여행 스타일 중 마음에 드는 게 있으신가요? 😊

🏖️ **휴양** — 발리, 푸켓, 칸쿤
🍜 **미식** — 도쿄, 방콕, 로마
🏛️ **역사·문화** — 로마, 이스탄불, 교토
🌃 **도시·야경** — 홍콩, 싱가포르, 두바이
💑 **커플·로맨틱** — 파리, 발리, 이스탄불`,

  `예산 범위를 알려주시면 더 정확하게 추천해 드릴 수 있어요! 💰

1인 기준 대략적인 총 예산이 어느 정도인가요?
- **60~80만원** → 하노이, 타이베이 (근거리 가성비)
- **100~150만원** → 방콕, 발리, 도쿄
- **150~250만원** → 유럽, 두바이, 시드니
- **250만원 이상** → 뉴욕, 칸쿤, 몰디브급`,
];

// ─────────────────────────────────────────────
// 계절별 시나리오 (월/계절 키워드 매칭용)
// ─────────────────────────────────────────────
const SEASON_SCENARIOS = {
  winter: `겨울 여행이라면 따뜻한 곳으로 도망치거나, 눈을 마음껏 즐기거나! ❄️

12~2월 겨울 시즌에 강력 추천하는 세 곳이에요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "sapporo",
      "city": "삿포로",
      "city_en": "Sapporo",
      "country": "일본",
      "emoji_flag": "🇯🇵",
      "reason": "2월 눈 축제(유키마츠리)는 세계 3대 축제! 홋카이도 스키장도 아시아 최고",
      "season_score": 96,
      "estimated_flight_krw": 490000,
      "style_tags": ["눈", "스키", "축제"],
      "highlights": ["삿포로 눈 축제", "니세코 스키", "지옥 온천"],
      "best_season_reason": "1~2월이 눈 질도 최고, 파우더 스노우로 유명한 홋카이도"
    },
    {
      "id": "bangkok",
      "city": "방콕",
      "city_en": "Bangkok",
      "country": "태국",
      "emoji_flag": "🇹🇭",
      "reason": "12~2월이 방콕 건기 성수기! 맑고 선선해서 겨울 피한 여행자들로 북적여요",
      "season_score": 92,
      "estimated_flight_krw": 490000,
      "style_tags": ["도시", "음식", "쇼핑"],
      "highlights": ["왓 포 사원", "짜오프라야 강 크루즈", "짜뚜짝 시장"],
      "best_season_reason": "12~2월이 방콕 최고 시즌, 기온 28도로 쾌적하고 비도 없어요"
    },
    {
      "id": "bali",
      "city": "발리",
      "city_en": "Bali",
      "country": "인도네시아",
      "emoji_flag": "🇮🇩",
      "reason": "한국 겨울에 발리는 우기지만 오전은 맑고 따뜻해 탈출 여행으로 최고",
      "season_score": 84,
      "estimated_flight_krw": 560000,
      "style_tags": ["해변", "힐링", "풀빌라"],
      "highlights": ["우붓 라이스테라스", "짐바란 선셋", "따나롯 사원"],
      "best_season_reason": "한국 영하일 때 발리는 26도, 풀빌라 가격도 비수기라 저렴"
    }
  ]
}
\`\`\``,

  spring: `봄 여행이라면 꽃 구경과 따뜻한 날씨를 동시에 즐겨야죠! 🌸

3~5월 봄 시즌에 가장 빛나는 여행지 세 곳이에요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "kyoto",
      "city": "교토",
      "city_en": "Kyoto",
      "country": "일본",
      "emoji_flag": "🇯🇵",
      "reason": "3월 말~4월 초 벚꽃 시즌! 기요미즈데라·마루야마 공원의 벚꽃은 평생 기억에 남아요",
      "season_score": 98,
      "estimated_flight_krw": 510000,
      "style_tags": ["벚꽃", "전통", "역사"],
      "highlights": ["기요미즈데라 벚꽃", "마루야마 공원", "아라시야마 대나무숲"],
      "best_season_reason": "3월 말~4월 초가 교토 벚꽃 피크, 일생에 한 번은 봐야 할 풍경"
    },
    {
      "id": "barcelona",
      "city": "바르셀로나",
      "city_en": "Barcelona",
      "country": "스페인",
      "emoji_flag": "🇪🇸",
      "reason": "5월 바르셀로나는 성수기 전 기온 22도, 가우디 건축과 해변을 여유롭게 즐길 수 있어요",
      "season_score": 91,
      "estimated_flight_krw": 950000,
      "style_tags": ["건축", "해변", "음식"],
      "highlights": ["사그라다 파밀리아", "구엘 공원", "바르셀로네타 해변"],
      "best_season_reason": "5월은 여름 성수기 전 황금 시즌, 관광객 적고 날씨 완벽"
    },
    {
      "id": "hanoi",
      "city": "하노이",
      "city_en": "Hanoi",
      "country": "베트남",
      "emoji_flag": "🇻🇳",
      "reason": "3~4월 하노이는 25도 내외의 완벽한 봄 날씨, 구시가지 골목 탐험 최적",
      "season_score": 88,
      "estimated_flight_krw": 420000,
      "style_tags": ["음식", "역사", "카페"],
      "highlights": ["호안끼엠 호수", "구시가지 36거리", "하롱베이"],
      "best_season_reason": "3~4월이 하노이 최적 시즌, 더위도 우기도 아닌 딱 좋은 날씨"
    }
  ]
}
\`\`\``,

  summer: `여름 여행이라면 발리 건기와 유럽 황금 시즌을 놓치지 마세요! ☀️

6~8월 여름 시즌 최강 추천지 세 곳이에요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "bali",
      "city": "발리",
      "city_en": "Bali",
      "country": "인도네시아",
      "emoji_flag": "🇮🇩",
      "reason": "6~8월이 발리 건기 성수기! 일 년 중 날씨가 가장 완벽한 시즌이에요",
      "season_score": 96,
      "estimated_flight_krw": 560000,
      "style_tags": ["해변", "힐링", "서핑"],
      "highlights": ["꾸따 비치", "스미냑 선셋", "누사페니다 스노클링"],
      "best_season_reason": "건기 6~8월 발리 최성수기, 파란 하늘과 맑은 바다가 기다려요"
    },
    {
      "id": "barcelona",
      "city": "바르셀로나",
      "city_en": "Barcelona",
      "country": "스페인",
      "emoji_flag": "🇪🇸",
      "reason": "유럽 여름은 바르셀로나가 최고! 가우디 + 해변 + 타파스 삼박자 완성",
      "season_score": 94,
      "estimated_flight_krw": 980000,
      "style_tags": ["건축", "해변", "음식"],
      "highlights": ["사그라다 파밀리아", "바르셀로네타 해변", "구엘 공원"],
      "best_season_reason": "7~8월 평균 27도, 하루 14시간 낮이라 관광 시간이 넉넉해요"
    },
    {
      "id": "tokyo",
      "city": "도쿄",
      "city_en": "Tokyo",
      "country": "일본",
      "emoji_flag": "🇯🇵",
      "reason": "7~8월 도쿄는 불꽃축제·여름 마츠리 시즌! 유카타 입고 축제 즐기기 최고",
      "season_score": 82,
      "estimated_flight_krw": 520000,
      "style_tags": ["축제", "도시", "음식"],
      "highlights": ["스미다가와 불꽃축제", "아사쿠사 삼바 카니발", "시부야 여름 이벤트"],
      "best_season_reason": "7~8월 마츠리와 불꽃축제 시즌, 여름에만 볼 수 있는 일본 문화 체험"
    }
  ]
}
\`\`\``,

  autumn: `가을 여행이라면 단풍과 선선한 날씨가 기다려요! 🍂

9~11월 가을 시즌에 가장 아름다운 여행지 세 곳이에요.

\`\`\`json
{
  "type": "recommendations",
  "destinations": [
    {
      "id": "kyoto",
      "city": "교토",
      "city_en": "Kyoto",
      "country": "일본",
      "emoji_flag": "🇯🇵",
      "reason": "11월 단풍 시즌! 기요미즈데라·에이칸도의 붉은 단풍은 봄 벚꽃과 쌍벽을 이뤄요",
      "season_score": 97,
      "estimated_flight_krw": 510000,
      "style_tags": ["단풍", "전통", "역사"],
      "highlights": ["기요미즈데라 단풍", "에이칸도 야간 라이트업", "아라시야마 색채"],
      "best_season_reason": "11월 중순~하순이 교토 단풍 피크, 야간 조명도 최고"
    },
    {
      "id": "istanbul",
      "city": "이스탄불",
      "city_en": "Istanbul",
      "country": "튀르키예",
      "emoji_flag": "🇹🇷",
      "reason": "9~10월 이스탄불은 여름 열기가 가시고 20~25도, 유럽 성수기도 지나 항공 저렴",
      "season_score": 90,
      "estimated_flight_krw": 780000,
      "style_tags": ["역사", "문화", "야경"],
      "highlights": ["아야소피아", "보스포루스 크루즈", "그랜드 바자르"],
      "best_season_reason": "9~10월이 이스탄불 두 번째 황금 시즌, 성수기 비해 항공 20~30% 저렴"
    },
    {
      "id": "paris",
      "city": "파리",
      "city_en": "Paris",
      "country": "프랑스",
      "emoji_flag": "🇫🇷",
      "reason": "10월 파리는 샹젤리제 가로수 단풍과 카페 문화, 여름 성수기보다 여유롭고 저렴",
      "season_score": 88,
      "estimated_flight_krw": 980000,
      "style_tags": ["문화", "예술", "로맨틱"],
      "highlights": ["샹젤리제 단풍길", "루브르 박물관", "몽마르트르 언덕"],
      "best_season_reason": "9~10월 파리는 성수기 지나 항공·호텔 저렴, 날씨도 선선해 걷기 좋아요"
    }
  ]
}
\`\`\``,
};

// ─────────────────────────────────────────────
// 월 → 계절 매핑
// ─────────────────────────────────────────────
function getSeasonFromMonth(month) {
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'autumn';
}

// ─────────────────────────────────────────────
// 키워드 기반 시나리오 선택
// 핵심: 마지막 사용자 메시지만으로 매칭 (누적 히스토리 오염 방지)
// ─────────────────────────────────────────────
function selectMockScenario(messages) {
  const userMessages = messages.filter((m) => m.role === 'user');
  const lastMsg = userMessages.at(-1)?.content?.toLowerCase() || '';

  // "이번달" / "이번 달" → 현재 월 기준 계절 시나리오
  if (lastMsg.includes('이번달') || lastMsg.includes('이번 달') || lastMsg.includes('이번달')) {
    const season = getSeasonFromMonth(new Date().getMonth() + 1);
    return SEASON_SCENARIOS[season];
  }

  // 특정 월 숫자 키워드 (1월~12월)
  for (let m = 12; m >= 1; m--) {
    if (lastMsg.includes(`${m}월`)) {
      return SEASON_SCENARIOS[getSeasonFromMonth(m)];
    }
  }

  // 계절 직접 언급
  if (lastMsg.includes('겨울') || lastMsg.includes('눈 여행') || lastMsg.includes('스키')) {
    return SEASON_SCENARIOS.winter;
  }
  if (lastMsg.includes('봄') || lastMsg.includes('벚꽃') || lastMsg.includes('봄 여행')) {
    return SEASON_SCENARIOS.spring;
  }
  if (lastMsg.includes('여름') || lastMsg.includes('피서') || lastMsg.includes('여름 휴가')) {
    return SEASON_SCENARIOS.summer;
  }
  if (lastMsg.includes('가을') || lastMsg.includes('단풍') || lastMsg.includes('가을 여행')) {
    return SEASON_SCENARIOS.autumn;
  }

  // 기존 MOCK_SCENARIOS 키워드 매칭
  for (const scenario of MOCK_SCENARIOS) {
    if (scenario.keywords.some((kw) => lastMsg.includes(kw))) {
      return scenario.response;
    }
  }

  // 매칭 없을 때: 사용자 메시지 수 기준으로 DEFAULT_RESPONSES 순환
  return DEFAULT_RESPONSES[userMessages.length % DEFAULT_RESPONSES.length];
}

// ─────────────────────────────────────────────
// API 키 유효성 검사 (sk-ant- 형식이어야 실제 키)
// ─────────────────────────────────────────────
function isRealApiKey(key) {
  return typeof key === 'string' && key.startsWith('sk-ant-');
}

// ─────────────────────────────────────────────
// 라우터
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { messages = [] } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // ── Mock 모드 (API 키 없거나 플레이스홀더일 때) ──
  if (!isRealApiKey(process.env.ANTHROPIC_API_KEY)) {
    const mockText = selectMockScenario(messages);
    await streamText(res, mockText);
    return;
  }

  // ── 실제 Claude API 호출 ──
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    // 인증 오류(401)면 Mock으로 자동 폴백
    if (err.message && (err.message.includes('401') || err.message.includes('authentication'))) {
      console.warn('⚠️  API 키 인증 실패 → Mock 모드로 자동 전환');
      const mockText = selectMockScenario(messages);
      await streamText(res, mockText);
      return;
    }
    console.error('Claude API 오류:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
