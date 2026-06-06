// 레이드 시스템
const RaidSystem = (() => {

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
    let playerHp = CONFIG.RAID_PLAYER_HP;
    const rounds = [];

    for (let i = 0; i < CONFIG.RAID_ROUNDS; i++) {
      const playerDmg = playerStats.atk;
      bossHp -= playerDmg;

      const bossDmg = Math.max(0, stage.bossAtk - playerStats.def);
      playerHp -= bossDmg;

      rounds.push({
        round: i + 1,
        playerHp: Math.max(0, playerHp),
        bossHp: Math.max(0, bossHp),
        bossDmg,
        playerDmg,
      });

      if (bossHp <= 0) break;
    }

    return { cleared: bossHp <= 0, rounds };
  }

  function isStageUnlocked(stage, state) {
    return GameState.getTotalEnhancement(state) >= stage.unlock;
  }

  return { getPlayerStats, simulateBattle, isStageUnlocked };
})();
