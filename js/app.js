(function () {
  "use strict";

  const ABBR = {
    "ふといながねぎ": "ながねぎ",
    "あじわいキノコ": "キノコ",
    "とくせんエッグ": "エッグ",
    "ほっこりポテト": "ポテト",
    "とくせんリンゴ": "リンゴ",
    "げきからハーブ": "ハーブ",
    "マメミート": "ミート",
    "モーモーミルク": "ミルク",
    "あまいミツ": "ミツ",
    "ピュアなオイル": "オイル",
    "あったかジンジャー": "ジンジャー",
    "あんみんトマト": "トマト",
    "リラックスカカオ": "カカオ",
    "おいしいシッポ": "シッポ",
    "ワカクサ大豆": "大豆",
    "ワカクサコーン": "コーン",
    "めざましコーヒー": "コーヒー",
    "ずっしりカボチャ": "カボチャ",
    "つやつやアボカド": "アボカド"
  };

  const abbr = (name) => ABBR[name] || name;

  const CATEGORIES = [
    { key: "curry", label: "カレー" },
    { key: "dessert", label: "デザート" },
    { key: "salad", label: "サラダ" }
  ];

  const LS_LEVEL = "pokemon-sleep-level-v1";
  const LS_FB = "pokemon-sleep-fb-v1";

  const state = {
    ingredients: [],
    categories: {},
    ngSet: new Set(),
    hlSet: new Set(),
    level: 1,
    fb: 0,
    lastHits: null
  };

  function getEnergy(initial) {
    if (window.RecipeEnergy && window.RecipeEnergy.calcEnergy) {
      return window.RecipeEnergy.calcEnergy(initial, state.level, state.fb);
    }
    return initial;
  }

  function formatLevelMult(level) {
    if (window.RecipeEnergy && window.RecipeEnergy.getLevelBonus) {
      var bonus = window.RecipeEnergy.getLevelBonus(level);
      var mult = 1 + bonus / 100;
      return mult.toFixed(2) + "倍";
    }
    return "";
  }

  function updateLevelLabel() {
    if (els.levelVal) els.levelVal.textContent = String(state.level);
    if (els.levelMult) els.levelMult.textContent = " (" + formatLevelMult(state.level) + ")";
  }

  function loadEnergySettings() {
    try {
      var lv = parseInt(localStorage.getItem(LS_LEVEL), 10);
      if (Number.isFinite(lv) && lv >= 1 && lv <= 70) state.level = lv;
      var fb = parseInt(localStorage.getItem(LS_FB), 10);
      if (Number.isFinite(fb) && fb >= 0 && fb <= 85) state.fb = fb;
    } catch (e) {}
  }

  function saveEnergySettings() {
    try {
      localStorage.setItem(LS_LEVEL, String(state.level));
      localStorage.setItem(LS_FB, String(state.fb));
    } catch (e) {}
  }

  const LS_KEY = "pokemon-sleep-hl-v1";

  function loadHl() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      if (Array.isArray(arr)) state.hlSet = new Set(arr);
    } catch (e) {
      state.hlSet = new Set();
    }
  }

  function saveHl() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify([...state.hlSet]));
    } catch (e) {
      // ignore (private mode etc.)
    }
  }

  const $ = (id) => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const els = {
    maxTypes: $("max-types"),
    maxPot: $("max-pot"),
    minRatio: $("min-ratio"),
    minEnergy: $("min-energy"),
    filterEnergy: $("filter-energy"),
    ngList: $("ng-list"),
    ngClear: $("ng-clear"),
    hlList: $("hl-list"),
    hlClear: $("hl-clear"),
    search: $("search"),
    count: $("result-count"),
    results: $("results"),
    levelSlider: $("recipe-level"),
    fbSlider: $("field-bonus"),
    levelVal: $("level-val"),
    levelMult: $("level-mult"),
    fbVal: $("fb-val"),
    exportBtn: $("export-image"),
    exportStatus: $("export-status")
  };

  function initEnergyControls() {
    loadEnergySettings();
    if (els.levelSlider) {
      els.levelSlider.value = String(state.level);
      updateLevelLabel();
      els.levelSlider.addEventListener("input", () => {
        state.level = parseInt(els.levelSlider.value, 10) || 1;
        updateLevelLabel();
        saveEnergySettings();
        if (state.lastHits) search();
      });
    }
    if (els.fbSlider) {
      els.fbSlider.value = String(state.fb);
      if (els.fbVal) els.fbVal.textContent = state.fb + "%";
      els.fbSlider.addEventListener("input", () => {
        state.fb = parseInt(els.fbSlider.value, 10) || 0;
        if (els.fbVal) els.fbVal.textContent = state.fb + "%";
        saveEnergySettings();
        if (state.lastHits) search();
      });
    }
  }

  async function loadData() {
    const [ingredients, ...lists] = await Promise.all([
      fetch("food/ingredients.json").then((r) => r.json()),
      ...CATEGORIES.map((c) =>
        fetch("food/recipes/" + c.key + ".json").then((r) => r.json())
      )
    ]);
    state.ingredients = ingredients;
    CATEGORIES.forEach((c, i) => {
      state.categories[c.key] = {
        label: c.label,
        recipes: lists[i].recipes
      };
    });
    loadHl();
    renderNgList();
    renderHlList();
    initEnergyControls();
    els.search.disabled = false;
  }

  function renderNgList() {
    const frag = document.createDocumentFragment();
    for (const name of state.ingredients) {
      const label = document.createElement("label");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.dataset.name = name;
      check.checked = state.ngSet.has(name);
      check.addEventListener("change", () => {
        if (check.checked) state.ngSet.add(name);
        else state.ngSet.delete(name);
      });
      label.appendChild(check);
      label.appendChild(document.createTextNode(abbr(name)));
      frag.appendChild(label);
    }
    els.ngList.innerHTML = "";
    els.ngList.appendChild(frag);
  }

  els.ngClear.addEventListener("click", () => {
    state.ngSet.clear();
    els.ngList
      .querySelectorAll('input[type="checkbox"]')
      .forEach((cb) => (cb.checked = false));
  });

  function renderHlList() {
    const frag = document.createDocumentFragment();
    for (const name of state.ingredients) {
      const label = document.createElement("label");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.dataset.name = name;
      check.checked = state.hlSet.has(name);
      check.addEventListener("change", () => {
        if (check.checked) state.hlSet.add(name);
        else state.hlSet.delete(name);
        saveHl();
      });
      label.appendChild(check);
      label.appendChild(document.createTextNode(abbr(name)));
      frag.appendChild(label);
    }
    els.hlList.innerHTML = "";
    els.hlList.appendChild(frag);
  }

  els.hlClear.addEventListener("click", () => {
    state.hlSet.clear();
    els.hlList
      .querySelectorAll('input[type="checkbox"]')
      .forEach((cb) => (cb.checked = false));
    saveHl();
  });

  function ingredientsOf(recipe) {
    return recipe.ingredients.map((i) => i.name);
  }

  function unionOf(dishes) {
    const set = new Set();
    for (const dish of dishes) {
      for (const name of ingredientsOf(dish)) set.add(name);
    }
    return set;
  }

  function maxQuantities(dishes) {
    const counts = {};
    for (const dish of dishes) {
      for (const ing of dish.ingredients) {
        counts[ing.name] = Math.max(counts[ing.name] || 0, ing.count);
      }
    }
    return counts;
  }

  function totalCount(recipe) {
    return recipe.ingredients.reduce((s, ing) => s + ing.count, 0);
  }

  function search() {
    const maxTypes = parseInt(els.maxTypes.value, 10) || Infinity;
    const maxPotRaw = els.maxPot ? els.maxPot.value.trim() : "";
    const maxPot = maxPotRaw === "" ? Infinity : parseInt(maxPotRaw, 10) || Infinity;
    const useEnergy = els.filterEnergy.checked;
    const minRatio = useEnergy ? 0 : parseFloat(els.minRatio.value) || 0;
    const minEnergy = useEnergy ? parseInt(els.minEnergy.value, 10) || 0 : 0;

    const candidates = [];
    for (const key of Object.keys(state.categories)) {
      candidates.push(state.categories[key].recipes.map((r) => ({ key, recipe: r })));
    }

    const hits = [];
    const [curries, desserts, salads] = candidates;
    for (const curry of curries) {
      for (const dessert of desserts) {
        for (const salad of salads) {
          const dishes = [curry, dessert, salad];
          if (dishes.some(({ recipe }) => recipe.ingredients.some((i) => state.ngSet.has(i.name)))) {
            continue;
          }
          if (Number.isFinite(maxPot) && maxPot !== Infinity) {
            if (dishes.some(({ recipe }) => totalCount(recipe) > maxPot)) continue;
          }
          const union = unionOf(dishes.map((d) => d.recipe));
          if (union.size > maxTypes) continue;
          if (useEnergy) {
            if (dishes.some(({ recipe }) => getEnergy(recipe.initialEnergy) < minEnergy)) continue;
          } else if (dishes.some(({ recipe }) => recipe.ratio < minRatio)) {
            continue;
          }
          const minEnergyInHit = Math.min(...dishes.map((d) => getEnergy(d.recipe.initialEnergy)));
          hits.push({
            dishes,
            union,
            unionSize: union.size,
            quantities: maxQuantities(dishes.map((d) => d.recipe)),
            minEnergy: minEnergyInHit
          });
        }
      }
    }

    hits.sort((a, b) => {
      if (a.unionSize !== b.unionSize) return a.unionSize - b.unionSize;
      return b.minEnergy - a.minEnergy;
    });
    state.lastHits = hits;
    render(hits);
  }

  function buildExportMeta() {
    var lvMult = formatLevelMult(state.level);
    var lvTxt = "Lv" + state.level + (lvMult ? "(" + lvMult + ")" : "");
    var dt = new Date().toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    return lvTxt + "  \u00b7  FB" + state.fb + "%  \u00b7  " + dt + " 出力";
  }

  function setExportEnabled(enabled) {
    if (!els.exportBtn) return;
    els.exportBtn.disabled = !enabled;
  }

 function setExportStatus(msg, kind) {
    if (!els.exportStatus) return;
    if (!msg) {
      els.exportStatus.hidden = true;
      els.exportStatus.textContent = "";
      els.exportStatus.className = "export-status";
      return;
    }
    els.exportStatus.hidden = false;
    els.exportStatus.textContent = msg;
    els.exportStatus.className = "export-status " + (kind || "");
  }

  function render(hits) {
    els.count.textContent = hits.length + "件";
    els.results.innerHTML = "";
    setExportEnabled(hits.length > 0);
    setExportStatus("", "");

    if (hits.length === 0) {
      els.results.appendChild(el("div", "empty", "条件に合う組み合わせがありません"));
      return;
    }

    const frag = document.createDocumentFragment();
    for (const hit of hits.slice(0, 500)) {
      const card = document.createElement("div");
      card.className = "result-card";

      const dishes = document.createElement("div");
      dishes.className = "dishes";
      for (const { key, recipe } of hit.dishes) {
        const dish = document.createElement("span");
        dish.className = "dish";
        const cat = document.createElement("span");
        cat.className = "cat";
        cat.textContent = state.categories[key].label;
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = recipe.name;
        const total = document.createElement("span");
        total.className = "total";
        total.textContent = String(totalCount(recipe));
        const ratio = document.createElement("span");
        ratio.className = "ratio";
        ratio.textContent = recipe.ratio.toFixed(2);
        const energy = document.createElement("span");
        energy.className = "energy";
        energy.textContent = "エナジー " + getEnergy(recipe.initialEnergy).toLocaleString();
        dish.append(cat, name, total, ratio, energy);
        dishes.appendChild(dish);
      }

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = "食材 " + hit.unionSize + " 種類";

      const ings = document.createElement("div");
      ings.className = "ings";
      for (const [name, qty] of Object.entries(hit.quantities).sort()) {
        const chip = document.createElement("span");
        chip.className = state.hlSet.has(name) ? "ing-chip hl" : "ing-chip";
        chip.textContent = abbr(name) + " ×" + qty;
        ings.appendChild(chip);
      }

      card.append(dishes, meta, ings);
      frag.appendChild(card);
    }
    els.results.appendChild(frag);
  }

  els.search.addEventListener("click", search);

