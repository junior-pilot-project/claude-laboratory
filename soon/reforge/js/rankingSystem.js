// 랭킹 시스템
const RankingSystem = (() => {

  // 랭킹 등록
  function addRanking(state, playTimeMs) {
    const entry = {
      playTime: playTimeMs,
      date: new Date().toISOString().slice(0, 10),
    };
    state.rankings.push(entry);
    // 플레이타임 오름차순 정렬 (빠를수록 높은 순위)
    state.rankings.sort((a, b) => a.playTime - b.playTime);
    // 상위 10개만 유지
    if (state.rankings.length > CONFIG.MAX_RANKINGS) {
      state.rankings = state.rankings.slice(0, CONFIG.MAX_RANKINGS);
    }
    return state.rankings.indexOf(entry);
  }

  // 플레이타임 포맷 (ms → HH:MM:SS)
  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  // 별점 계산 (빠를수록 별 3개)
  function getStars(playTimeMs, rankings) {
    if (!rankings.length) return 1;
    const rank = rankings.findIndex(r => r.playTime === playTimeMs);
    const ratio = rank / rankings.length;
    if (ratio < 0.33) return 3;
    if (ratio < 0.66) return 2;
    return 1;
  }

  return { addRanking, formatTime, getStars };
})();
