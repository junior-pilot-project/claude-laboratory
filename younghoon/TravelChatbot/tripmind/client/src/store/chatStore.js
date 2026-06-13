import { create } from 'zustand';

const STORAGE_KEY = 'tripmind_chat_v1';
const MAX_STORED_MESSAGES = 20;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseRecommendations(content) {
  const match = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.type === 'recommendations' && Array.isArray(parsed.destinations)) {
      return parsed.destinations;
    }
  } catch {
    // ignore
  }
  return null;
}

// debounce 유틸
let saveTimer = null;
function debounce(fn, ms) {
  return (...args) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => fn(...args), ms);
  };
}

const useChatStore = create((set, get) => {
  const debouncedPersist = debounce(() => {
    const { messages, userProfile } = get();
    const toSave = {
      messages: messages.slice(-MAX_STORED_MESSAGES).map((m) => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      })),
      userProfile,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, 500);

  return {
    messages: [],
    userProfile: {},
    recommendations: [],
    selectedDest: null,
    flightResults: null,
    destinations: [],
    isLoading: false,
    isFlightLoading: false,

    setDestinations: (dests) => set({ destinations: dests }),

    addMessage: (message) => {
      const newMessage = {
        id: generateId(),
        role: message.role,
        content: message.content,
        timestamp: new Date(),
        recommendations: message.role === 'assistant'
          ? parseRecommendations(message.content)
          : null,
      };
      set((state) => {
        const messages = [...state.messages, newMessage];
        const recommendations =
          newMessage.recommendations?.length > 0
            ? newMessage.recommendations
            : state.recommendations;
        return { messages, recommendations };
      });
      debouncedPersist();
      return newMessage;
    },

    updateLastAssistantMessage: (content, extra = {}) => {
      set((state) => {
        const messages = [...state.messages];
        const lastIdx = messages.length - 1;
        if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
          const recs = parseRecommendations(content);
          const updated = {
            ...messages[lastIdx],
            content,
            recommendations: recs,
            ...extra,
          };
          messages[lastIdx] = updated;
          const recommendations =
            recs?.length > 0 ? recs : state.recommendations;
          return { messages, recommendations };
        }
        return state;
      });
    },

    pushAssistantPlaceholder: () => {
      const placeholder = {
        id: `stream-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        recommendations: null,
      };
      set((state) => ({ messages: [...state.messages, placeholder] }));
      return placeholder.id;
    },

    setRecommendations: (recs) => set({ recommendations: recs }),
    selectDestination: (dest) => set({ selectedDest: dest, flightResults: null }),
    setFlightResults: (results) => set({ flightResults: results }),
    setLoading: (val) => set({ isLoading: val }),
    setFlightLoading: (val) => set({ isFlightLoading: val }),
    updateUserProfile: (updates) =>
      set((state) => ({ userProfile: { ...state.userProfile, ...updates } })),

    clearChat: () => {
      set({
        messages: [],
        recommendations: [],
        selectedDest: null,
        flightResults: null,
        userProfile: {},
      });
      localStorage.removeItem(STORAGE_KEY);
    },

    // 즉시 저장 (스트리밍 완료 후 호출)
    saveToStorage: () => debouncedPersist(),

    loadFromStorage: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const { messages = [], userProfile = {} } = JSON.parse(raw);
        const parsed = messages.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        const recommendations = parsed
          .filter((m) => m.role === 'assistant' && m.recommendations?.length)
          .flatMap((m) => m.recommendations)
          .slice(-10);
        set({ messages: parsed, userProfile, recommendations });
      } catch {
        // storage 손상 무시
      }
    },
  };
});

export default useChatStore;
