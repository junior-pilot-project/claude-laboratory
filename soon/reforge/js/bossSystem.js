// 보스 시스템
const BossSystem = (() => {

  function getPlayerStats(state) {
    let atk = 1;
    let def = 0;

    if (state.equippedSword) {
      const s = CONFIG.ITEM_GRADE_STATS[state.equippedSword.grade];
      atk = s.atk + state.equippedSword.enhancement * s.atkMult;
    }
    if (state.equippedShield) {
      const s = CONFIG.ITEM_GRADE_STATS[state.equippedShield.grade];
      def = s.def + state.equippedShield.enhancement * s.defMult;
    }

    return { atk, def };
  }

  function simulateBattle(playerStats, stage) {
    let bossHp = stage.bossHp;
    let playerHp = CONFIG.BOSS_PLAYER_HP;
    const rounds = [];

    let round = 0;
    while (bossHp > 0 && playerHp > 0) {
      round++;
      const playerDmg = playerStats.atk;
      bossHp -= playerDmg;

      const bossDmg = Math.max(0, stage.bossAtk - playerStats.def);
      playerHp -= bossDmg;

      rounds.push({
        round,
        playerHp: Math.max(0, playerHp),
        bossHp: Math.max(0, bossHp),
        bossDmg,
        playerDmg,
      });
    }

    return { cleared: bossHp <= 0, rounds };
  }

  function isStageUnlocked(stage, state) {
    return GameState.getTotalEnhancement(state) >= stage.unlock;
  }

  return { getPlayerStats, simulateBattle, isStageUnlocked };
})();
