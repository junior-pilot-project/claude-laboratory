const express = require('express');
const router = express.Router();

// 항공권 API 응답 5분 캐시 (동일 파라미터 재요청 방지)
const flightCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheKey(origin, destination, date, adults) {
  return `${origin}-${destination}-${date}-${adults}`;
}

function generateMockFlights(origin, destination, date, adults = 1) {
  const basePrice = Math.floor(Math.random() * 200000) + 400000;
  const airlines = [
    { name: '대한항공', code: 'KE', fn: 'KE651' },
    { name: '아시아나항공', code: 'OZ', fn: 'OZ741' },
    { name: '에어부산', code: 'BX', fn: 'BX391' },
  ];

  const flights = airlines
    .map((airline, i) => {
      const price = basePrice + i * 30000 - i * 15000;
      const depHour = 9 + i * 3;
      const duration = Math.floor(Math.random() * 3) + 5;
      const arrHour = (depHour + duration) % 24;
      return {
        id: `f${i + 1}`,
        airline: airline.name,
        airline_code: airline.code,
        flight_number: airline.fn,
        departure: `${String(depHour).padStart(2, '0')}:${i % 2 === 0 ? '30' : '00'}`,
        arrival: `${String(arrHour).padStart(2, '0')}:${i % 2 === 0 ? '45' : '15'}`,
        duration: `${duration}h ${i % 2 === 0 ? '15' : '30'}m`,
        stops: i === 2 ? 1 : 0,
        price_krw: Math.round(price / 1000) * 1000,
        price_type: '왕복',
        booking_url: `https://www.skyscanner.co.kr/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/`,
      };
    })
    .sort((a, b) => a.price_krw - b.price_krw);

  const dateObj = date ? new Date(date) : new Date();
  const priceCalendar = {};
  for (let i = -3; i <= 3; i++) {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    const variation = Math.floor(Math.random() * 100000) - 30000;
    priceCalendar[key] = Math.max(flights[0].price_krw + variation, 300000);
  }

  return { flights, priceCalendar };
}

async function fetchAmadeusToken() {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_API_KEY,
      client_secret: process.env.AMADEUS_API_SECRET,
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function fetchAmadeusFlights(token, origin, destination, date, adults) {
  const fetch = (await import('node-fetch')).default;
  const params = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate: date,
    adults: String(adults),
    max: '3',
    currencyCode: 'KRW',
  });
  const res = await fetch(
    `https://test.api.amadeus.com/v2/shopping/flight-offers?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

router.post('/', async (req, res) => {
  const { origin = 'ICN', destination = 'BKK', date, adults = 1 } = req.body;
  const targetDate =
    date || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

  // 캐시 확인
  const cacheKey = getCacheKey(origin, destination, targetDate, adults);
  const cached = flightCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  let responseData;

  if (process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET) {
    try {
      const token = await fetchAmadeusToken();
      const amadeusData = await fetchAmadeusFlights(
        token, origin, destination, targetDate, adults
      );

      if (amadeusData.data && amadeusData.data.length > 0) {
        const flights = amadeusData.data.slice(0, 3).map((offer, i) => {
          const seg = offer.itineraries[0].segments[0];
          return {
            id: `a${i + 1}`,
            airline: seg.carrierCode,
            airline_code: seg.carrierCode,
            flight_number: `${seg.carrierCode}${seg.number}`,
            departure: seg.departure.at.split('T')[1].slice(0, 5),
            arrival: seg.arrival.at.split('T')[1].slice(0, 5),
            duration: offer.itineraries[0].duration,
            stops: offer.itineraries[0].segments.length - 1,
            price_krw: Math.round(parseFloat(offer.price.total)),
            price_type: '왕복',
            booking_url: `https://www.skyscanner.co.kr/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/`,
          };
        });

        const mock = generateMockFlights(origin, destination, targetDate, adults);
        responseData = {
          flights,
          price_calendar: mock.priceCalendar,
          currency: 'KRW',
          is_mock: false,
        };
      }
    } catch (err) {
      console.error('Amadeus API 오류, Mock 데이터로 대체:', err.message);
    }
  }

  if (!responseData) {
    const { flights, priceCalendar } = generateMockFlights(
      origin, destination, targetDate, adults
    );
    responseData = {
      flights,
      price_calendar: priceCalendar,
      currency: 'KRW',
      is_mock: true,
    };
  }

  // 캐시 저장
  flightCache.set(cacheKey, { data: responseData, ts: Date.now() });
  res.json(responseData);
});

module.exports = router;
