import React, { useEffect, useRef, useState } from 'react';
import Layout from './components/Layout';
import ChatWindow from './components/ChatWindow';
import useChatStore from './store/chatStore';

const INITIAL_GREETING =
  '안녕하세요! 어떤 여행을 꿈꾸고 계신가요? ✈️\n\n여행 취향, 예산, 기간을 알려주시면 지금 시즌에 딱 맞는 여행지를 추천해 드릴게요!';

export default function App() {
  const {
    messages,
    userProfile,
    loadFromStorage,
    addMessage,
    updateLastAssistantMessage,
    pushAssistantPlaceholder,
    setLoading,
    setDestinations,
    saveToStorage,
  } = useChatStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef(null);

  // 앱 시작: 저장된 대화 복원 + 여행지 데이터 + 첫 인사 메시지
  useEffect(() => {
    loadFromStorage();

    // loadFromStorage는 동기(zustand set), 직후 state 확인 가능
    if (useChatStore.getState().messages.length === 0) {
      useChatStore.getState().addMessage({ role: 'assistant', content: INITIAL_GREETING });
    }

    fetch('/api/destinations')
      .then((r) => r.json())
      .then((data) => setDestinations(data))
      .catch((err) => console.error('destinations 로드 실패:', err));
  }, []);

  function stopStreaming() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  async function sendMessage(text) {
    if (!text.trim() || isStreaming) return;

    addMessage({ role: 'user', content: text });
    pushAssistantPlaceholder();
    setLoading(true);
    setIsStreaming(true);

    const historyForApi = useChatStore
      .getState()
      .messages.filter((m) => m.content.trim() && !m.isError)
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi, userProfile }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errorMsg = `서버 오류 ${response.status}`;
        try {
          const errData = await response.json();
          // API 키 없음 감지
          if (errData.error && errData.error.includes('ANTHROPIC_API_KEY')) {
            updateLastAssistantMessage(
              '⚠️ AI 서비스 설정이 필요합니다. .env 파일을 확인해주세요.'
            );
            return;
          }
          errorMsg = errData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;

          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              accumulated += parsed.text;
              updateLastAssistantMessage(accumulated);
            }
          } catch (parseErr) {
            if (parseErr.message !== raw) {
              console.warn('SSE 파싱 실패:', parseErr.message);
            }
          }
        }
      }

      saveToStorage();
    } catch (err) {
      if (err.name === 'AbortError') {
        updateLastAssistantMessage(
          useChatStore.getState().messages.at(-1)?.content || '답변이 중단되었습니다.'
        );
      } else {
        console.error('채팅 오류:', err);
        updateLastAssistantMessage(
          '잠시 연결이 끊겼어요. 다시 시도해볼까요?',
          { isError: true, retryText: text }
        );
      }
      saveToStorage();
    } finally {
      setLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }

  function handleRetry(text) {
    sendMessage(text);
  }

  return (
    <Layout>
      <ChatWindow
        sendMessage={sendMessage}
        stopStreaming={stopStreaming}
        isStreaming={isStreaming}
        onRetry={handleRetry}
      />
    </Layout>
  );
}
