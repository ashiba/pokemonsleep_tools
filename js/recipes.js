(function () {
  "use strict";

  const CATEGORIES = [
    { key: "curry" },
    { key: "salad" },
    { key: "dessert" }
  ];

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

  const LS_LEVEL = "pokemon-sleep-level-v1";
  const LS_FB = "pokemon-sleep-fb-v1";

  const MOBILE_MAX = 900;
  const TAB_ALL = "all";
  const state = {
    ingredients: [],
    categories: {},
    catCountEl: {},
    catTotal: {},
    catVisible: {},
    catSectionEl: {},
    selected: new Map(),
    level: 1,
    fb: 0,
    activeTab: null
  };

  function isMobile() {
    return window.matchMedia("(max-width: " + MOBILE_MAX + "px)").matches;
  }

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

  function updateEnergyDisplays() {
    for (const key of Object.keys(state.categories)) {
      const recipes = state.categories[key].recipes;
      document.querySelectorAll('.recipe-card[data-cat="' + key + '"]').forEach((card) => {
        const recipe = recipes[+card.dataset.ridx];
        if (!recipe) return;
        const span = card.querySelector(".energy");
        if (span) span.textContent = "E: " + getEnergy(recipe.initialEnergy).toLocaleString();
      });
    }
  }

  function setSelectedMult(key, mult) {
    if (!state.selected.has(key)) return;
    state.selected.set(key, mult);
    updateSelectedSummary();
    apply();
  }

  function setBulkMult(mult) {
    if (state.selected.size === 0) return;
    for (const k of state.selected.keys()) state.selected.set(k, mult);
    updateSelectedSummary();
    apply();
  }

  function calcServings(recipe, base) {
    let min = Infinity;
    for (const ing of recipe.ingredients) {
      const owned = base[ing.name] || 0;
      if (owned < 0) return 0;
      const s = Math.floor(owned / ing.count);
      if (s < min) min = s;
      if (min === 0) return 0;
    }
    return min === Infinity ? 0 : min;
  }

  const $ = (id) => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const els = {
    modeCheck: $("mode-check"),
    modeCount: $("mode-count"),
    checkPane: $("check-pane"),
    countPane: $("count-pane"),
    checks: $("ing-checks"),
    counts: $("ing-counts"),
    clearCheck: $("clear-check"),
    clearCount: $("clear-count"),
    catFilters: $("cat-filters"),
    recipeTabs: $("recipe-tabs"),
    recipes: $("recipes"),
    selectedCount: $("selected-count"),
    selectedSummary: $("selected-summary"),
    clearSelected: $("clear-selected"),
    reserveSection: $("reserve-section"),
    reserveSummary: $("reserve-summary"),
    reserveWarn: $("reserve-warn"),
    useRemaining: $("use-remaining"),
    ocrBtn: $("ocr-btn"),
    ocrModal: $("ocr-modal"),
    ocrBackdrop: $("ocr-backdrop"),
    ocrClose: $("ocr-close"),
    ocrCancel: $("ocr-cancel"),
    ocrDrop: $("ocr-drop"),
    ocrFile: $("ocr-file"),
    ocrRun: $("ocr-run"),
    ocrBar: $("ocr-bar"),
    ocrStatus: $("ocr-status"),
    ocrProgress: $("ocr-progress"),
    ocrWarn: $("ocr-warn"),
    ocrPreview: $("ocr-preview"),
    ocrThumb: $("ocr-thumb"),
    ocrFilename: $("ocr-filename"),
    levelSlider: $("recipe-level"),
    fbSlider: $("field-bonus"),
    levelVal: $("level-val"),
    levelMult: $("level-mult"),
    fbVal: $("fb-val"),
    exportBtn: $("export-recipes-image"),
    exportStatus: $("export-recipes-status")
  };

  function initEnergyControls() {
    loadEnergySettings();
    if (els.levelSlider) {
      els.levelSlider.value = String(state.level);
      els.levelSlider.addEventListener("input", () => {
        state.level = parseInt(els.levelSlider.value, 10) || 1;
        updateLevelLabel();
        saveEnergySettings();
        updateEnergyDisplays();
      });
      updateLevelLabel();
    }
    if (els.fbSlider) {
      els.fbSlider.value = String(state.fb);
      els.fbSlider.addEventListener("input", () => {
        state.fb = parseInt(els.fbSlider.value, 10) || 0;
        if (els.fbVal) els.fbVal.textContent = state.fb + "%";
        saveEnergySettings();
        updateEnergyDisplays();
      });
      if (els.fbVal) els.fbVal.textContent = state.fb + "%";
    }
  }

  async function loadData() {
    const [ingredients, ...lists] = await Promise.all([
      fetch("food/ingredients.json").then((r) => r.json()),
      ...CATEGORIES.map((c) => fetch("food/recipes/" + c.key + ".json").then((r) => r.json()))
    ]);
    state.ingredients = ingredients;
    CATEGORIES.forEach((c, i) => {
      const recipes = lists[i].recipes.slice().sort((a, b) => b.ratio - a.ratio || b.initialEnergy - a.initialEnergy);
      state.categories[c.key] = {
        label: lists[i].category,
        recipes: recipes
      };
    });
    buildInputs();
    buildCatFilters();
    buildTabs();
    initEnergyControls();
    renderAll();
    updateEnergyDisplays();
    apply();
    updateSelectedSummary();
    applyTabVisibility();
    initTabSwipe();
    initTabKeyboard();
    window.addEventListener("resize", applyTabVisibility);
  }

  function buildCatFilters() {
    for (const key of Object.keys(state.categories)) {
      state.catVisible[key] = true;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat-filter on";
      btn.dataset.key = key;
      btn.appendChild(document.createTextNode(state.categories[key].label + " "));
      const st = el("span", "st", "ON");
      btn.appendChild(st);
      btn.addEventListener("click", () => toggleCat(key, btn, st));
      els.catFilters.appendChild(btn);
    }
  }

  function toggleCat(key, btn, st) {
    const visible = !state.catVisible[key];
    state.catVisible[key] = visible;
    btn.classList.toggle("on", visible);
    st.textContent = visible ? "ON" : "OFF";
    applyTabVisibility();
  }

  function buildTabs() {
    if (!els.recipeTabs) return;
    els.recipeTabs.innerHTML = "";
    const keys = Object.keys(state.categories);
    // default active = first category (ensures 1 category visible on mobile per spec)
    if (!state.activeTab) state.activeTab = keys[0] || TAB_ALL;
    function makeTab(key, label, controls) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "recipe-tab";
      btn.setAttribute("role", "tab");
      btn.id = "tab-" + key;
      if (controls) btn.setAttribute("aria-controls", controls);
      btn.dataset.key = key;
      btn.textContent = label;
      btn.addEventListener("click", () => setActiveTab(key));
      els.recipeTabs.appendChild(btn);
      return btn;
    }
    const allControls = keys.map((k) => "panel-" + k).join(" ");
    makeTab(TAB_ALL, "全て", allControls);
    for (const k of keys) {
      makeTab(k, state.categories[k].label, "panel-" + k);
    }
    els.recipeTabs.hidden = false;
    updateTabsUI();
  }

  function setActiveTab(key) {
    state.activeTab = key;
    updateTabsUI();
    applyTabVisibility();
  }

  function updateTabsUI() {
    if (!els.recipeTabs) return;
    const tabs = els.recipeTabs.querySelectorAll('[role="tab"]');
    tabs.forEach((t) => {
      const isActive = t.dataset.key === state.activeTab;
      t.setAttribute("aria-selected", isActive ? "true" : "false");
      t.tabIndex = isActive ? 0 : -1;
    });
  }

  function applyTabVisibility() {
    const keys = Object.keys(state.categories);
    if (isMobile()) {
      for (const k of keys) {
        const sec = state.catSectionEl[k];
        if (!sec) continue;
        const show = state.activeTab === TAB_ALL || state.activeTab === k;
        sec.hidden = !show;
        sec.style.display = "";
      }
    } else {
      for (const k of keys) {
        const sec = state.catSectionEl[k];
        if (!sec) continue;
        sec.hidden = false;
        sec.style.display = state.catVisible[k] ? "" : "none";
      }
    }
  }

  function getTabOrder() {
    return [TAB_ALL].concat(Object.keys(state.categories));
  }

  function getSwipeOrder() {
    return Object.keys(state.categories);
  }

  function initTabSwipe() {
    if (!els.recipes) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    els.recipes.addEventListener("touchstart", (e) => {
      if (!isMobile()) return;
      if (e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    els.recipes.addEventListener("touchend", (e) => {
      if (!tracking) return;
      tracking = false;
      if (!isMobile()) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 50) return;
      if (Math.abs(dx) < Math.abs(dy)) return;
      const order = getSwipeOrder();
      let idx = order.indexOf(state.activeTab);
      if (idx === -1) {
        // if "all" or unknown, go to first/last depending on direction
        idx = dx < 0 ? -1 : 0;
      }
      let nextIdx;
      if (dx < 0) {
        // swipe left -> next
        nextIdx = (idx + 1) % order.length;
      } else {
        nextIdx = (idx - 1 + order.length) % order.length;
      }
      setActiveTab(order[nextIdx]);
      const nextTab = els.recipeTabs && els.recipeTabs.querySelector('[data-key="' + order[nextIdx] + '"]');
      if (nextTab) nextTab.focus({ preventScroll: true });
    }, { passive: true });
  }

  function initTabKeyboard() {
    if (!els.recipeTabs) return;
    els.recipeTabs.addEventListener("keydown", (e) => {
      const tabs = Array.from(els.recipeTabs.querySelectorAll('[role="tab"]'));
      const idx = tabs.indexOf(document.activeElement);
      if (idx === -1) return;
      let next = -1;
      if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      else return;
      e.preventDefault();
      const target = tabs[next];
      if (target) {
        setActiveTab(target.dataset.key);
        target.focus();
      }
    });
  }

  function buildInputs() {
    const checkFrag = document.createDocumentFragment();
    for (const name of state.ingredients) {
      const label = document.createElement("label");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.dataset.name = name;
      check.addEventListener("change", apply);
      label.appendChild(check);
      label.appendChild(document.createTextNode(abbr(name)));
      checkFrag.appendChild(label);
    }
    els.checks.appendChild(checkFrag);

    const countFrag = document.createDocumentFragment();
    for (const name of state.ingredients) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = "0";
      input.dataset.name = name;
      input.addEventListener("input", apply);
      label.appendChild(document.createTextNode(abbr(name)));
      label.appendChild(input);
      countFrag.appendChild(label);
    }
    els.counts.appendChild(countFrag);
  }

  function renderAll() {
    const frag = document.createDocumentFragment();
    for (const key of Object.keys(state.categories)) {
      const section = el("section", "cat-section");
      section.id = "panel-" + key;
      section.setAttribute("role", "tabpanel");
      section.setAttribute("aria-labelledby", "tab-" + key);
      state.catSectionEl[key] = section;
      const h2 = el("h2", "cat-name", state.categories[key].label);
      const countEl = el("span", "cat-count");
      h2.appendChild(countEl);
      section.appendChild(h2);
      state.catCountEl[key] = countEl;
      state.catTotal[key] = state.categories[key].recipes.length;
      const list = el("div", "cat-list");
      state.categories[key].recipes.forEach((recipe, idx) => {
        const card = document.createElement("div");
        card.className = "recipe-card";
        card.dataset.cat = key;
        card.dataset.ridx = idx;

        const dish = el("div", "dish");
        const checkLabel = document.createElement("label");
        checkLabel.className = "recipe-check";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.dataset.key = key + ":" + idx;
        cb.addEventListener("change", () => {
          const k = cb.dataset.key;
          if (cb.checked) state.selected.set(k, 1);
          else state.selected.delete(k);
          card.classList.toggle("selected", cb.checked);
          updateSelectedSummary();
          apply();
        });
        checkLabel.appendChild(cb);
        dish.appendChild(checkLabel);
        dish.appendChild(el("span", "name", recipe.name));
        const meta = el("div", "dish-meta");
        meta.appendChild(el("span", "total", "" + recipe.totalCount));
        meta.appendChild(el("span", "ratio", recipe.ratio.toFixed(2)));
        meta.appendChild(el("span", "energy", "E: " + getEnergy(recipe.initialEnergy).toLocaleString()));
        const badge = el("span", "servings-badge");
        badge.hidden = true;
        meta.appendChild(badge);
        dish.appendChild(meta);
        card.appendChild(dish);

        const ings = el("div", "ings");
        for (const ing of recipe.ingredients) {
          const chip = el("span", "ing-chip", abbr(ing.name) + " ×" + ing.count);
          chip.dataset.name = ing.name;
          ings.appendChild(chip);
        }
        card.appendChild(ings);
        list.appendChild(card);
      });
      section.appendChild(list);
      frag.appendChild(section);
    }
    els.recipes.appendChild(frag);
  }

  function getReserveCounts() {
    const perCat = {};
    for (const [key, mult] of state.selected) {
      const [cat, idxStr] = key.split(":");
      const idx = parseInt(idxStr, 10);
      const recipe = state.categories[cat] && state.categories[cat].recipes[idx];
      if (!recipe) continue;
      const m = mult || 1;
      if (!perCat[cat]) perCat[cat] = {};
      for (const ing of recipe.ingredients) {
        const need = ing.count * m;
        perCat[cat][ing.name] = (perCat[cat][ing.name] || 0) + need;
      }
    }
    const maxCounts = {};
    for (const cat of Object.keys(perCat)) {
      for (const [name, qty] of Object.entries(perCat[cat])) {
        maxCounts[name] = Math.max(maxCounts[name] || 0, qty);
      }
    }
    return maxCounts;
  }

  function getOwnedRawCounts() {
    const owned = {};
    if (!els.counts) return owned;
    els.counts.querySelectorAll("input").forEach((inp) => {
      const v = parseInt(inp.value, 10);
      owned[inp.dataset.name] = Number.isFinite(v) ? v : 0;
    });
    return owned;
  }

  function renderReserveSection() {
    if (!els.reserveSection) return;
    const useCount = els.modeCount && els.modeCount.checked;
    const count = state.selected.size;
    if (!useCount || count === 0) {
      els.reserveSection.hidden = true;
      return;
    }
    els.reserveSection.hidden = false;
    const reserve = getReserveCounts();
    const ownedRaw = getOwnedRawCounts();
    // チップ: 残り = 所持 − 確保（同一カテゴリ内は合計・カテゴリ間は最大値） マイナスは警告表示。並びは state.ingredients 順
    let hasNeg = false;
    const negNames = [];
    if (els.reserveSummary) {
      els.reserveSummary.innerHTML = "";
      let hasAny = false;
      for (const name of state.ingredients) {
        const owned = ownedRaw[name] || 0;
        const need = reserve[name] || 0;
        if (owned === 0 && need === 0) continue;
        hasAny = true;
        const remain = owned - need;
        if (remain < 0) {
          hasNeg = true;
          negNames.push(abbr(name) + "×" + Math.abs(remain));
        }
        const chip = el("span", "ing-chip" + (remain < 0 ? " miss" : ""), abbr(name) + " ×" + remain + (remain < 0 ? " ⚠" : ""));
        if (remain < 0) chip.title = "不足 " + Math.abs(remain) + "個";
        els.reserveSummary.appendChild(chip);
      }
      if (!hasAny) {
        els.reserveSummary.textContent = "所持・確保ともに対象なし";
      }
    } else {
      for (const name of state.ingredients) {
        const owned = ownedRaw[name] || 0;
        const need = reserve[name] || 0;
        if (owned === 0 && need === 0) continue;
        const remain = owned - need;
        if (remain < 0) {
          hasNeg = true;
          negNames.push(abbr(name) + "×" + Math.abs(remain));
        }
      }
    }
    if (els.reserveWarn) {
      if (hasNeg) {
        els.reserveWarn.hidden = false;
        els.reserveWarn.className = "ocr-warn err";
        els.reserveWarn.textContent = "所持が不足: " + negNames.join(" / ") + " — マイナスは来週分を確保できない不足数です。";
      } else {
        els.reserveWarn.hidden = true;
        els.reserveWarn.textContent = "";
        els.reserveWarn.className = "ocr-warn warn";
      }
    }
  }

  function updateSelectedSummary() {
    const count = state.selected.size;
    if (els.selectedCount) els.selectedCount.textContent = count + "件";
    if (!els.selectedSummary) {
      renderReserveSection();
      return;
    }
    if (count === 0) {
      els.selectedSummary.className = "empty";
      els.selectedSummary.textContent = "レシピにチェックを入れると必要食材が表示されます";
      renderReserveSection();
      return;
    }
    const maxCounts = getReserveCounts();
    els.selectedSummary.className = "";
    els.selectedSummary.innerHTML = "";
    // まとめて倍率切替
    const bulk = el("div", "bulk-mult");
    bulk.appendChild(el("span", "bulk-mult-label", "全部まとめて:"));
    [1, 2, 3].forEach((m) => {
      const b = el("button", "mult-btn", "×" + m);
      b.type = "button";
      b.setAttribute("aria-label", "全部を×" + m + "に");
      b.addEventListener("click", () => setBulkMult(m));
      bulk.appendChild(b);
    });
    els.selectedSummary.appendChild(bulk);
    // 選択レシピ一覧（レシピごとに可変の倍率）
    const list = el("div", "selected-list");
    for (const [key, mult] of state.selected) {
      const [cat, idxStr] = key.split(":");
      const idx = parseInt(idxStr, 10);
      const recipe = state.categories[cat] && state.categories[cat].recipes[idx];
      if (!recipe) continue;
      const item = el("div", "selected-item");
      const catLabel = state.categories[cat] ? state.categories[cat].label : cat;
      const nameWrap = el("span", "selected-name");
      nameWrap.textContent = recipe.name;
      const catSpan = el("span", "selected-cat", " (" + catLabel + ")");
      catSpan.style.fontSize = "0.75rem";
      catSpan.style.color = "var(--muted)";
      catSpan.style.fontWeight = "400";
      nameWrap.appendChild(catSpan);
      item.appendChild(nameWrap);
      const btnWrap = el("span", "mult-btns");
      [1, 2, 3].forEach((m) => {
        const b = el("button", "mult-btn" + (mult === m ? " on" : ""), "×" + m);
        b.type = "button";
        b.setAttribute("aria-label", recipe.name + "を" + m + "倍");
        b.dataset.key = key;
        b.dataset.mult = String(m);
        b.addEventListener("click", () => setSelectedMult(key, m));
        btnWrap.appendChild(b);
      });
      item.appendChild(btnWrap);
      list.appendChild(item);
    }
    els.selectedSummary.appendChild(list);
    // 集計チップ（同一カテゴリ内は合計・カテゴリ間は最大値 × 倍率）
    const chipsWrap = el("div", "ings");
    chipsWrap.style.marginTop = "10px";
    let totalTypes = 0;
    for (const name of state.ingredients) {
      const qty = maxCounts[name];
      if (qty == null) continue;
      totalTypes++;
      const chip = el("span", "ing-chip", abbr(name) + " ×" + qty);
      chipsWrap.appendChild(chip);
    }
    els.selectedSummary.appendChild(chipsWrap);
    const totalCount = Object.values(maxCounts).reduce((s, n) => s + n, 0);
    const meta = el("div", "selected-meta");
    meta.textContent = totalTypes + "種類 / 合計" + totalCount + "個 (同一カテゴリ内は合計・カテゴリ間は最大)";
    els.selectedSummary.appendChild(meta);
    renderReserveSection();
  }

  function resetCard(card) {
    card.classList.remove("creatable");
    card.querySelectorAll(".ing-chip").forEach((chip) => {
      chip.classList.remove("ok", "miss");
    });
    const badge = card.querySelector(".servings-badge");
    if (badge) {
      badge.hidden = true;
      badge.textContent = "";
      badge.classList.remove("show");
    }
  }

  function apply() {
    const useCount = els.modeCount.checked;
    let owned = {};
    let total = 0;
    let selected = new Set();

    if (useCount) {
      els.counts.querySelectorAll("input").forEach((inp) => {
        const v = parseInt(inp.value, 10);
        if (Number.isFinite(v) && v > 0) {
          owned[inp.dataset.name] = v;
          total += v;
        }
      });
    } else {
      els.checks.querySelectorAll("input:checked").forEach((cb) => selected.add(cb.dataset.name));
    }

    const hasInput = useCount ? total > 0 : selected.size > 0;

    // 案B: 残りで判定（確保後に作れるかを残り基準で再計算）
    let effective = owned;
    let useRemaining = false;
    if (useCount && els.useRemaining && els.useRemaining.checked && state.selected.size > 0) {
      const reserve = getReserveCounts();
      const ownedRaw = getOwnedRawCounts();
      const remaining = {};
      for (const name of state.ingredients) {
        remaining[name] = (ownedRaw[name] || 0) - (reserve[name] || 0);
      }
      effective = remaining;
      useRemaining = true;
    }

    for (const key of Object.keys(state.categories)) {
      const recipes = state.categories[key].recipes;
      let n = 0;
      els.recipes.querySelectorAll('.recipe-card[data-cat="' + key + '"]').forEach((card) => {
        const recipe = recipes[+card.dataset.ridx];
        if (!hasInput) {
          resetCard(card);
          return;
        }

        if (useCount) {
          const base = useRemaining ? effective : owned;
          let all = recipe.ingredients.every((ing) => (base[ing.name] || 0) >= ing.count);
          card.classList.toggle("creatable", all);
          if (all) n++;
          card.querySelectorAll(".ing-chip").forEach((chip) => {
            const ing = recipe.ingredients.find((i) => i.name === chip.dataset.name);
            const ok = (base[ing.name] || 0) >= ing.count;
            chip.classList.toggle("ok", ok);
            chip.classList.toggle("miss", !ok);
          });
          const badge = card.querySelector(".servings-badge");
          if (badge) {
            const servings = calcServings(recipe, base);
            if (servings >= 1) {
              badge.textContent = "×" + servings + "食";
              badge.hidden = false;
              badge.classList.add("show");
            } else {
              badge.textContent = "";
              badge.hidden = true;
              badge.classList.remove("show");
            }
          }
        } else {
          let all = true;
          for (const ing of recipe.ingredients) {
            if (!selected.has(ing.name)) all = false;
          }
          card.classList.toggle("creatable", all);
          if (all) n++;
          card.querySelectorAll(".ing-chip").forEach((chip) => {
            const ok = selected.has(chip.dataset.name);
            chip.classList.toggle("ok", ok);
            chip.classList.toggle("miss", !ok);
          });
          const badge = card.querySelector(".servings-badge");
          if (badge) {
            badge.hidden = true;
            badge.textContent = "";
            badge.classList.remove("show");
          }
        }
      });
      state.catCountEl[key].textContent = n + "/" + state.catTotal[key];
    }
    // 残り表示は常に最新化（個数入力変更時にも反映）
    renderReserveSection();
  }

  function switchPane() {
    els.checkPane.hidden = els.modeCount.checked;
    els.countPane.hidden = !els.modeCount.checked;
  }

  els.modeCheck.addEventListener("change", () => {
    switchPane();
    apply();
  });
  els.modeCount.addEventListener("change", () => {
    switchPane();
    apply();
  });

  els.clearCheck.addEventListener("click", () => {
    els.checks.querySelectorAll("input").forEach((cb) => (cb.checked = false));
    apply();
  });

  els.clearCount.addEventListener("click", () => {
    els.counts.querySelectorAll("input").forEach((inp) => (inp.value = "0"));
    apply();
  });

  if (els.clearSelected) {
    els.clearSelected.addEventListener("click", () => {
      state.selected.clear();
      els.recipes.querySelectorAll('.recipe-select, .recipe-check input[type="checkbox"]').forEach((cb) => (cb.checked = false));
      els.recipes.querySelectorAll(".recipe-card.selected").forEach((card) => card.classList.remove("selected"));
      // fallback: ensure all checkboxes unchecked
      els.recipes.querySelectorAll('input[data-key]').forEach((cb) => (cb.checked = false));
      document.querySelectorAll(".recipe-card").forEach((card) => card.classList.remove("selected"));
      updateSelectedSummary();
      apply();
    });
  }

  if (els.useRemaining) {
    els.useRemaining.addEventListener("change", () => {
      apply();
    });
  }

  // OCR: 数量一括入力
  function setCountsFromOCR(counts) {
    const inputs = els.counts.querySelectorAll("input");
    for (let i = 0; i < inputs.length && i < counts.length; i++) {
      const v = counts[i];
      inputs[i].value = String(Number.isFinite(v) ? v : 0);
    }
    apply();
  }

  // OCRモーダル制御
  (function initOCR() {
    if (!els.ocrBtn || !els.ocrModal) return;
    let selectedFile = null;

    function openModal() {
      els.ocrModal.hidden = false;
      els.ocrModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function closeModal() {
      els.ocrModal.hidden = true;
      els.ocrModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      // 進捗リセット（ファイル選択は保持しない）
      if (els.ocrRun.disabled === false && els.ocrProgress.hidden) {
        // idle時のみクリア
      }
    }
    function resetOCRState() {
      selectedFile = null;
      if (els.ocrFile) els.ocrFile.value = "";
      if (els.ocrPreview) els.ocrPreview.hidden = true;
      if (els.ocrRun) els.ocrRun.disabled = true;
      if (els.ocrProgress) els.ocrProgress.hidden = true;
      if (els.ocrBar) els.ocrBar.style.width = "0%";
      if (els.ocrStatus) els.ocrStatus.textContent = "待機中";
      if (els.ocrWarn) { els.ocrWarn.hidden = true; els.ocrWarn.textContent = ""; els.ocrWarn.className = "ocr-warn"; }
    }
    function setFile(file) {
      if (!file || !file.type.startsWith("image/")) {
        if (els.ocrWarn) {
          els.ocrWarn.textContent = "画像ファイル（PNG/JPG）を選択してください。";
          els.ocrWarn.className = "ocr-warn err";
          els.ocrWarn.hidden = false;
        }
        return;
      }
      selectedFile = file;
      if (els.ocrPreview) {
        const url = URL.createObjectURL(file);
        if (els.ocrThumb) {
          els.ocrThumb.src = url;
          els.ocrThumb.onload = () => URL.revokeObjectURL(url);
        }
        if (els.ocrFilename) els.ocrFilename.textContent = file.name + " (" + Math.round(file.size / 1024) + "KB)";
        els.ocrPreview.hidden = false;
      }
      if (els.ocrRun) els.ocrRun.disabled = false;
      if (els.ocrWarn) els.ocrWarn.hidden = true;
      if (els.ocrProgress) els.ocrProgress.hidden = true;
    }

    els.ocrBtn.addEventListener("click", () => {
      resetOCRState();
      openModal();
    });
    if (els.ocrClose) els.ocrClose.addEventListener("click", closeModal);
    if (els.ocrCancel) els.ocrCancel.addEventListener("click", closeModal);
    if (els.ocrBackdrop) els.ocrBackdrop.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.ocrModal.hidden) closeModal();
    });

    if (els.ocrDrop) {
      els.ocrDrop.addEventListener("click", (e) => {
        // inputクリックとの二重発火を防ぐ
        if (e.target === els.ocrFile) return;
      });
      els.ocrDrop.addEventListener("dragover", (e) => {
        e.preventDefault();
        els.ocrDrop.classList.add("drag");
      });
      els.ocrDrop.addEventListener("dragleave", () => els.ocrDrop.classList.remove("drag"));
      els.ocrDrop.addEventListener("drop", (e) => {
        e.preventDefault();
        els.ocrDrop.classList.remove("drag");
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) setFile(f);
      });
    }
    if (els.ocrFile) {
      els.ocrFile.addEventListener("change", () => {
        const f = els.ocrFile.files && els.ocrFile.files[0];
        if (f) setFile(f);
      });
    }
    window.addEventListener("paste", (e) => {
      if (els.ocrModal.hidden) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f && f.type.startsWith("image/")) {
            setFile(f);
            openModal();
            e.preventDefault();
            break;
          }
        }
      }
    });

    if (els.ocrRun) {
      els.ocrRun.addEventListener("click", async () => {
        if (!selectedFile) return;
        if (!window.PokemonBagOCR || !window.PokemonBagOCR.runOnce) {
          if (els.ocrWarn) {
            els.ocrWarn.textContent = "OCRモジュールの読み込みに失敗しました。ページを再読み込みしてください。";
            els.ocrWarn.className = "ocr-warn err";
            els.ocrWarn.hidden = false;
          }
          return;
        }
        els.ocrRun.disabled = true;
        els.ocrRun.textContent = "認識中...";
        if (els.ocrProgress) els.ocrProgress.hidden = false;
        if (els.ocrBar) els.ocrBar.style.width = "5%";
        if (els.ocrStatus) els.ocrStatus.textContent = "準備中...";
        if (els.ocrWarn) els.ocrWarn.hidden = true;

        try {
          const result = await window.PokemonBagOCR.runOnce(selectedFile, (msg, p) => {
            if (els.ocrStatus) els.ocrStatus.textContent = msg;
            if (typeof p === "number" && els.ocrBar) els.ocrBar.style.width = p + "%";
          });
          setCountsFromOCR(result.counts);
          if (els.ocrBar) els.ocrBar.style.width = "100%";
          if (els.ocrStatus) els.ocrStatus.textContent = "完了（" + result.counts.filter((n) => n > 0).length + "件/19件）";
          if (result.warnings && result.warnings.length) {
            if (els.ocrWarn) {
              els.ocrWarn.textContent = result.warnings.join(" ");
              els.ocrWarn.className = "ocr-warn warn";
              els.ocrWarn.hidden = false;
            }
          }
          // 少し表示してから自動で閉じる
          setTimeout(() => {
            closeModal();
            els.ocrRun.textContent = "OCR実行";
            els.ocrRun.disabled = false;
            // 「食材と個数を入力」モードへ切替済みなら結果が見える。切替前なら自動で切り替える
            if (!els.modeCount.checked) {
              els.modeCount.checked = true;
              switchPane();
              apply();
            }
          }, result.warnings && result.warnings.length ? 1800 : 700);
        } catch (err) {
          if (els.ocrStatus) els.ocrStatus.textContent = "エラー";
          if (els.ocrWarn) {
            els.ocrWarn.textContent = err.message || String(err);
            els.ocrWarn.className = "ocr-warn err";
            els.ocrWarn.hidden = false;
          }
          els.ocrRun.textContent = "OCR実行";
          els.ocrRun.disabled = false;
        }
      });
    }
  })();

  function buildRecipesExportMeta() {
    var lvMult = formatLevelMult(state.level);
    var lvTxt = "Lv" + state.level + (lvMult ? "(" + lvMult + ")" : "");
    var dt = new Date().toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    return lvTxt + "  \u00b7  FB" + state.fb + "%  \u00b7  " + dt + " 出力";
  }

  function buildOwnedSummaryText() {
    if (!els.counts) return "";
    var inputs = {};
    els.counts.querySelectorAll("input").forEach(function (inp) {
      inputs[inp.dataset.name] = parseInt(inp.value, 10);
    });
    var parts = [];
    for (var i = 0; i < state.ingredients.length; i++) {
      var name = state.ingredients[i];
      var v = inputs[name];
      if (Number.isFinite(v) && v > 0) parts.push(abbr(name) + "×" + v);
    }
    if (parts.length === 0) return "";
    return "所持: " + parts.join(" / ");
  }

  function setRecipesExportStatus(msg, kind) {
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

  if (els.exportBtn) {
    els.exportBtn.addEventListener("click", async function () {
      if (state.selected.size === 0) {
        setRecipesExportStatus("レシピにチェックを入れてから実行してください（選択中のレシピが0件です）", "err");
        if (els.exportStatus && els.exportStatus.scrollIntoView) {
          els.exportStatus.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        return;
      }
      var orig = els.exportBtn.textContent;
      els.exportBtn.disabled = true;
      els.exportBtn.textContent = "生成中...";
      setRecipesExportStatus("画像を生成しています...", "ok");
      try {
        var filename = "pokemonsleep_recipes_" + (window.PokemonExport ? window.PokemonExport.timestampStr() : new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)) + ".png";
        var title = "ポケモンスリープ レシピ食材チェッカー（" + state.selected.size + "件選択）";
        var subtitle = "チェックを入れたレシピのみを抽出";
        var meta = buildRecipesExportMeta();
        // 個数モード時は所持数を画像メタに追記（画像だけ見ても個数条件が分かるように）
        if (els.modeCount && els.modeCount.checked) {
          var ownedTxt = buildOwnedSummaryText();
          if (ownedTxt) meta += "\n" + ownedTxt;
        }
        if (window.PokemonExport && window.PokemonExport.exportElement) {
          var result = await window.PokemonExport.exportElement("recipes", { title: title, subtitle: subtitle, metaText: meta, filename: filename });
          if (result && result.method === "preview") setRecipesExportStatus("画像を表示しました。長押しで保存、または「共有する」をお使いください", "ok");
          else setRecipesExportStatus("画像を保存しました: " + filename, "ok");
        } else {
          throw new Error("エクスポート機能の読み込みに失敗しました");
        }
      } catch (e) {
        setRecipesExportStatus(e.message || String(e), "err");
      } finally {
        els.exportBtn.textContent = orig;
        els.exportBtn.disabled = false;
      }
    });
  }

  loadData().catch((err) => {
    els.recipes.innerHTML = '<div class="loading">データの読み込みに失敗しました: ' + err.message + "</div>";
  });
})();