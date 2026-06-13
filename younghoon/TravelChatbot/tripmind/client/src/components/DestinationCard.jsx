import React, { useState } from 'react';
import DestinationDetail from './DestinationDetail';
import FlightPanel from './FlightPanel';

function formatKrw(n) {
  return `₩${Number(n).toLocaleString('ko-KR')}`;
}

export default function DestinationCard({ destination, staggerIndex = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [showFlight, setShowFlight] = useState(false);

  function toggleDetail() {
    setExpanded((v) => !v);
    if (showFlight) setShowFlight(false);
  }

  function toggleFlight() {
    setShowFlight((v) => !v);
    if (expanded) setExpanded(false);
  }

  const scoreColor =
    destination.season_score >= 85
      ? '#4ade80'
      : destination.season_score >= 70
      ? '#fbbf24'
      : '#f87171';

  const delayClass = staggerIndex > 0 ? `card-enter-delay-${Math.min(staggerIndex, 5)}` : '';

  return (
    <div className={`destination-card card-enter ${delayClass}`}>
      {/* ── 카드 헤더 ── */}
      <div className="p-4">
        {/* 제목 행 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl leading-none">{destination.emoji_flag}</span>
            <div>
              <div className="font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                {destination.city}
                <span className="ml-1.5 text-sm font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                  {destination.city_en}
                </span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                {destination.country}
              </div>
            </div>
          </div>

          {/* 시즌 점수 */}
          <div className="text-right flex-shrink-0">
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>시즌 점수</div>
            <div className="text-xl font-bold leading-tight" style={{ color: scoreColor }}>
              {destination.season_score}
            </div>
          </div>
        </div>

        {/* 추천 이유 */}
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {destination.reason}
        </p>

        {/* 부가 정보 행 */}
        <div className="flex flex-wrap items-center gap-3 text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {destination.estimated_flight_krw && (
            <span className="flex items-center gap-1">
              <span>✈️</span>
              <span>항공 최저 <span style={{ color: 'var(--color-accent-soft)' }}>{formatKrw(destination.estimated_flight_krw)}~</span></span>
            </span>
          )}
          {destination.best_season_reason && (
            <span className="flex items-center gap-1">
              <span>🌤</span>
              <span className="truncate max-w-[200px]">{destination.best_season_reason}</span>
            </span>
          )}
        </div>

        {/* 스타일 태그 */}
        {destination.style_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {destination.style_tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(249,115,22,0.12)',
                  border: '1px solid rgba(249,115,22,0.2)',
                  color: 'var(--color-accent-soft)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 하이라이트 */}
        {destination.highlights?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {destination.highlights.slice(0, 3).map((h) => (
              <span
                key={h}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-secondary)' }}
              >
                📍 {h}
              </span>
            ))}
          </div>
        )}

        {/* 버튼 행 */}
        <div className="flex gap-2">
          {/* 상세 보기 (Secondary 스타일) */}
          <button
            onClick={toggleDetail}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              border: `1px solid ${expanded ? 'rgba(249,115,22,0.5)' : '#475569'}`,
              color: expanded ? 'var(--color-accent)' : '#94a3b8',
              background: expanded ? 'rgba(249,115,22,0.08)' : 'transparent',
            }}
            onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {expanded ? '접기 ↑' : '상세 보기 ↓'}
          </button>

          {/* 항공권 검색 (Primary 스타일) */}
          <button
            onClick={toggleFlight}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: showFlight ? 'rgba(249,115,22,0.3)' : '#f97316',
              border: 'none',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              if (!showFlight) {
                e.currentTarget.style.background = '#fb923c';
                e.currentTarget.style.transform = 'scale(1.02)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showFlight) {
                e.currentTarget.style.background = '#f97316';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            {showFlight ? '닫기 ✕' : '항공권 검색 →'}
          </button>
        </div>
      </div>

      {/* ── 상세 패널 (max-height 트랜지션) ── */}
      <div
        className={`detail-panel ${expanded ? 'open' : ''}`}
        style={{ borderTop: expanded ? '1px solid var(--color-border)' : 'none' }}
      >
        <DestinationDetail destinationId={destination.id} />
      </div>

      {/* ── 항공권 패널 (max-height 트랜지션) ── */}
      <div
        className={`detail-panel ${showFlight ? 'open' : ''}`}
        style={{ borderTop: showFlight ? '1px solid var(--color-border)' : 'none' }}
      >
        <div className="animate-flight-slide">
          <FlightPanel destination={destination} />
        </div>
      </div>
    </div>
  );
}
