(function () {
  "use strict";

  // レシピレベルボーナス倍率 (%)
  // 出典: https://wikiwiki.jp/poke_sleep/%E6%96%99%E7%90%86 (レシピレベルボーナス一覧)
  // Lv1=0% ... Lv65=234%, Lv70=258%
  const LEVEL_BONUS = {
    1: 0, 2: 2, 3: 4, 4: 6, 5: 8, 6: 9, 7: 11, 8: 13, 9: 16, 10: 18,
    11: 19, 12: 21, 13: 23, 14: 24, 15: 26, 16: 28, 17: 30, 18: 31, 19: 33, 20: 35,
    21: 37, 22: 40, 23: 42, 24: 45, 25: 47, 26: 50, 27: 52, 28: 55, 29: 58, 30: 61,
    31: 64, 32: 67, 33: 70, 34: 74, 35: 77, 36: 81, 37: 84, 38: 88, 39: 92, 40: 96,
    41: 100, 42: 104, 43: 108, 44: 113, 45: 117, 46: 122, 47: 127, 48: 132, 49: 137, 50: 142,
    51: 148, 52: 153, 53: 159, 54: 165, 55: 171, 56: 177, 57: 183, 58: 190, 59: 197, 60: 203,
    61: 209, 62: 215, 63: 221, 64: 227, 65: 234, 66: 239, 67: 243, 68: 248, 69: 252, 70: 258
  };

  function getLevelBonus(level) {
    var lv = parseInt(level, 10);
    if (!Number.isFinite(lv)) return 0;
    if (lv < 1) lv = 1;
    if (lv > 70) lv = 70;
    return LEVEL_BONUS[lv] || 0;
  }

  // エナジーを Lv / FB で再計算
  // initialEnergy: Lv1 の表示エナジー (= レシピ基本エナジー)
  // level: 1-65(70)
  // fb: 0-85 (%)
  // 計算式: Lv補正後 = initial + round(initial * bonus/100)
  //         FB補正後 = floor(Lv補正後 * (1 + fb/100))
  // wiki 検証式に準拠 (Round = half up, Floor で切捨て)
  function calcEnergy(initialEnergy, level, fbPercent) {
    var bonus = getLevelBonus(level);
    var lvEnergy = initialEnergy + Math.round(initialEnergy * bonus / 100);
    var fb = parseInt(fbPercent, 10);
    if (!Number.isFinite(fb) || fb <= 0) return lvEnergy;
    if (fb < 0) fb = 0;
    if (fb > 85) fb = 85;
    return Math.floor(lvEnergy * (1 + fb / 100));
  }

  // グローバル公開 (バニラJS、モジュールなし)
  window.RecipeEnergy = {
    LEVEL_BONUS: LEVEL_BONUS,
    getLevelBonus: getLevelBonus,
    calcEnergy: calcEnergy
  };
})();
