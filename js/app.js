(function () {
  "use strict";

  const CATEGORIES = [
    { key: "curry", label: "カレー" },
    { key: "dessert", label: "デザート" },
    { key: "salad", label: "サラダ" }
  ];

  const state = {
    ingredients: [],
    categories: {},
    ngSet: new Set(),
    hlSet: new Set()
  };

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
    minRatio: $("min-ratio"),
    ngList: $("ng-list"),
    ngClear: $("ng-clear"),
    hlList: $("hl-list"),
    hlClear: $("hl-clear"),
    search: $("search"),
    count: $("result-count"),
    results: $("results")
  };

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
      label.appendChild(document.createTextNode(name));
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
      label.appendChild(document.createTextNode(name));
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

  function totalQuantities(dishes) {
    const counts = {};
    for (const dish of dishes) {
      for (const ing of dish.ingredients) {
        counts[ing.name] = (counts[ing.name] || 0) + ing.count;
      }
    }
    return counts;
  }

  function search() {
    const maxTypes = parseInt(els.maxTypes.value, 10) || Infinity;
    const minRatio = parseFloat(els.minRatio.value) || 0;

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
          const union = unionOf(dishes.map((d) => d.recipe));
          if (union.size > maxTypes) continue;
          if (dishes.some(({ recipe }) => recipe.ratio < minRatio)) continue;
          hits.push({
            dishes,
            union,
            unionSize: union.size,
            quantities: totalQuantities(dishes.map((d) => d.recipe))
          });
        }
      }
    }

    hits.sort((a, b) => a.unionSize - b.unionSize || a.dishes.length - b.dishes.length);
    render(hits);
  }

  function render(hits) {
    els.count.textContent = hits.length + "件";
    els.results.innerHTML = "";

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
        const ratio = document.createElement("span");
        ratio.className = "ratio";
        ratio.textContent = recipe.ratio.toFixed(2);
        const energy = document.createElement("span");
        energy.className = "energy";
        energy.textContent = "エナジー " + recipe.initialEnergy.toLocaleString();
        dish.append(cat, name, ratio, energy);
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
        chip.textContent = name + " ×" + qty;
        ings.appendChild(chip);
      }

      card.append(dishes, meta, ings);
      frag.appendChild(card);
    }
    els.results.appendChild(frag);
  }

  els.search.addEventListener("click", search);

  loadData().catch((err) => {
    els.results.innerHTML = '<div class="loading">データの読み込みに失敗しました: ' + err.message + "</div>";
  });
})();