els.filterEnergy.addEventListener("change", () => {
  const useEnergy = els.filterEnergy.checked;
  els.minRatio.disabled = useEnergy;
  els.minEnergy.disabled = !useEnergy;
});

  if (els.exportBtn) {
    els.exportBtn.addEventListener("click", async () => {
      if (!state.lastHits || state.lastHits.length === 0) {
        setExportStatus("エクスポートする結果がありません。先に検索してください。", "err");
        return;
      }
      var origText = els.exportBtn.textContent;
      els.exportBtn.disabled = true;
      els.exportBtn.textContent = "生成中...";
      setExportStatus("画像を生成しています...", "ok");
      try {
        var filename = "pokemonsleep_search_" + (window.PokemonExport ? window.PokemonExport.todayStr() : new Date().toISOString().slice(0,10)) + ".png";
        var title = "ポケモンスリープ 料理サーチ 結果 (" + state.lastHits.length + "件)";
        var meta = buildExportMeta();
        // 上位20件のみを画像に含める旨をサブタイトルで示す
        var subtitle = state.lastHits.length > 20 ? "上位20件を表示（全" + state.lastHits.length + "件中）" : "";
        if (window.PokemonExport && window.PokemonExport.exportElement) {
          await window.PokemonExport.exportElement("results", { title: title, subtitle: subtitle, metaText: meta, filename: filename });
          setExportStatus("画像を保存しました: " + filename, "ok");
        } else {
          throw new Error("エクスポート機能の読み込みに失敗しました");
        }
      } catch (e) {
        setExportStatus(e.message || String(e), "err");
      } finally {
        els.exportBtn.textContent = origText;
        els.exportBtn.disabled = false;
      }
    });
  }

  loadData().catch((err) => {
    els.results.innerHTML = '<div class="loading">データの読み込みに失敗しました: ' + err.message + "</div>";
  });
})();