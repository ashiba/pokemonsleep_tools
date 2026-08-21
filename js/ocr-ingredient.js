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
    const badgeRe = /^[xX×]\s*(\d{1,4})$/;
    let xs = [];
    for (const w of words) {
      const t = (w.text || "").trim();
      if (!t) continue;
      const m = t.match(badgeRe);
      if (m) {
        xs.push({ num: parseInt(m[1], 10), bbox: w.bbox, conf: w.confidence || 0 });
      }
    }

    // fallback: text正規表現で補完（wordsが空 or 少ない場合）
    if (xs.length === 0 && text) {
      const nums = [...text.matchAll(/[xX×]\s*(\d{1,4})/g)].map((m) => ({
        num: parseInt(m[1], 10),
        bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
        conf: 0,
        fallback: true,
      }));
      xs = nums;
    }

    if (xs.length === 0) return { xs: [], textNumbers: [] };

    // fallback由来（bbox無し）は順序だけで返す
    if (xs.some((x) => x.fallback)) {
      return { xs, textNumbers: [] };
    }

    // y -> x でソートして行クラスタリング
    xs.sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));

    // 行クラスタリング: y0差が閾値以内なら同じ行
    // Canvas拡大後の座標系なので、行間は~150px前後。閾値60で十分
    const ROW_THRESH = 60;
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

    return { xs: ordered, textNumbers: [] };
  }

  function buildCountsFromXs(xs) {
    const counts = new Array(19).fill(0);
    const warnings = [];

    if (xs.length === 0) {
      warnings.push("数量バッジ（x数字）が1つも検出されませんでした。スクショが食材バッグ画面か確認してください。");
      return { counts, warnings };
    }

    // fallback (bbox無し) の場合は単純に順序マッピング
    const isFallback = xs.some((x) => x.fallback);
    if (isFallback) {
      for (let i = 0; i < Math.min(xs.length, 19); i++) counts[i] = xs[i].num;
      if (xs.length < 19) warnings.push("検出数が19未満（" + xs.length + "件）でした。スクショが切れている可能性があります。足りない分は0のままになります。");
      if (xs.length > 19) warnings.push("検出数が19を超えました（" + xs.length + "件）。先頭19件のみ適用します。");
      return { counts, warnings };
    }

    // 位置ベース: 行クラスタ後の順序をそのまま 0..18 にマッピング
    // バッグは4列×5行（最終行3列）の固定グリッドなので、y→xソートが正順になる
    // 19件ちょうどならそのまま、19未満でも先頭から詰めて適用（切れている場合は末尾が欠ける想定）
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
