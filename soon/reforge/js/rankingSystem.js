// 랭킹 시스템
const RankingSystem = (() => {

  function addRanking(state) {
    const entry = { date: new Date().toISOString().slice(0, 10) };
    state.rankings.unshift(entry);
    if (state.rankings.length > CONFIG.MAX_RANKINGS) {
      state.rankings = state.rankings.slice(0, CONFIG.MAX_RANKINGS);
    }
  }

  return { addRanking };
})();
