import React, { useState } from 'react';
import useChatStore from '../store/chatStore';

const TODAY = new Date().toISOString().split('T')[0];

function formatKrw(n) {
  return `₩${Number(n).toLocaleString('ko-KR')}`;
}

function FlightCard({ flight }) {
  return (
    <a
      href={flight.booking_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl p-4 transition-all"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--color-border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {flight.airline}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--color-text-secondary)' }}>
            {flight.flight_number}
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: flight.stops === 0 ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
            color: flight.stops === 0 ? '#4ade80' : '#fbbf24',
          }}
        >
          {flight.stops === 0 ? '직항' : `${flight.stops}회 경유`}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {flight.departure}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>ICN</div>
        </div>

        <div className="flex-1 mx-3 flex flex-col items-center">
          <div className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            {flight.duration}
          </div>
          <div className="w-full flex items-center gap-1">
            <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
            <span className="text-xs">✈</span>
            <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
          </div>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {flight.arrival}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {flight.destination || ''}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {flight.price_type} · 1인
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>
            {formatKrw(flight.price_krw)}
          </span>
          <span
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--color-accent)' }}
          >
            예약 →
          </span>
        </div>
      </div>
    </a>
  );
}

function PriceCalendar({ calendar, selectedDate, onSelectDate }) {
  if (!calendar) return null;
  const entries = Object.entries(calendar).sort(([a], [b]) => a.localeCompare(b));
  const minPrice = Math.min(...entries.map(([, p]) => p));

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
        {entries.map(([date, price]) => {
          const isSelected = date === selectedDate;
          const isCheapest = price === minPrice;
          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className="flex flex-col items-center px-3 py-2 rounded-xl text-center transition-all min-w-[72px]"
              style={{
                background: isSelected ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: isSelected ? 'white' : 'var(--color-text-primary)',
              }}
            >
              <div className="text-xs mb-0.5" style={{ opacity: 0.8 }}>
                {date.slice(5).replace('-', '/')}
              </div>
              <div className="text-sm font-bold">
                {(price / 10000).toFixed(0)}만
              </div>
              {isCheapest && (
                <div
                  className="text-xs mt-0.5 px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(249,115,22,0.2)',
                    color: isSelected ? 'white' : 'var(--color-accent)',
                  }}
                >
                  최저가
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FlightPanel({ destination }) {
  const destinations = useChatStore((s) => s.destinations);
  const fullDest = destinations.find((d) => d.id === destination.id);

  const [date, setDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(searchDate) {
    const targetDate = searchDate || date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'ICN',
          destination: fullDest?.iata_code || destination.id.toUpperCase().slice(0, 3),
          date: targetDate,
          adults,
        }),
      });
      const data = await res.json();
      setResults(data);
      if (!date) setDate(targetDate);
    } catch {
      setError('잠시 연결이 끊겼어요. 다시 시도해볼까요?');
    } finally {
      setLoading(false);
    }
  }

  function handleCalendarSelect(newDate) {
    setDate(newDate);
    search(newDate);
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">✈️</span>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
          인천 → {destination.city} 항공권 검색
        </h3>
      </div>

      {/* 날짜 + 인원 선택 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="date"
          min={TODAY}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 min-w-[140px] px-3 py-2 rounded-xl text-sm input-field"
        />

        <select
          value={adults}
          onChange={(e) => setAdults(Number(e.target.value))}
          className="px-3 py-2 rounded-xl text-sm input-field"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n}명</option>
          ))}
        </select>

        <button
          onClick={() => search()}
          disabled={loading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? '검색 중...' : '검색하기'}
        </button>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="flex gap-1.5">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            인천에서 {destination.city}로 가는 최저가 항공편을 찾고 있어요...
          </p>
        </div>
      )}

      {/* 에러 */}
      {error && !loading && (
        <div className="error-toast mb-3">
          <span>⚠️</span>
          <span>{error}</span>
          <button
            onClick={() => search()}
            className="ml-auto text-xs px-3 py-1 rounded-lg transition-all"
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}
          >
            재시도
          </button>
        </div>
      )}

      {/* 결과 */}
      {!loading && results && (
        <div className="space-y-4">
          {/* 가격 캘린더 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              날짜별 최저가
            </div>
            <PriceCalendar
              calendar={results.price_calendar}
              selectedDate={date}
              onSelectDate={handleCalendarSelect}
            />
          </div>

          {/* 항공편 카드 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              추천 항공편 (최저가 순)
            </div>
            <div className="space-y-2">
              {results.flights.map((f) => (
                <FlightCard key={f.id} flight={f} />
              ))}
            </div>
          </div>

          {/* Mock 경고 */}
          {results.is_mock && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
            >
              <span>⚠️</span>
              <span>현재 실시간 조회가 어렵습니다. 참고용 예상 금액입니다.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
