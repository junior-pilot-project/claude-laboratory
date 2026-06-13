import React, { useMemo } from 'react';
import DestinationCard from './DestinationCard';

export default function DestinationCardList({ destinations }) {
  if (!destinations) return null;

  // 빈 추천 결과는 MessageBubble에서 처리
  if (destinations.length === 0) return null;

  // useMemo로 불필요한 리렌더링 방지
  const cards = useMemo(
    () =>
      destinations.map((dest, idx) => (
        <DestinationCard key={dest.id} destination={dest} staggerIndex={idx} />
      )),
    [destinations]
  );

  return (
    <div className="mt-3">
      <div
        className="text-xs font-semibold mb-3 flex items-center gap-1.5"
        style={{ color: 'var(--color-accent)' }}
      >
        <span>🗺️</span>
        <span>추천 여행지 {destinations.length}곳</span>
      </div>

      <div className={`grid gap-3 ${destinations.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {cards}
      </div>
    </div>
  );
}
