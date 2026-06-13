import React, { useEffect, useRef } from 'react';
import useChatStore from '../store/chatStore';
import MessageBubble, { TypingIndicator } from './MessageBubble';
import InputBar from './InputBar';

export default function ChatWindow({ sendMessage, stopStreaming, isStreaming, onRetry }) {
  const { messages, isLoading } = useChatStore();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 마지막이 user 메시지이고 로딩 중이면 타이핑 인디케이터 표시
  const showTyping =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'user';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        {messages.map((msg, idx) => {
          const isLastMsg = idx === messages.length - 1;
          const isStreamingThis = isStreaming && isLastMsg && msg.role === 'assistant';
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={isStreamingThis}
              onRetry={onRetry}
            />
          );
        })}

        {showTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <InputBar
        onSend={sendMessage}
        onStop={stopStreaming}
        isLoading={isLoading || isStreaming}
      />
    </div>
  );
}
