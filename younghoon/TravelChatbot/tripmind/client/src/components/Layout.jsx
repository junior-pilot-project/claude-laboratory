import React, { useState } from 'react';
import Sidebar from './Sidebar';
import useChatStore from '../store/chatStore';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { clearChat } = useChatStore();

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      {/* ─── 헤더 ─── */}
      <header
        className="flex items-center justify-between px-4 flex-shrink-0 z-10 header-blur"
        style={{ height: '56px' }}
      >
        {/* 왼쪽: 햄버거(모바일) + 로고/설명 */}
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="메뉴 열기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* 모바일 헤더 로고 */}
          <span className="md:hidden font-bold text-slate-100 flex items-center gap-1.5">
            <span className="text-lg">✈️</span> TripMind
          </span>

          {/* 데스크톱: 설명 텍스트 */}
          <span
            className="hidden md:block text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            AI와 대화하며 나만의 여행지를 발견하세요
          </span>
        </div>

        {/* 오른쪽: 새 대화 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => clearChat()}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              border: '1px solid rgba(249,115,22,0.4)',
              color: 'var(--color-accent)',
              background: 'rgba(249,115,22,0.08)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.08)')}
          >
            <span>+</span> 새 대화
          </button>
        </div>
      </header>

      {/* ─── 바디 ─── */}
      <div className="flex flex-1 min-h-0">
        {/* 사이드바 — 태블릿 (아이콘만, 60px) */}
        <div
          className="hidden md:flex lg:hidden flex-col flex-shrink-0"
          style={{
            width: '60px',
            background: 'var(--color-bg-secondary)',
            borderRight: '1px solid var(--color-border)',
          }}
        >
          <Sidebar collapsed />
        </div>

        {/* 사이드바 — 데스크톱 (240px) */}
        <div className="hidden lg:flex flex-col flex-shrink-0" style={{ width: '240px' }}>
          <Sidebar />
        </div>

        {/* 사이드바 — 모바일 오버레이 */}
        {sidebarOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-20 bg-black/60"
              onClick={() => setSidebarOpen(false)}
            />
            <div
              className="md:hidden fixed left-0 z-30 flex flex-col"
              style={{ top: '56px', bottom: 0, width: '240px' }}
            >
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </div>
          </>
        )}

        {/* 메인 콘텐츠 */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
