import React, { useRef, useState } from 'react';
import useChatStore from '../store/chatStore';

const COMMANDS = [
  { cmd: '/다시추천', desc: '다른 여행지를 추천해줘', text: '다른 여행지를 추천해줘' },
  { cmd: '/예산변경', desc: '예산 변경하기', text: '예산을 변경하고 싶어' },
  { cmd: '/새대화', desc: '대화 초기화', text: null },
];

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12l7-7 7 7M12 5v14" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export default function InputBar({ onSend, onStop, isLoading }) {
  const [value, setValue] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const textareaRef = useRef(null);
  const { clearChat } = useChatStore();

  const filteredCmds = COMMANDS.filter((c) => c.cmd.startsWith(value.trim()));

  function handleChange(e) {
    const val = e.target.value;
    setValue(val);
    setShowCommands(val.startsWith('/') && val.trim().length > 0);
    autoResize(e.target);
  }

  function handleSend() {
    const text = value.trim();
    if (!text || isLoading) return;
    setValue('');
    setShowCommands(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') setShowCommands(false);
  }

  function executeCommand(cmd) {
    setValue('');
    setShowCommands(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (cmd.text) {
      onSend(cmd.text);
    } else {
      clearChat();
    }
  }

  return (
    <div
      className="relative flex-shrink-0 px-4 py-3 safe-bottom"
      style={{
        background: 'var(--color-bg-secondary)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      {/* 슬래시 커맨드 팔레트 */}
      {showCommands && filteredCmds.length > 0 && (
        <div
          className="absolute bottom-full left-4 right-4 mb-2 rounded-xl overflow-hidden animate-slide-down z-50"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {filteredCmds.map((cmd) => (
            <button
              key={cmd.cmd}
              onMouseDown={(e) => { e.preventDefault(); executeCommand(cmd); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="font-mono font-semibold" style={{ color: 'var(--color-accent)' }}>
                {cmd.cmd}
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{cmd.desc}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={isLoading ? 'TripMind가 답변 중입니다...' : '여행지를 물어보세요...  ( / 로 명령어)'}
          rows={1}
          className="flex-1 resize-none rounded-xl px-4 py-3 text-sm focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin input-field"
          style={{ maxHeight: '120px' }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
        />

        {isLoading ? (
          <button
            onClick={onStop}
            className="send-btn"
            style={{
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.5)',
            }}
            title="중지"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            className="send-btn"
            title="전송 (Enter)"
          >
            <SendIcon />
          </button>
        )}
      </div>

      <p
        className="text-center text-xs mt-2"
        style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}
      >
        Enter 전송 · Shift+Enter 줄바꿈 · / 명령어
      </p>
    </div>
  );
}
