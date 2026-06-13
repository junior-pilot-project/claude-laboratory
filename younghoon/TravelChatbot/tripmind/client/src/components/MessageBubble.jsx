import React from 'react';
import ReactMarkdown from 'react-markdown';
import DestinationCardList from './DestinationCardList';

function formatTime(ts) {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function parseAIContent(content) {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const textContent = content.replace(/```json[\s\S]*?```/g, '').trim();
  let recommendations = null;

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.type === 'recommendations' && Array.isArray(parsed.destinations)) {
        recommendations = parsed.destinations;
      }
    } catch {
      // ignore
    }
  }

  return { textContent, recommendations };
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4 animate-fade-in-up">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ background: 'var(--color-accent)' }}
      >
        ✈
      </div>
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3"
        style={{ background: 'var(--color-ai-bubble)' }}
      >
        <div className="flex items-center gap-1.5 py-1">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function UserBubble({ message }) {
  return (
    <div className="flex justify-end mb-4 animate-fade-in-up">
      <div style={{ maxWidth: 'min(75%, 480px)' }}>
        <div
          className="rounded-2xl rounded-br-sm px-4 py-3"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
          }}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#fff' }}>
            {message.content}
          </p>
        </div>
        <div className="text-xs text-right mt-1" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

function RetryButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        background: 'rgba(249,115,22,0.15)',
        border: '1px solid rgba(249,115,22,0.4)',
        color: 'var(--color-accent)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.25)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.15)')}
    >
      재시도
    </button>
  );
}

function AIBubble({ message, isStreaming, onRetry }) {
  const { textContent, recommendations } = parseAIContent(message.content);
  const hasContent = textContent.length > 0;
  const hasRecs = recommendations?.length > 0;
  const emptyRecs = recommendations !== null && recommendations.length === 0;

  return (
    <div className="flex gap-3 mb-4 animate-fade-in-up">
      {/* 아바타 */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5"
        style={{ background: 'var(--color-accent)' }}
      >
        ✈
      </div>

      <div style={{ maxWidth: 'min(82%, 640px)', flex: '1 1 0' }}>
        {(hasContent || hasRecs || emptyRecs || isStreaming) && (
          <div
            className="rounded-2xl rounded-tl-sm px-4 py-3"
            style={{ background: 'var(--color-ai-bubble)' }}
          >
            {/* 텍스트 */}
            {hasContent && (
              <div
                className={`text-sm leading-relaxed markdown-content ${isStreaming ? 'streaming-cursor' : ''}`}
                style={{ color: 'var(--color-text-primary)' }}
              >
                <ReactMarkdown>{textContent}</ReactMarkdown>
              </div>
            )}

            {/* 스트리밍 중 텍스트 없을 때 점 애니메이션 */}
            {isStreaming && !hasContent && (
              <div className="flex items-center gap-1.5 py-1">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            )}

            {/* 추천 카드 */}
            {hasRecs && <DestinationCardList destinations={recommendations} />}

            {/* 빈 추천 결과 */}
            {emptyRecs && (
              <div
                className="mt-2 p-3 rounded-xl text-sm"
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  color: '#fbbf24',
                }}
              >
                조건에 딱 맞는 곳을 못 찾았어요. 예산이나 기간을 조금 조정해볼까요? 🤔
              </div>
            )}

            {/* 에러 재시도 버튼 */}
            {message.isError && message.retryText && onRetry && (
              <RetryButton onClick={() => onRetry(message.retryText)} />
            )}
          </div>
        )}

        <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

export default function MessageBubble({ message, isStreaming, onRetry }) {
  if (message.role === 'user') return <UserBubble message={message} />;
  return <AIBubble message={message} isStreaming={isStreaming} onRetry={onRetry} />;
}
