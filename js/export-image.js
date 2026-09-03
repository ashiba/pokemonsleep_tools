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

  function isIOS() {
    var ua = navigator.userAgent || "";
    var platform = navigator.platform || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ は Mac として振る舞うためタッチ点で判定
    if (platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("画像の生成に失敗しました"));
        }, "image/png");
      } else {
        // toBlob 未対応のフォールバック (旧ブラウザ)
        try {
          var bin = atob(canvas.toDataURL("image/png").split(",")[1]);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: "image/png" }));
        } catch (e) {
          reject(new Error("画像の生成に失敗しました"));
        }
      }
    });
  }

  // ページ内に画像プレビューを表示するフォールバック
  // (ポップアップブロック時でも確実に保存手段を提供する。長押し保存 + 共有リトライ)
  function showInlinePreview(blob, blobUrl, filename) {
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.zIndex = "9999";
      overlay.style.background = "rgba(0,0,0,0.75)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.padding = "16px";
      overlay.style.boxSizing = "border-box";

      var panel = document.createElement("div");
      panel.style.background = "#fff";
      panel.style.borderRadius = "12px";
      panel.style.maxWidth = "640px";
      panel.style.width = "100%";
      panel.style.maxHeight = "90vh";
      panel.style.overflow = "auto";
      panel.style.padding = "16px";
      panel.style.textAlign = "center";
      panel.style.color = "#3b3640";

      var msg = document.createElement("p");
      msg.style.fontSize = "14px";
      msg.style.margin = "0 0 12px";
      msg.textContent = "画像を生成しました。画像を長押しして「写真に保存」してください。";
      panel.appendChild(msg);

      var img = document.createElement("img");
      img.src = blobUrl;
      img.alt = filename;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.border = "1px solid #e3ded3";
      img.style.borderRadius = "8px";
      panel.appendChild(img);

      var btnRow = document.createElement("div");
      btnRow.style.display = "flex";
      btnRow.style.gap = "8px";
      btnRow.style.justifyContent = "center";
      btnRow.style.marginTop = "12px";
      btnRow.style.flexWrap = "wrap";

      // 新しいジェスチャーでの共有リトライ (ここでの tap は fresh な activation なので share が通る)
      var shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.textContent = "共有する";
      shareBtn.style.padding = "10px 18px";
      shareBtn.style.fontSize = "15px";
      shareBtn.style.borderRadius = "8px";
      shareBtn.style.border = "1px solid #a98ce0";
      shareBtn.style.background = "#a98ce0";
      shareBtn.style.color = "#fff";
      shareBtn.addEventListener("click", function () {
        var file = null;
        try { file = new File([blob], filename, { type: "image/png" }); } catch (e) { file = null; }
        if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
          navigator.share({ files: [file], title: document.title }).catch(function () {});
        } else if (navigator.share) {
          navigator.share({ title: document.title, url: blobUrl }).catch(function () {});
        }
      });
      btnRow.appendChild(shareBtn);

      var tabLink = document.createElement("a");
      tabLink.href = blobUrl;
      tabLink.target = "_blank";
      tabLink.rel = "noopener";
      tabLink.textContent = "別タブで開く";
      tabLink.style.display = "inline-block";
      tabLink.style.padding = "10px 18px";
      tabLink.style.fontSize = "15px";
      tabLink.style.borderRadius = "8px";
      tabLink.style.border = "1px solid #ccc";
      tabLink.style.background = "#fff";
      tabLink.style.color = "#3b3640";
      tabLink.style.textDecoration = "none";
      btnRow.appendChild(tabLink);

      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.textContent = "閉じる";
      closeBtn.style.padding = "10px 18px";
      closeBtn.style.fontSize = "15px";
      closeBtn.style.borderRadius = "8px";
      closeBtn.style.border = "1px solid #ccc";
      closeBtn.style.background = "#fff";
      closeBtn.style.color = "#3b3640";
      closeBtn.addEventListener("click", function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        // 「別タブで開く」で開いたタブが blob を読み込む時間を確保するため revoke は遅延させる
        setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 5 * 60 * 1000);
      });
      btnRow.appendChild(closeBtn);
      panel.appendChild(btnRow);

      overlay.appendChild(panel);
      // 背景タップで閉じる (パネル内のタップは閉じない)
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeBtn.click();
      });
      document.body.appendChild(overlay);
      resolve({ method: "preview", url: blobUrl });
    });
  }

  // 保存: iOS はページ内プレビュー→手動操作、PC等は直接ダウンロード。
  // PCで共有シートを自動表示すると混乱するため、Web Share API の自動呼び出しは行わない。
  // (プレビュー内の「共有する」ボタンはユーザーの明示タップなので残す)
  // 注意: html2canvas 生成には数秒かかり、生成完了後に window.open/share を呼ぶと
  // transient activation が切れてポップアップブロック/NotAllowedError になる。
  // かつ生成開始時点で window.open("", "_blank") で先行オープンすると、iOS Safari は
  // 新タブへ切り替えて元のページをバックグラウンド化し、生成自体が止まる・失敗する。
  // そのため iOS ではタブを先行オープンせず、生成後にページ内プレビューを表示し、
  // 「共有する」「別タブで開く」という fresh なタップで保存させる (tap 直後なので
  // activation が有効で share/window.open が通る)。
  async function saveCanvas(canvas, filename, title) {
    var blob = await canvasToBlob(canvas);

    var blobUrl = URL.createObjectURL(blob);

    // 1) iOS は download 属性が無視され、非同期後の window.open/share は通らないため
    // 自動保存は試みず、ページ内に表示して長押し保存・手動共有に誘導する。
    // (a[download] の click は現在ページを blob に置き換えて状態を破壊するため行わない)
    if (isIOS()) {
      return showInlinePreview(blob, blobUrl, filename);
    }

    // 2) PC等: a[download] による直接保存 (共有シートは出さない)
    try {
      var a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.rel = "noopener";
      // iOS で click を有効にするため可視状態で一瞬だけ DOM に追加
      a.style.position = "fixed";
      a.style.left = "0";
      a.style.top = "0";
      a.style.opacity = "0";
      a.style.pointerEvents = "none";
      document.body.appendChild(a);
      a.click();
      // 短時間 DOM に残してから除去
      await new Promise(function (r) { setTimeout(r, 500); });
      if (a.parentNode) a.parentNode.removeChild(a);

      setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 10 * 1000);
      return { method: "download" };
    } catch (e) {
      setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 10 * 1000);
      throw e;
    }
  }

  function todayStr() {
    return timestampStr().slice(0, 10);
  }

  function timestampStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return y + "-" + m + "-" + day + "_" + hh + mm + ss;
  }

  // html2canvas@1.4.1 が解釈できるのは rgb()/rgba()/hsl()/hsla()/hex/名前色のみで、
  // color()/lab()/oklch()/color-mix()/light-dark() 等の計算値に遭遇すると
  // 'Attempting to parse an unsupported color function "..."' で画像生成自体が失敗する。
  // 自前の CSS には使っていなくても、端末 (特に Safari) の UA スタイル由来の計算値が
  // 混ざることがある。個数モードでは確保パネル・×N食バッジ等の付加要素が画像に
  // 含まれるため当たりやすい。非対応関数を含む計算値だけを安全な値で上書きする
  // (対応済みの rgb() 等には一切触らないため見た目は変わらない)。
  // なお html2canvas は複製先 iframe 内の要素を「元の window の getComputedStyle」で
  // 解析するため、複製側は iframe の view と元 window の両方で検査する。
  var UNSUPPORTED_COLOR_FN_RE = /(color\(|color-mix\(|lab\(|lch\(|oklab\(|oklch\(|hwb\(|light-dark\()/i;
  var SANITIZE_BORDER_PROPS = [
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "outline-color", "text-decoration-color", "-webkit-text-stroke-color"
  ];

  function sanitizeExportColorsWith(root, getCS) {
    var els = [root];
    try {
      var list = root.querySelectorAll("*");
      for (var i = 0; i < list.length; i++) els.push(list[i]);
    } catch (e) { /* querySelectorAll 失敗時は root のみ */ }
    for (var n = 0; n < els.length; n++) {
      var target = els[n];
      var cs = null;
      try { cs = getCS(target); } catch (e) { continue; }
      if (!cs) continue;
      try {
        var v = null;
        // 文字色を先に確定させる (border 系は CSS 既定の currentColor 扱いに合わせる)
        var textFallback = "#3b3640";
        try {
          v = cs.getPropertyValue("color") || "";
          if (v && UNSUPPORTED_COLOR_FN_RE.test(v)) target.style.setProperty("color", textFallback);
        } catch (e) {}
        try {
          v = cs.getPropertyValue("background-color") || "";
          if (v && UNSUPPORTED_COLOR_FN_RE.test(v)) target.style.setProperty("background-color", "transparent");
        } catch (e) {}
        for (var k = 0; k < SANITIZE_BORDER_PROPS.length; k++) {
          try {
            v = cs.getPropertyValue(SANITIZE_BORDER_PROPS[k]) || "";
            if (v && UNSUPPORTED_COLOR_FN_RE.test(v)) target.style.setProperty(SANITIZE_BORDER_PROPS[k], textFallback);
          } catch (e) {}
        }
        try {
          v = cs.getPropertyValue("background-image") || "";
          if (v && UNSUPPORTED_COLOR_FN_RE.test(v)) target.style.setProperty("background-image", "none");
        } catch (e) {}
        try {
          v = cs.getPropertyValue("box-shadow") || "";
          if (v && v !== "none" && UNSUPPORTED_COLOR_FN_RE.test(v)) target.style.setProperty("box-shadow", "none");
        } catch (e) {}
        try {
          v = cs.getPropertyValue("text-shadow") || "";
          if (v && v !== "none" && UNSUPPORTED_COLOR_FN_RE.test(v)) target.style.setProperty("text-shadow", "none");
        } catch (e) {}
      } catch (e) { /* この要素は諦めて次へ */ }
    }
  }

  function sanitizeExportColors(root, view) {
    try {
      if (!root) return;
      var views = [];
      if (view && view.getComputedStyle) views.push(view);
      try {
        var od = root.ownerDocument;
        var odv = (od && od.defaultView) ? od.defaultView : null;
        if (odv && odv.getComputedStyle && views.indexOf(odv) === -1) views.push(odv);
      } catch (e) {}
      // 解析に使う元 window の view があればそれでも検査する
      try {
        if (window && window.getComputedStyle && views.indexOf(window) === -1) views.push(window);
      } catch (e) {}
      if (views.length === 0) return;
      for (var i = 0; i < views.length; i++) {
        (function (w) {
          sanitizeExportColorsWith(root, function (el) { return w.getComputedStyle(el); });
        })(views[i]);
      }
    } catch (e) { /* サニタイズ失敗時はそのまま続行 */ }
  }

  async function exportElement(target, opts) {
    opts = opts || {};
    // 注意: ここで window.open("", "_blank") を先行オープンしないこと。
    // iOS Safari は新タブへ即切り替えして元のページをバックグラウンド化するため、
    // 生成(数秒)が止まる・失敗し「一瞬タブが開いて閉じる」だけに終わる。
    // iOS の保存は生成後のページ内プレビュー + 手動タップ(共有/別タブ)に任せる。
    await load();
    const targetEl = typeof target === "string" ? document.getElementById(target) : target;
    if (!targetEl) throw new Error("エクスポート対象が見つかりません");

    // オフスクリーンラッパー（ビューポート幅に依存しない固定幅で描画 → モバイルでも崩れない）
    const wrapper = document.createElement("div");
    wrapper.id = "__pokemon_export_wrapper";
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
            // モバイルでは非アクティブタブの section に hidden が付いたまま
            // clone されるため、画像では必ず解除する。
            // (.cat-section[hidden]{display:none!important} により
            // display="" だけでは表示されない。選択中のタブしか画像に
            // 反映されない・個数モードのハイライトが消えて見える原因)
            sec.hidden = false;
            sec.removeAttribute("hidden");
            sec.style.display = "";
            sec.style.opacity = "1";
            sec.style.visibility = "visible";
          }
        });
        // 原文DOMのハイライト状態をクローンへ同期する。
        // (個数モードの「作れる」緑枠・ok/missチップ・×N食バッジが、
        // 端末やタイミングによらず画像に反映されるようにするため。
        // cloneNode の複写に加え、iOS の html2canvas でも確実に描画
        // されるようインラインスタイルで補強する)
        try {
          var origMap = {};
          if (origRecipesEl) {
            origRecipesEl.querySelectorAll(".recipe-card").forEach(function (c) {
              origMap[c.dataset.cat + ":" + c.dataset.ridx] = c;
            });
          }
          clone.querySelectorAll(".recipe-card").forEach(function (card) {
            var orig = origMap[card.dataset.cat + ":" + card.dataset.ridx];
            if (!orig) return;
            card.className = orig.className;
            if (orig.classList.contains("creatable")) {
              card.style.borderColor = "#4c9e63";
              card.style.background = "#f0f9f0";
            }
            if (orig.classList.contains("selected")) {
              // 原文CSSの定義順 (.selected が後勝ち) に合わせる
              card.style.borderColor = "#7aa5c4";
              card.style.background = "#f0f6ff";
            }
            var origChips = {};
            orig.querySelectorAll(".ing-chip").forEach(function (oc) {
              origChips[oc.dataset.name] = oc;
            });
            card.querySelectorAll(".ing-chip").forEach(function (chip) {
              var oc = origChips[chip.dataset.name];
              if (!oc) return;
              chip.className = oc.className;
              if (oc.classList.contains("ok")) {
                chip.style.background = "#d7f2de";
                chip.style.color = "#2f7a5f";
                chip.style.border = "1px solid #8cc9a0";
                chip.style.fontWeight = "700";
              } else if (oc.classList.contains("miss")) {
                chip.style.background = "#ececec";
                chip.style.color = "#9a9a9a";
                chip.style.border = "1px dashed #c5c5c5";
              }
            });
            var origBadge = orig.querySelector(".servings-badge");
            var badge = card.querySelector(".servings-badge");
            if (origBadge && badge) {
              badge.hidden = origBadge.hidden;
              badge.textContent = origBadge.textContent;
              badge.className = origBadge.className;
              if (!origBadge.hidden) {
                badge.style.display = "inline-block";
                badge.style.background = "#ffec8a";
                badge.style.color = "#7a4a00";
                badge.style.border = "1px solid #e6b84a";
              } else {
                badge.style.display = "none";
              }
            }
          });
        } catch (e) { /* 同期失敗時はクローンのまま続行 */ }
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
    wrapper.appendChild(clone);

    const foot = document.createElement("div");
    foot.style.fontSize = "11px";
    foot.style.color = "#8a8490";
    foot.style.textAlign = "center";
    foot.style.marginTop = "12px";
    foot.textContent = "pokemonsleep-tools.pages.dev  \u00b7  " + new Date().toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    wrapper.appendChild(foot);

    document.body.appendChild(wrapper);
    // 非対応の色関数 (color()/oklch() 等) が計算値に混ざると html2canvas が例外で
    // 落ちるため、実DOM側・複製側の両方でサニタイズする (詳細は sanitizeExportColors)。
    sanitizeExportColors(wrapper, window);
    try {
      // iOS は canvas メモリ上限が厳しいため scale を抑える(大きすぎると真っ白/失敗になる)
      var scale = isIOS() ? 1 : 2;
      try {
        var h = wrapper.getBoundingClientRect().height || wrapper.offsetHeight || 0;
        // 面積が iOS の上限(~1670万px)に収まるよう scale を下げる
        if (h > 0) {
          var maxArea = isIOS() ? 12000000 : 24000000;
          var area = 900 * scale * (h * scale);
          if (area > maxArea) scale = Math.max(0.4, Math.sqrt(maxArea / (900 * h)));
        }
      } catch (e) { /* 計算失敗時は既定 scale のまま */ }
      const canvas = await window.html2canvas(wrapper, {
        scale: scale,
        backgroundColor: "#f6f4ee",
        useCORS: true,
        logging: false,
        windowWidth: 900,
        onclone: function (clonedDoc) {
          try {
            var w = null;
            try { w = clonedDoc.getElementById("__pokemon_export_wrapper"); } catch (e) { w = null; }
            sanitizeExportColors(w || clonedDoc.body, (clonedDoc && clonedDoc.defaultView) || window);
          } catch (e) { /* サニタイズ失敗時はそのまま続行 */ }
        }
      });
      var filename = opts.filename || ("pokemonsleep_" + todayStr() + ".png");
      var saved = await saveCanvas(canvas, filename, opts.title || document.title);
      saved.filename = filename;
      return saved;
    } finally {
      wrapper.remove();
    }
  }

  window.PokemonExport = {
    load: load,
    exportElement: exportElement,
    todayStr: todayStr,
    timestampStr: timestampStr
  };
})();
