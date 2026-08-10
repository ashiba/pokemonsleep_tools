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
    catSectionEl: {}
  };

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
    recipes: $("recipes")
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
          let all = recipe.ingredients.every((ing) => (owned[ing.name] || 0) >= ing.count);
          card.classList.toggle("creatable", all);
          if (all) n++;
          card.querySelectorAll(".ing-chip").forEach((chip) => {
            const ing = recipe.ingredients.find((i) => i.name === chip.dataset.name);
            const ok = (owned[ing.name] || 0) >= ing.count;
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

  loadData().catch((err) => {
    els.recipes.innerHTML = '<div class="loading">データの読み込みに失敗しました: ' + err.message + "</div>";
  });
})();