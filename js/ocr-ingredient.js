(function () {
  "use strict";

  // 食材順は food/ingredients.json と同一（バッグ内固定順）
  const INGREDIENTS = [
    "ふといながねぎ",
    "あじわいキノコ",
    "とくせんエッグ",
    "ほっこりポテト",
    "とくせんリンゴ",
    "げきからハーブ",
    "マメミート",
    "モーモーミルク",
    "あまいミツ",
    "ピュアなオイル",
    "あったかジンジャー",
    "あんみんトマト",
    "リラックスカカオ",
    "おいしいシッポ",
    "ワカクサ大豆",
    "ワカクサコーン",
    "めざましコーヒー",
    "ずっしりカボチャ",
    "つやつやアボカド"
  ];

  const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  let tesseractLoading = null;

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (tesseractLoading) return tesseractLoading;
    tesseractLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = TESSERACT_CDN;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Tesseract.js の読み込みに失敗しました"));
      document.head.appendChild(s);
    });
    return tesseractLoading;
  }

  // 前処理用Canvas（共用）
  let procCanvas = null;
  let pctx = null;
  function getCanvas() {
    if (!procCanvas) {
      procCanvas = document.createElement("canvas");
      pctx = procCanvas.getContext("2d");
    }
    return procCanvas;
  }

  function prepareCanvas(img) {
    const canvas = getCanvas();
    const ctx = pctx;
    const scale = 2;
    const thresh = 175;
    const MAX = 2800;
    let w = img.naturalWidth * scale;
    let h = img.naturalHeight * scale;
    if (w > MAX || h > MAX) {
      const s = Math.min(MAX / w, MAX / h);
      w *= s;
      h *= s;
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = g > thresh ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(id, 0, 0);
    return canvas;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("画像の読み込みに失敗しました"));
      };
      img.src = url;
    });
  }

  function parseBadgeCounts(words, text) {
    // words: [{text, bbox:{x0,y0,x1,y1}, confidence}]
    // 19件未満でも詰めずにグリッド補完できるよう、x単体+数字の分離や
    // o→0 / l,I→1 / S,s→5 の誤認を正規化して拾う（デメリット少なめの緩和）
    const normalizeNumStr = (s) => s.replace(/[oO]/g, "0").replace(/[lI|]/g, "1").replace(/[sS]/g, "5");
    const isXToken = (t) => /^[xX×]$/.test(t);
    const isNumOnly = (t) => /^\d{1,4}$/.test(t) || /^[0-9oOIlSs]{1,4}$/.test(t);

    let xs = [];
    const used = new Set();

    // 第1パス: "x42" 型（誤認含む）を直接拾う
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const t = (w.text || "").trim();
      if (!t) continue;
      // 空白除去後に "x"+数字 の形か
      const compact = t.replace(/\s+/g, "");
      // 先頭が x/X/× で残りが数字/誤認文字のみ
      if (/^[xX×]/.test(compact)) {
        const tail = compact.slice(1);
        if (tail.length > 0 && /^[0-9oOIlSs]+$/.test(tail)) {
          const norm = normalizeNumStr(tail);
          if (/^\d{1,4}$/.test(norm)) {
            xs.push({ num: parseInt(norm, 10), bbox: w.bbox, conf: w.confidence || 0 });
            used.add(i);
            continue;
          }
        }
      }
      // 厳密な "x 42"（間に空白）を許容する従来形のフォールバック
      const m = t.match(/^[xX×]\s*(\d{1,4})$/);
      if (m) {
        xs.push({ num: parseInt(m[1], 10), bbox: w.bbox, conf: w.confidence || 0 });
        used.add(i);
      }
    }

    // 第2パス: "x" 単体 + 右隣の数字 への分割対策（バッジは x と数字に隙間があるため words が分離されやすい）
    // y近傍 & xが右側にある数字を探して結合する
    const xSingles = [];
    for (let i = 0; i < words.length; i++) {
      if (used.has(i)) continue;
      const t = (words[i].text || "").trim();
      if (isXToken(t)) xSingles.push(i);
    }
    if (xSingles.length > 0) {
      // 数字候補（未使用）
      const numCandidates = [];
      for (let i = 0; i < words.length; i++) {
        if (used.has(i) || xSingles.includes(i)) continue;
        const t = (words[i].text || "").trim();
        if (!t) continue;
        // 純粋な数字（誤認含む）のみを候補にする。x付きは既に第1パスで拾われている
        if (isNumOnly(t.replace(/\s+/g, ""))) {
          const norm = normalizeNumStr(t.replace(/\s+/g, ""));
          if (/^\d{1,4}$/.test(norm)) numCandidates.push(i);
        }
      }
      // 近傍判定（Canvas座標系で行間~150pxのため、同一行閾値は60を目安に、x距離は80以内を近傍とする）
      const yThresh = 45;
      const xGapMax = 90;
      for (const xi of xSingles) {
        const xb = words[xi].bbox;
        if (!xb) continue;
        let best = -1;
        let bestDx = Infinity;
        for (const ni of numCandidates) {
          if (used.has(ni)) continue;
          const nb = words[ni].bbox;
          if (!nb) continue;
          const dy = Math.abs((nb.y0 + nb.y1) / 2 - (xb.y0 + xb.y1) / 2);
          if (dy > yThresh) continue;
          // 数字は x の右側にあること
          if (nb.x0 <= xb.x1) continue;
          const dx = nb.x0 - xb.x1;
          if (dx > xGapMax) continue;
          if (dx < bestDx) {
            bestDx = dx;
            best = ni;
          }
        }
        if (best !== -1) {
          const nt = (words[best].text || "").trim().replace(/\s+/g, "");
          const norm = normalizeNumStr(nt);
          const num = parseInt(norm, 10);
          if (Number.isFinite(num)) {
            // 結合bboxは x と数字を包含する矩形にする（グリッド補完の位置は中点で決まるため大まかで良い）
            const nb = words[best].bbox;
            const union = {
              x0: Math.min(xb.x0, nb.x0),
              y0: Math.min(xb.y0, nb.y0),
              x1: Math.max(xb.x1, nb.x1),
              y1: Math.max(xb.y1, nb.y1),
            };
            xs.push({ num, bbox: union, conf: Math.min(words[xi].confidence || 0, words[best].confidence || 0) });
            used.add(xi);
            used.add(best);
          }
        }
      }
    }

    // fallback: text正規表現で補完（wordsが空 or 少ない場合はtextの方が多い方を採用可能なように件数を保持）
    let textNumbers = [];
    if (text) {
      // 誤認を考慮した正規化込みで text からも拾う
      const re = /[xX×]\s*([0-9oOIlSs]{1,4})/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const norm = normalizeNumStr(m[1]);
        if (/^\d{1,4}$/.test(norm)) {
          textNumbers.push({ num: parseInt(norm, 10), bbox: { x0: 0, y0: 0, x1: 0, y1: 0 }, conf: 0, fallback: true });
        }
      }
      if (xs.length === 0 && textNumbers.length > 0) {
        xs = textNumbers.slice();
      } else if (xs.length > 0 && xs.length < 19 && textNumbers.length > xs.length) {
        // wordsが部分的に欠落しているがtextの方が多く拾えている場合は警告用に保持（適用はbbox付きのxsを優先）
        // 何もしない: buildCountsFromXs側で警告に件数を出すため保持のみ
      }
    }

    if (xs.length === 0) return { xs: [], textNumbers };

    // fallback由来（bbox無し）は順序だけで返す
    if (xs.some((x) => x.fallback)) {
      return { xs, textNumbers };
    }

    // y -> x でソートして行クラスタリング
    xs.sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));

    // 行クラスタリング: y0差が閾値以内なら同じ行
    // 画像サイズに応じて閾値を少し可変にする（小さい画像でも同一行をまとめられるように）
    const estH = Math.max(...xs.map((x) => x.bbox.y1)) - Math.min(...xs.map((x) => x.bbox.y0));
    const ROW_THRESH = Math.max(40, Math.min(70, estH * 0.08));
    const rows = [];
    for (const x of xs) {
      let placed = false;
      for (const row of rows) {
        // rowの代表yとの差
        const ry = row[0].bbox.y0;
        if (Math.abs(x.bbox.y0 - ry) < ROW_THRESH) {
          row.push(x);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([x]);
    }
    // 行をy順にソート、行内はx順
    rows.sort((a, b) => a[0].bbox.y0 - b[0].bbox.y0);
    for (const row of rows) row.sort((a, b) => a.bbox.x0 - b.bbox.x0);

    // 平坦化（行優先）
    const ordered = [];
    for (const row of rows) for (const x of row) ordered.push(x);

    return { xs: ordered, textNumbers };
  }

  function buildCountsFromXs(xs) {
    const counts = new Array(19).fill(0);
    const warnings = [];

    if (xs.length === 0) {
      warnings.push("数量バッジ（x数字）が1つも検出されませんでした。スクショが食材バッグ画面か確認してください。");
      return { counts, warnings };
    }

    // fallback (bbox無し) の場合は単純に順序マッピング（位置情報が無いため詰めるしかない）
    const isFallback = xs.some((x) => x.fallback);
    if (isFallback) {
      for (let i = 0; i < Math.min(xs.length, 19); i++) counts[i] = xs[i].num;
      if (xs.length < 19) warnings.push("検出数が19未満（" + xs.length + "件）でした。スクショが切れている可能性があります。足りない分は0のままになります。");
      if (xs.length > 19) warnings.push("検出数が19を超えました（" + xs.length + "件）。先頭19件のみ適用します。");
      return { counts, warnings };
    }

    // 19件ちょうどのときは従来どおり行優先の順序マッピングで高速に処理（既存の正しいケースを崩さない）
    if (xs.length === 19) {
      for (let i = 0; i < 19; i++) counts[i] = xs[i].num;
      return { counts, warnings };
    }

    // 19件未満/超過時のグリッド補完: 詰めずに 4列×5行（最終行3列）の19スロットへ最近傍割当て
    // 1件欠落しても以降が前詰めされないため、ジンジャー/コーヒー等のずれを防ぐ。
    // デメリット少なめ: 19件とれない場合でも読み取れた位置は正しいスロットに入り、欠けた箇所だけ0のまま残る。
    if (xs.length !== 19) {
      try {
        const cxs = xs.map((x) => (x.bbox.x0 + x.bbox.x1) / 2);
        const cys = xs.map((x) => (x.bbox.y0 + x.bbox.y1) / 2);
        const minX = Math.min(...cxs);
        const maxX = Math.max(...cxs);
        const colWidth = (maxX - minX) / 3 || 1;
        // 列中心（0..3）。最終行は 0..2 を使用
        const colCenters = [minX, minX + colWidth, minX + 2 * colWidth, minX + 3 * colWidth];

        // 行クラスタ（yで再クラスタリングして行番号を確定）
        const estH = Math.max(...cys) - Math.min(...cys);
        const ROW_THRESH2 = Math.max(40, Math.min(70, estH * 0.08));
        const sortedIdx = xs.map((_, i) => i).sort((a, b) => cys[a] - cys[b]);
        const rowOf = new Array(xs.length).fill(-1);
        const rowYs = [];
        let rowCount = 0;
        for (const idx of sortedIdx) {
          let placed = false;
          for (let r = 0; r < rowYs.length; r++) {
            if (Math.abs(cys[idx] - rowYs[r]) < ROW_THRESH2) {
              rowOf[idx] = r;
              // 代表yを平均へ更新（少し安定させる）
              rowYs[r] = (rowYs[r] + cys[idx]) / 2;
              placed = true;
              break;
            }
          }
          if (!placed) {
            rowOf[idx] = rowCount;
            rowYs.push(cys[idx]);
            rowCount++;
          }
        }
        // 行番号が飛んでいる場合（ソート順で0..n-1に正規化）
        const order = rowYs.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
        const remap = {};
        order.forEach((o, ni) => (remap[o.i] = ni));
        for (let i = 0; i < rowOf.length; i++) rowOf[i] = remap[rowOf[i]];

        const usedSlots = new Set();
        let assigned = 0;
        // 行ごとに x 昇順で処理して最近傍の空き列へ割当て
        const rowsMap = {};
        for (let i = 0; i < xs.length; i++) {
          const r = rowOf[i];
          if (!rowsMap[r]) rowsMap[r] = [];
          rowsMap[r].push(i);
        }
        for (const rStr of Object.keys(rowsMap).sort((a, b) => +a - +b)) {
          const r = parseInt(rStr, 10);
          const list = rowsMap[r].sort((a, b) => cxs[a] - cxs[b]);
          const maxCol = r === 4 ? 2 : 3; // 最終行は3列
          const availCols = [];
          for (let c = 0; c <= maxCol; c++) availCols.push(c);
          for (const idx of list) {
            // 最も近い空き列を選ぶ
            let bestC = -1;
            let bestDist = Infinity;
            for (const c of availCols) {
              const d = Math.abs(cxs[idx] - colCenters[c]);
              if (d < bestDist) {
                bestDist = d;
                bestC = c;
              }
            }
            if (bestC !== -1) {
              const slot = r * 4 + bestC;
              // 最終行で r*4+3 は存在しないためスキップ（r=4は0..2のみ）
              if (slot < 19 && !usedSlots.has(slot)) {
                counts[slot] = xs[idx].num;
                usedSlots.add(slot);
                availCols.splice(availCols.indexOf(bestC), 1);
                assigned++;
              }
            }
          }
        }

        if (assigned === 0) {
          // グリッド推定が失敗した場合は安全に先頭詰めへフォールバック（デメリット回避）
          for (let i = 0; i < Math.min(xs.length, 19); i++) counts[i] = xs[i].num;
        } else {
          // 欠けたスロットは0のまま残す（詰めない）。不足分は手動で0と見分けられるよう警告する
          if (xs.length < 19) {
            warnings.push("検出数が19未満（" + xs.length + "件）でした。位置から推定して該当スロットのみ反映し、読み取れなかった箇所は0のままにしました。0表示の食材は実際の所持数を手入力で補正してください。");
          } else if (xs.length > 19) {
            warnings.push("検出数が19を超えました（" + xs.length + "件）。位置が近い19件を優先して反映しました。余分な検出は無視されています。");
          }
          return { counts, warnings };
        }
      } catch (_) {
        // 例外時は従来の詰め処理へフォールバック
      }
    }

    // フォールバック（グリッド割当て失敗時やそれ以外のケース）: 従来の詰め
    for (let i = 0; i < Math.min(xs.length, 19); i++) counts[i] = xs[i].num;

    if (xs.length < 19) {
      warnings.push("検出数が19未満（" + xs.length + "件）でした。スクショが切れているか、バッグがスクロール途中の可能性があります。検出できた分は適用し、残りは0のままになります。画像は一番上までスクロールした状態で、19食材が全て見えるように撮り直すと精度が上がります。");
    } else if (xs.length > 19) {
      warnings.push("検出数が19を超えました（" + xs.length + "件）。先頭19件のみ適用します。");
    }

    return { counts, warnings };
  }

  async function runOnce(file, onProgress) {
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("画像ファイルを選択してください");
    }
    await loadTesseract();
    const img = await loadImage(file);
    const canvas = prepareCanvas(img);

    const emit = (msg, p) => {
      if (typeof onProgress === "function") onProgress(msg, p);
    };

    emit("辞書を読み込み中...", 5);
    const worker = await window.Tesseract.createWorker("jpn+eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          emit("認識中...", Math.round(m.progress * 80) + 10);
        } else if (m.status) {
          // download系のログも拾う
          emit(m.status, undefined);
        }
      },
    });

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
      });
      emit("認識中...", 10);
      const ret = await worker.recognize(canvas);
      const data = ret.data || {};
      const words = data.words || [];
      const text = data.text || "";
      emit("解析中...", 92);

      const { xs } = parseBadgeCounts(words, text);
      const { counts, warnings } = buildCountsFromXs(xs);

      emit("完了", 100);
      return { counts, warnings, raw: { words, text, xs } };
    } finally {
      try {
        await worker.terminate();
      } catch (_) {}
    }
  }

  window.PokemonBagOCR = {
    runOnce,
    loadTesseract,
    INGREDIENTS,
  };
})();
