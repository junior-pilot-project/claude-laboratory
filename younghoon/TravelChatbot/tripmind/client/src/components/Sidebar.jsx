import React, { useMemo } from 'react';
import useChatStore from '../store/chatStore';

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function getStoredSessions() {
  try {
    const raw = localStorage.getItem('tripmind_chat_v1');
    if (!raw) return [];
    const data = JSON.parse(raw);
    const firstUser = data.messages?.find((m) => m.role === 'user');
    if (!firstUser) return [];
    return [{
      id: 'current',
      preview: firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : ''),
      date: formatRelativeDate(data.savedAt),
    }];
  } catch {
    return [];
  }
}

// 태블릿용 아이콘 전용 사이드바
function CollapsedSidebar({ onNewChat }) {
  return (
    <div className="flex flex-col items-center py-4 gap-4 h-full">
      <button
        onClick={onNewChat}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-opacity hover:opacity-70"
        title="TripMind 홈"
      >
        ✈️
      </button>
      <button
        onClick={onNewChat}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all"
        style={{
          border: '1px solid rgba(249,115,22,0.4)',
          color: 'var(--color-accent)',
          background: 'rgba(249,115,22,0.08)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.15)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.08)')}
        title="새 대화"
      >
        +
      </button>
    </div>
  );
}

export default function Sidebar({ onNavigate, collapsed = false }) {
  const { clearChat, messages } = useChatStore();
  const sessions = useMemo(() => getStoredSessions(), [messages]);

  function handleNewChat() {
    clearChat();
    onNavigate?.();
  }

  if (collapsed) {
    return (
      <CollapsedSidebar onNewChat={handleNewChat} />
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-bg-secondary)', borderRight: '1px solid var(--color-border)' }}
    >
      {/* 로고 */}
      <button
        onClick={handleNewChat}
        className="flex items-center gap-2 px-4 py-4 hover:opacity-80 transition-opacity text-left"
      >
        <span className="text-2xl">✈️</span>
        <div>
          <div className="font-bold text-slate-100 text-base leading-tight">TripMind</div>
          <div className="text-xs" style={{ color: 'var(--color-accent)' }}>AI 여행 플래너</div>
        </div>
      </button>

      <div className="px-3 mb-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            border: '1px solid rgba(249,115,22,0.5)',
            color: 'var(--color-accent)',
            background: 'rgba(249,115,22,0.08)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.08)')}
        >
          <span className="text-base leading-none">+</span>
          <span>새 대화</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        <div
          className="text-xs font-semibold uppercase tracking-wide mb-2 px-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          최근 대화
        </div>

        {sessions.length === 0 ? (
          <div className="text-xs px-1 mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            대화를 시작해보세요
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="text-sm truncate mb-0.5">{session.preview}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {session.date}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="p-3 border-t text-xs text-center"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
      >
        Powered by Claude AI
      </div>
    </div>
  );
}
