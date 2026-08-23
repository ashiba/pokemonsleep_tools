(function () {
  "use strict";

  const CATEGORIES = [
    { key: "curry" },
    { key: "dessert" },
    { key: "salad" }
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

  const state = {
    ingredients: [],
    categories: {},
    catCountEl: {},
    catTotal: {},
    catVisible: {},
    catSectionEl: {},
    selected: new Map()
  };

  function getMultiplier(key) {
    return state.selected.get(key) || 1;
  }

  function toggleMultiplier(key, mult) {
    const cur = getMultiplier(key);
    const next = cur === mult ? 1 : mult;
    state.selected.set(key, next);
    updateSelectedSummary();
    apply();
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
    ocrFilename: $("ocr-filename")
  };

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
    renderAll();
    apply();
    updateSelectedSummary();
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
    state.catSectionEl[key].style.display = visible ? "" : "none";
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
        meta.appendChild(el("span", "total", "" + recipe.ingredients.reduce((s, ing) => s + ing.count, 0)));
        meta.appendChild(el("span", "ratio", recipe.ratio.toFixed(2)));
        meta.appendChild(el("span", "energy", "E: " + recipe.initialEnergy.toLocaleString()));
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
    const maxCounts = {};
    for (const [key, mult] of state.selected) {
      const [cat, idxStr] = key.split(":");
      const idx = parseInt(idxStr, 10);
      const recipe = state.categories[cat] && state.categories[cat].recipes[idx];
      if (!recipe) continue;
      const m = mult || 1;
      for (const ing of recipe.ingredients) {
        const need = ing.count * m;
        maxCounts[ing.name] = Math.max(maxCounts[ing.name] || 0, need);
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
    // チップ: 残り = 所持 − 確保（最大値） マイナスは警告表示。並びは state.ingredients 順
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
    // 選択レシピ一覧 + x2/x3ボタン
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
      if (mult > 1) {
        const multLabel = el("span", "selected-mult-label", " ×" + mult);
        multLabel.style.fontWeight = "700";
        multLabel.style.color = "var(--accent-dark)";
        nameWrap.appendChild(multLabel);
      }
      item.appendChild(nameWrap);
      const btns = el("span", "mult-btns");
      const b2 = el("button", "mult-btn" + (mult === 2 ? " on" : ""), "×2");
      b2.type = "button";
      b2.setAttribute("aria-label", recipe.name + " を2倍");
      b2.addEventListener("click", () => toggleMultiplier(key, 2));
      const b3 = el("button", "mult-btn" + (mult === 3 ? " on" : ""), "×3");
      b3.type = "button";
      b3.setAttribute("aria-label", recipe.name + " を3倍");
      b3.addEventListener("click", () => toggleMultiplier(key, 3));
      btns.appendChild(b2);
      btns.appendChild(b3);
      item.appendChild(btns);
      list.appendChild(item);
    }
    els.selectedSummary.appendChild(list);
    // 集計チップ（最大値）
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
    meta.textContent = totalTypes + "種類 / 合計" + totalCount + "個 (各食材は最大個数)";
    els.selectedSummary.appendChild(meta);
    renderReserveSection();
  }

  function resetCard(card) {
    card.classList.remove("creatable");
    card.querySelectorAll(".ing-chip").forEach((chip) => {
      chip.classList.remove("ok", "miss");
    });
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

  loadData().catch((err) => {
    els.recipes.innerHTML = '<div class="loading">データの読み込みに失敗しました: ' + err.message + "</div>";
  });
})();