import React from 'react';
import useChatStore from '../store/chatStore';

function PriceRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}

function SectionHeader({ emoji, title }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: 'var(--color-accent-soft)' }}>
      <span>{emoji}</span>
      <span>{title}</span>
    </h3>
  );
}

function TypeBadge({ type }) {
  const colors = {
    역사: { bg: 'rgba(139,92,246,0.2)', text: '#c4b5fd' },
    자연: { bg: 'rgba(34,197,94,0.2)', text: '#4ade80' },
    식도락: { bg: 'rgba(249,115,22,0.2)', text: 'var(--color-accent-soft)' },
    예술: { bg: 'rgba(236,72,153,0.2)', text: '#f9a8d4' },
    랜드마크: { bg: 'rgba(251,191,36,0.2)', text: '#fcd34d' },
    쇼핑: { bg: 'rgba(99,102,241,0.2)', text: '#a5b4fc' },
    관광: { bg: 'rgba(20,184,166,0.2)', text: '#5eead4' },
    건축: { bg: 'rgba(249,115,22,0.2)', text: 'var(--color-accent-soft)' },
    레저: { bg: 'rgba(59,130,246,0.2)', text: '#93c5fd' },
    문화: { bg: 'rgba(168,85,247,0.2)', text: '#d8b4fe' },
    전망: { bg: 'rgba(251,191,36,0.2)', text: '#fcd34d' },
    해변: { bg: 'rgba(6,182,212,0.2)', text: '#67e8f9' },
  };
  const style = colors[type] || { bg: 'rgba(100,116,139,0.2)', text: '#94a3b8' };
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: style.bg, color: style.text }}
    >
      {type}
    </span>
  );
}

function PriceRange({ range }) {
  return (
    <span className="text-sm" style={{ color: 'var(--color-accent)' }}>{range}</span>
  );
}

export default function DestinationDetail({ destinationId }) {
  const destinations = useChatStore((s) => s.destinations);
  const dest = destinations.find((d) => d.id === destinationId);

  if (!dest) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
        <div className="text-2xl mb-2">🗺️</div>
        <p className="text-sm">상세 정보를 불러오는 중...</p>
        <p className="text-xs mt-1 opacity-60">destinations 데이터가 로드되지 않았습니다</p>
      </div>
    );
  }

  const budget = dest.estimated_budget_krw;
  const nights = 5;
  const days = 6;
  const totalEstimate =
    budget.flight_round_trip +
    budget.accommodation_per_night * nights +
    budget.daily_food * days;

  return (
    <div className="p-4 space-y-5 animate-slide-down">

      {/* ── 관광명소 ── */}
      <section>
        <SectionHeader emoji="🏛" title="관광명소 Top 5" />
        <div className="space-y-3">
          {dest.highlights.map((h) => (
            <div
              key={h.name}
              className="flex gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {h.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {h.name_en}
                  </span>
                  <TypeBadge type={h.type} />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {h.desc}
                </p>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(h.name_en)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 self-start text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                title="Google Maps에서 보기"
              >
                지도 →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── 맛집 ── */}
      <section>
        <SectionHeader emoji="🍽" title="맛집 추천" />
        <div className="space-y-2">
          {dest.restaurants.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}
            >
              <div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                  {r.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {r.cuisine} · 추천 메뉴: <span style={{ color: 'var(--color-accent-soft)' }}>{r.must_try}</span>
                </div>
              </div>
              <PriceRange range={r.price_range} />
            </div>
          ))}
        </div>
      </section>

      {/* ── 즐길거리 ── */}
      <section>
        <SectionHeader emoji="🎒" title="즐길거리" />
        <div className="flex flex-wrap gap-2">
          {dest.activities.map((a) => (
            <span
              key={a}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(249,115,22,0.1)',
                border: '1px solid rgba(249,115,22,0.25)',
                color: 'var(--color-accent-soft)',
              }}
            >
              {a}
            </span>
          ))}
        </div>
      </section>

      {/* ── 예상 경비 ── */}
      <section>
        <SectionHeader emoji="💰" title="예상 여행 경비" />
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--color-border)' }}
        >
          <div className="p-3 space-y-0.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <PriceRow label="✈️ 항공권 (왕복)" value={`₩${budget.flight_round_trip.toLocaleString()}`} />
            <PriceRow label={`🏨 숙박 (${nights}박)`} value={`₩${(budget.accommodation_per_night * nights).toLocaleString()}`} />
            <PriceRow label={`🍜 식비 (${days}일)`} value={`₩${(budget.daily_food * days).toLocaleString()}`} />
          </div>
          <div
            className="flex items-center justify-between px-3 py-2.5"
            style={{ background: 'rgba(249,115,22,0.1)', borderTop: '1px solid var(--color-border)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--color-accent-soft)' }}>
              {nights}박 {days}일 총계 (예상)
            </span>
            <span className="text-base font-bold" style={{ color: 'var(--color-accent)' }}>
              ₩{totalEstimate.toLocaleString()}
            </span>
          </div>
        </div>
        {budget.tips && (
          <p className="text-xs mt-2 px-1" style={{ color: 'var(--color-text-secondary)' }}>
            💡 {budget.tips}
          </p>
        )}
      </section>

      {/* ── 비자 정보 ── */}
      <section>
        <SectionHeader emoji="🛂" title="입국 정보" />
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}
        >
          <span>✅</span>
          <span>{dest.visa_info}</span>
        </div>
      </section>
    </div>
  );
}
