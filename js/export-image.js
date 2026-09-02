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
    // 内部の hidden 要素（フィルタOFFのカテゴリ等）はそのまま非表示を維持するが、
    // レスポンシブで 1列に潰れるのを防ぐため recipes は強制的に 3列化
    if (targetEl.id === "recipes") {
      clone.style.display = "grid";
      clone.style.gridTemplateColumns = "repeat(3,1fr)";
      clone.style.gap = "16px";
      clone.style.alignItems = "start";
      // 子セクションの display:none を一時解除しない（フィルタOFFは反映しない方が意図通りか迷うが、共有時は全部見せたい需要もある。
      // ここではフィルタ状態を尊重するため clone 内の style.display が none のままなら維持する）
      // ただし画像幅900でも3列を保つため、各 .cat-section が潰れないようにする
      clone.querySelectorAll(".cat-section").forEach(function (sec) {
        // フィルタOFFで display:none になっているものは画像では薄く表示（共有時に欠落を防ぐ）
        // 代わりにそのまま非表示だと「表示OFFが画像にも反映される」ので、共有用途では全部表示する方が親切。
        // オフのものは opacityで区別せず、素直に表示する。
        if (sec.style.display === "none") {
          sec.style.display = "";
          sec.style.opacity = "0.55";
        }
      });
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
    foot.textContent = "pokemonsleep-tools.pages.dev  \u00b7  " + new Date().toLocaleDateString("ja-JP");
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
