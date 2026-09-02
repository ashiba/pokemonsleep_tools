(function () {
  "use strict";

  const CDN = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
  let loading = null;

  function load() {
    if (window.html2canvas) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = CDN;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("画像生成ライブラリの読み込みに失敗しました")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  async function exportElement(target, opts) {
    opts = opts || {};
    await load();
    const targetEl = typeof target === "string" ? document.getElementById(target) : target;
    if (!targetEl) throw new Error("エクスポート対象が見つかりません");

    // オフスクリーンラッパー（ビューポート幅に依存しない固定幅で描画 → モバイルでも崩れない）
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    wrapper.style.width = "900px";
    wrapper.style.background = "#f6f4ee";
    wrapper.style.padding = "16px";
    wrapper.style.fontFamily = '"Hiragino Sans","Noto Sans JP",system-ui,sans-serif';
    wrapper.style.color = "#3b3640";
    wrapper.style.lineHeight = "1.6";

    // ヘッダー（ページのグラデを再現・Discordでも見栄え良く）
    const header = document.createElement("div");
    header.style.background = "linear-gradient(135deg,#a98ce0,#7aa5c4)";
    header.style.color = "#fff";
    header.style.padding = "14px 18px";
    header.style.borderRadius = "10px";
    header.style.textAlign = "center";
    header.style.marginBottom = "12px";
    const h1 = document.createElement("div");
    h1.style.fontSize = "18px";
    h1.style.fontWeight = "700";
    h1.textContent = opts.title || document.title;
    header.appendChild(h1);
    if (opts.subtitle) {
      const sub = document.createElement("div");
      sub.style.fontSize = "12px";
      sub.style.opacity = "0.92";
      sub.style.marginTop = "4px";
      sub.textContent = opts.subtitle;
      header.appendChild(sub);
    }
    wrapper.appendChild(header);

    if (opts.metaText) {
      const meta = document.createElement("div");
      meta.style.fontSize = "11px";
      meta.style.color = "#6b6570";
      meta.style.marginBottom = "10px";
      meta.style.background = "#fff";
      meta.style.border = "1px solid #e3ded3";
      meta.style.borderRadius = "8px";
      meta.style.padding = "8px 10px";
      meta.style.whiteSpace = "pre-wrap";
      meta.style.wordBreak = "break-word";
      meta.textContent = opts.metaText;
      wrapper.appendChild(meta);
    }

    // 対象をクローンしてラッパーに載せる
    const clone = targetEl.cloneNode(true);
    // 対象自体の非表示解除（recipesのhidden section等は除外）
    clone.hidden = false;
    clone.removeAttribute("hidden");
    clone.style.display = "block";
    clone.style.width = "100%";
    clone.style.maxWidth = "none";
    // recipes は「チェックを入れたレシピだけ」を画像に含め、かつ「選択中のレシピ」パネルを先頭に挿入
    if (targetEl.id === "recipes") {
      // 選択中のレシピパネルをラッパーに挿入（cloneの前に）
      var selPanelOrig = document.getElementById("selected-panel");
      if (selPanelOrig) {
        var selClone = selPanelOrig.cloneNode(true);
        selClone.hidden = selPanelOrig.hidden;
        if (selPanelOrig.hidden) selClone.style.display = "none";
        else { selClone.style.display = "block"; selClone.removeAttribute("hidden"); }
        selClone.removeAttribute("id");
        selClone.style.width = "100%";
        selClone.style.marginBottom = "12px";
        selClone.style.background = "#fff";
        selClone.style.border = "1px solid #e3ded3";
        selClone.style.borderRadius = "10px";
        selClone.style.padding = "12px 14px";
        // reserve-section の hidden も原文に合わせる
        var origReserve = document.getElementById("reserve-section");
        var cloneReserve = selClone.querySelector("#reserve-section");
        if (origReserve && cloneReserve) {
          cloneReserve.hidden = origReserve.hidden;
          if (origReserve.hidden) cloneReserve.style.display = "none";
          else cloneReserve.style.display = "block";
          cloneReserve.removeAttribute("id");
        }
        // 操作系ボタンは画像では不要（見た目だけ残すため無効化）
        var clearBtn = selClone.querySelector("#clear-selected");
        if (clearBtn) clearBtn.style.display = "none";
        selClone.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
        selClone.querySelectorAll("button, input").forEach(function (el) { el.disabled = true; el.style.pointerEvents = "none"; });
        wrapper.appendChild(selClone);
      }

      // レシピ一覧はチェックされたものだけに絞る
      clone.style.display = "grid";
      clone.style.gap = "16px";
      clone.style.alignItems = "start";
      var origRecipesEl = document.getElementById("recipes");
      var checkedSet = {};
      var hasChecked = false;
      if (origRecipesEl) {
        origRecipesEl.querySelectorAll('input[type="checkbox"][data-key]').forEach(function (cb) {
          if (cb.checked) { checkedSet[cb.dataset.key] = true; hasChecked = true; }
        });
      }
      if (hasChecked) {
        clone.querySelectorAll(".recipe-card").forEach(function (card) {
          var key = card.dataset.cat + ":" + card.dataset.ridx;
          if (!checkedSet[key]) card.remove();
        });
        var secRemaining = 0;
        clone.querySelectorAll(".cat-section").forEach(function (sec) {
          var n = sec.querySelectorAll(".recipe-card").length;
          if (n === 0) sec.remove();
          else {
            secRemaining++;
            sec.style.display = "";
            sec.style.opacity = "1";
          }
        });
        if (secRemaining === 1) clone.style.gridTemplateColumns = "1fr";
        else if (secRemaining === 2) clone.style.gridTemplateColumns = "repeat(2,1fr)";
        else clone.style.gridTemplateColumns = "repeat(3,1fr)";
        if (clone.querySelectorAll(".recipe-card").length === 0) {
          var empty = document.createElement("div");
          empty.style.gridColumn = "1 / -1";
          empty.style.fontSize = "12px";
          empty.style.color = "#6b6570";
          empty.style.background = "#fff";
          empty.style.border = "1px solid #e3ded3";
          empty.style.borderRadius = "8px";
          empty.style.padding = "12px";
          empty.style.textAlign = "center";
          empty.textContent = "チェックされたレシピがありません";
          clone.appendChild(empty);
        }
      } else {
        clone.querySelectorAll(".recipe-card").forEach(function (c) { c.remove(); });
        clone.querySelectorAll(".cat-section").forEach(function (s) { s.remove(); });
        clone.style.gridTemplateColumns = "1fr";
        var note = document.createElement("div");
        note.style.fontSize = "12px";
        note.style.color = "#6b6570";
        note.style.background = "#fff";
        note.style.border = "1px solid #e3ded3";
        note.style.borderRadius = "8px";
        note.style.padding = "12px";
        note.style.textAlign = "center";
        note.textContent = "チェックされたレシピがありません。レシピカードのチェックを入れてから画像保存してください。";
        clone.appendChild(note);
      }
    }
    // search: #results は縦並びのまま
    if (targetEl.id === "results") {
      clone.style.display = "block";
      // 結果が多すぎると画像が巨大になり保存に失敗するため上位20件に絞る
      var cards = clone.querySelectorAll(".result-card");
      if (cards.length > 20) {
        for (var i = 20; i < cards.length; i++) cards[i].remove();
        var note = document.createElement("div");
        note.style.fontSize = "11px";
        note.style.color = "#6b6570";
        note.style.textAlign = "center";
        note.style.marginTop = "8px";
        note.style.background = "#fff";
        note.style.border = "1px dashed #e3ded3";
        note.style.borderRadius = "8px";
        note.style.padding = "6px 10px";
        var total = targetEl.querySelectorAll(".result-card").length;
        note.textContent = "\u203B \u5168" + total + "\u4EF6\u4E2D \u4E0A\u4F4D20\u4EF6\u306E\u307F\u8868\u793A";
        clone.appendChild(note);
      }
    }

    wrapper.appendChild(clone);

    const foot = document.createElement("div");
    foot.style.fontSize = "11px";
    foot.style.color = "#8a8490";
    foot.style.textAlign = "center";
    foot.style.marginTop = "12px";
    foot.textContent = "pokemonsleep-tools.pages.dev  \u00b7  " + new Date().toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    wrapper.appendChild(foot);

    document.body.appendChild(wrapper);
    try {
      const canvas = await window.html2canvas(wrapper, {
        scale: 2,
        backgroundColor: "#f6f4ee",
        useCORS: true,
        logging: false,
        windowWidth: 900
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = opts.filename || ("pokemonsleep_" + todayStr() + ".png");
      // iOS Safari 等で click が無効な場合のフォールバック: 新タブで開く
      a.click();
      // 一部ブラウザで click だけでは保存されないため、URLを返す（呼び出し側で表示も可能）
      return canvas.toDataURL("image/png");
    } finally {
      wrapper.remove();
    }
  }

  window.PokemonExport = {
    load: load,
    exportElement: exportElement,
    todayStr: todayStr
  };
})();
