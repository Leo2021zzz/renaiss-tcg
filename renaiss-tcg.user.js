// ==UserScript==
// @name         Renaiss TCG Title Parser
// @namespace    renaiss-tcg
// @homepageURL  https://x.com/Leosu1030
// @version      0.1.0
// @description  Parse Renaiss card titles into beginner-friendly fields
// @match        *://www.renaiss.xyz/card/*
// @match        *://renaiss.xyz/card/*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  "use strict";

  console.log("[renaiss-tcg] userscript loaded");

  const GRADERS = new Set(["PSA", "BGS", "CGC", "SGC", "ACE", "AGS", "CSG"]);
  const LANGS = new Set([
    "Japanese",
    "English",
    "Chinese",
    "Korean",
    "Thai",
    "Indonesian",
    "Spanish",
    "German",
    "French",
    "Italian",
    "Portuguese",
  ]);
  const FINISH_WORDS = new Set(["Holo", "Reverse", "Non-Holo", "NonHolo", "Foil"]);
  const FINISH_LABELS = {
    Holo: "Holographic",
    "Non-Holo": "Non-Holo",
    NonHolo: "Non-Holo",
    Reverse: "Reverse Holo",
    Foil: "Foil",
  };
  const GAME_LABELS = {
    Pokemon: "Pokemon（宝可梦）",
    Pokémon: "Pokémon（宝可梦）",
  };
  const FINISH_ZH = {
    Holographic: "全息",
    "Reverse Holo": "反向闪",
    "Non-Holo": "非闪",
    Foil: "闪",
  };
  const GRADE_TEXT_ZH = {
    "Gem Mint": "完美",
    Mint: "近乎完美",
    "NM-MT": "很好（轻微瑕疵）",
    "Near Mint": "近全新",
    "Excellent-Mint": "明显使用痕迹",
    Excellent: "明显旧卡",
  };
  const PROMO_CODES = {
    "DP-P": { zh: "钻石珍珠世代特典卡" },
    "Pt-P": { zh: "白金世代特典卡" },
    "L-P": { zh: "传说世代特典卡" },
    "BW-P": { zh: "黑白世代特典卡" },
    "XY-P": { zh: "XY 世代特典卡" },
    "SM-P": { zh: "太阳月亮特典卡" },
    "S-P": { zh: "剑盾特典卡" },
    "SV-P": { zh: "朱紫特典卡" },
  };

  function normalizeSpaces(s) {
    return s.replace(/\s+/g, " ").trim();
  }

  function isLikelyCardTitle(text) {
    if (!text) return false;
    if (text.length < 12) return false;
    if (/Renaiss\s*\|/i.test(text)) return false;
    if (/trademarks|logos|images|endorsed|affiliated|independent marketplace/i.test(text))
      return false;
    // Must include a strong card hint to avoid picking activity labels
    return /(PSA|BGS|CGC|SGC|ACE|AGS|CSG|Pokemon|Pokémon|Promo|#\d+)/i.test(text);
  }

  function findBestTitleFromDOM() {
    const nodes = Array.from(
      document.querySelectorAll(
        "h1, h2, [class*='title'], [class*='Title'], [data-testid*='title'], [data-testid*='Title']"
      )
    );
    let best = "";
    for (const el of nodes) {
      const text = normalizeSpaces(el.textContent || "");
      if (!isLikelyCardTitle(text)) continue;
      if (text.length > best.length) best = text;
    }
    return best;
  }

  function findTitleFromTextNodes() {
    if (!document.body) return "";
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const text = normalizeSpaces(node.nodeValue || "");
          if (!isLikelyCardTitle(text)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );
    let best = "";
    let count = 0;
    while (walker.nextNode()) {
      const text = normalizeSpaces(walker.currentNode.nodeValue || "");
      if (text.length > best.length) best = text;
      count += 1;
      if (count > 2000) break;
    }
    return best;
  }

  function findTitleFromPageText() {
    if (!document.body || !document.body.innerText) return "";
    const lines = document.body.innerText.split("\n").map((l) => normalizeSpaces(l));
    let best = "";
    for (const line of lines) {
      if (/trademarks|logos|images|endorsed|affiliated|independent marketplace/i.test(line))
        continue;
      if (!isLikelyCardTitle(line)) continue;
      if (!/\bPSA\b|\bBGS\b|\bCGC\b|\bSGC\b/.test(line)) continue;
      if (line.length > best.length) best = line;
    }
    return best;
  }

  function extractNameFromBlob(text) {
    if (!text) return "";
    function decodeEscaped(s) {
      try {
        return JSON.parse(`"${s.replace(/"/g, '\\"')}"`);
      } catch (e) {
        return s;
      }
    }

    const followKeys =
      "(setName|itemId|ownerAddress|askPriceInUSDT|frontImageUrl|attributes|gradingCompany|grade|year)";

    // Unescaped JSON: "name":"...","setName"
    let m = text.match(new RegExp(`"name"\\s*:\\s*"([^"]+?)"\\s*,\\s*"${followKeys}"`));
    if (m && m[1]) {
      const value = normalizeSpaces(decodeEscaped(m[1]));
      if (isLikelyCardTitle(value)) return value;
    }

    // Escaped JSON inside string: \"name\":\"...\",\"setName\"
    m = text.match(/\\\"name\\\"\\s*:\\s*\\\"([\s\S]*?)\\\"\\s*,\\s*\\\"setName\\\"/);
    if (m && m[1]) {
      const value = normalizeSpaces(decodeEscaped(m[1]));
      if (isLikelyCardTitle(value)) return value;
    }

    // Escaped JSON inside string: \"name\":\"...\",\"setName\"
    m = text.match(
      new RegExp(`\\\\\"name\\\\\"\\s*:\\s*\\\\\"([^\\\\"]+?)\\\\\"\\s*,\\s*\\\\\"${followKeys}\\\\\"`)
    );
    if (m && m[1]) {
      const value = normalizeSpaces(decodeEscaped(m[1]));
      if (isLikelyCardTitle(value)) return value;
    }

    // Last resort: first occurrence of name, then trim at next field boundary
    m = text.match(/"name"\s*:\s*"([^"]+)"/);
    if (m && m[1]) {
      const value = normalizeSpaces(decodeEscaped(m[1]));
      if (isLikelyCardTitle(value)) return value;
    }
    return "";
  }

  function findTitleFromNextData() {
    try {
      const script =
        document.querySelector("#__NEXT_DATA__") ||
        document.querySelector("script[type='application/json'][id='__NEXT_DATA__']");
      if (!script || !script.textContent) return "";
      const data = JSON.parse(script.textContent);
      const best = findTitleInObject(data);
      return best;
    } catch (e) {
      console.warn("[renaiss-tcg] next data parse failed", e);
      return "";
    }
  }

  function findTitleInObject(obj) {
    let best = "";
    const seen = new Set();
    const stack = [{ value: obj, depth: 0 }];
    while (stack.length) {
      const { value, depth } = stack.pop();
      if (value && typeof value === "object") {
        if (seen.has(value)) continue;
        seen.add(value);
        if (depth > 12) continue;
        if (Array.isArray(value)) {
          for (const v of value) stack.push({ value: v, depth: depth + 1 });
        } else {
          for (const k of Object.keys(value)) {
            const v = value[k];
            if (typeof v === "string") {
              const text = normalizeSpaces(v);
              if (isLikelyCardTitle(text) && text.length > best.length) {
                best = text;
              }
            } else {
              stack.push({ value: v, depth: depth + 1 });
            }
          }
        }
      }
    }
    return best;
  }

  function findTitleFromNextFlightScripts() {
    const scripts = Array.from(document.scripts || []);
    for (const s of scripts) {
      const text = s.textContent || "";
      if (!text.includes("__next_f.push") || !text.includes("name")) continue;
      const extracted = extractNameFromBlob(text);
      if (extracted && isLikelyCardTitle(extracted)) return extracted;
    }
    return "";
  }

  function getTitleText() {
    const h1 =
      document.querySelector("h1") ||
      document.querySelector("[data-testid='card-title']") ||
      document.querySelector(".card-title");
    if (h1 && h1.textContent) return normalizeSpaces(h1.textContent);

    const best = findBestTitleFromDOM();
    if (best) return best;

    const pageTextTitle = findTitleFromPageText();
    if (pageTextTitle) return pageTextTitle;

    const nextDataTitle = findTitleFromNextData();
    if (nextDataTitle) return nextDataTitle;

    const nextFlightTitle = findTitleFromNextFlightScripts();
    if (nextFlightTitle) return nextFlightTitle;

    const textNodeTitle = findTitleFromTextNodes();
    if (textNodeTitle) {
      const extracted = extractNameFromBlob(textNodeTitle);
      if (extracted) return extracted;
      // Avoid returning huge Next.js blobs
      if (/^self\.__next_f\.push/.test(textNodeTitle)) return "";
      return textNodeTitle;
    }

    const og = document.querySelector("meta[property='og:title']");
    if (og && og.getAttribute("content")) {
      const content = normalizeSpaces(og.getAttribute("content"));
      if (isLikelyCardTitle(content)) return content;
    }

    return normalizeSpaces(document.title || "");
  }

  function findYearIndex(tokens) {
    return tokens.findIndex((t) => /^\d{4}$/.test(t));
  }

  function findCardNoIndex(tokens) {
    const hashIdx = tokens.findIndex((t) => /^#\d+[A-Za-z0-9/-]*$/.test(t));
    if (hashIdx >= 0) return hashIdx;
    return tokens.findIndex((t) => /^\d+[A-Za-z0-9/-]*$/.test(t));
  }

  function extractFinish(tokens) {
    const hits = tokens.filter((t) => FINISH_WORDS.has(t));
    if (!hits.length) return "";
    const mapped = hits.map((t) => FINISH_LABELS[t] || t);
    return mapped.join(" ");
  }

  function parseTitle(title) {
    const tokens = title.split(" ").filter(Boolean);
    const result = {
      grader: "",
      grade: "",
      gradeText: "",
      year: "",
      game: "",
      language: "",
      series: "",
      cardNo: "",
      cardName: "",
      finish: "",
      raw: title,
    };

    if (tokens.length === 0) return result;

    if (GRADERS.has(tokens[0]) && /^\d+(\.\d+)?$/.test(tokens[1] || "")) {
      result.grader = tokens[0];
      result.grade = tokens[1];
      const yearIdx = findYearIndex(tokens);
      if (yearIdx > 0) {
        result.gradeText = tokens.slice(2, yearIdx).join(" ");
        result.year = tokens[yearIdx];
        tokens.splice(0, yearIdx + 1);
      }
    }

    if (!result.year) {
      const yearIdx = findYearIndex(tokens);
      if (yearIdx >= 0) {
        result.year = tokens[yearIdx];
        tokens.splice(yearIdx, 1);
      }
    }

    const gameIdx = tokens.findIndex((t) => t.toLowerCase() === "pokemon");
    if (gameIdx >= 0) {
      result.game = tokens[gameIdx];
      tokens.splice(gameIdx, 1);
    }

    const langIdx = tokens.findIndex((t) => LANGS.has(t));
    if (langIdx >= 0) {
      result.language = tokens[langIdx];
      tokens.splice(langIdx, 1);
    }

    const finish = extractFinish(tokens);
    if (finish) {
      result.finish = finish;
      for (const word of finish.split(" ")) {
        const idx = tokens.indexOf(word);
        if (idx >= 0) tokens.splice(idx, 1);
      }
    }

    const cardNoIdx = findCardNoIndex(tokens);
    if (cardNoIdx >= 0) {
      result.cardNo = tokens[cardNoIdx].replace(/^#/, "");
      const before = tokens.slice(0, cardNoIdx);
      const after = tokens.slice(cardNoIdx + 1);
      result.series = before.join(" ");
      result.cardName = after.join(" ").replace(/\.+/g, " ").trim();
      const suffixMatch = result.cardName.match(/-?(Holo|Non-Holo|NonHolo|Reverse|Foil)\s*$/i);
      if (suffixMatch) {
        const raw = suffixMatch[1];
        const key = raw === "NonHolo" ? "NonHolo" : raw;
        if (!result.finish) result.finish = FINISH_LABELS[key] || raw;
        result.cardName = result.cardName.replace(suffixMatch[0], "").trim();
      }
      return result;
    }

    // Fallback: last token(s) as name, first as series
    if (tokens.length > 0) {
      result.series = tokens.slice(0, Math.max(0, tokens.length - 2)).join(" ");
      result.cardName = tokens.slice(-2).join(" ");
    }

    return result;
  }

  function formatGradeText(text) {
    if (!text) return "";
    const key = text
      .trim()
      .replace(/\u2013|\u2014/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\s*-\s*/g, "-");
    const zh = GRADE_TEXT_ZH[key];
    return zh ? `${key}（${zh}）` : key;
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "tcg-parser-panel";
    panel.innerHTML = `
      <div class="tcg-header">
        <div class="tcg-title">卡牌信息</div>
        <button class="tcg-toggle" type="button">收起</button>
      </div>
      <div class="tcg-body"></div>
    `;
    document.body.appendChild(panel);

    const toggle = panel.querySelector(".tcg-toggle");
    const body = panel.querySelector(".tcg-body");
    toggle.addEventListener("click", () => {
      const collapsed = body.style.display === "none";
      body.style.display = collapsed ? "block" : "none";
      toggle.textContent = collapsed ? "收起" : "展开";
    });

    return panel;
  }

  function render(panel, data) {
    const body = panel.querySelector(".tcg-body");
    const gameLabel = GAME_LABELS[data.game] || data.game || "-";
    const languageLabel = data.language ? data.language : "English（英文版）";
    let seriesLabel = data.series || "-";
    if (seriesLabel !== "-") {
      if (/^Promo$/i.test(seriesLabel)) {
        seriesLabel = "Promo（特典卡）";
      } else {
        const match = seriesLabel.match(/\b(DP-P|Pt-P|L-P|BW-P|XY-P|SM-P|S-P|SV-P)\b/);
        if (match && PROMO_CODES[match[1]]) {
          const info = PROMO_CODES[match[1]];
          seriesLabel = `${seriesLabel}（${info.zh}）`;
        }
      }
    }
    const finishLabel = data.finish
      ? `${data.finish}${FINISH_ZH[data.finish] ? `（${FINISH_ZH[data.finish]}）` : ""}`
      : "-";
    const rows = [
      ["评级机构", data.grader || "-"],
      ["等级", data.grade || "-"],
      ["等级描述", data.gradeText ? formatGradeText(data.gradeText) : "-"],
      ["年份", data.year || "-"],
      ["IP", gameLabel],
      ["语言/地区", languageLabel],
      ["系列/类型", seriesLabel],
      ["卡号", data.cardNo || "-"],
      ["卡名", data.cardName || "-"],
      ["工艺/版本", finishLabel],
    ];

    body.innerHTML = `
      <div class="tcg-rows">
        ${rows
          .map(
            ([k, v]) =>
              `<div class="tcg-row"><div class="tcg-key">${k}</div><div class="tcg-val">${v}</div></div>`
          )
          .join("")}
      </div>
    `;
  }

  function showDebug(message) {
    try {
      const debug = document.createElement("div");
      debug.id = "tcg-parser-debug";
      debug.textContent = message;
      document.body.appendChild(debug);
      setTimeout(() => {
        if (debug && debug.parentNode) debug.parentNode.removeChild(debug);
      }, 2000);
    } catch (e) {
      console.warn("[renaiss-tcg] debug failed", e);
    }
  }

  function waitForBodyReady(cb) {
    if (document.body) return cb();
    const timer = setInterval(() => {
      if (document.body) {
        clearInterval(timer);
        cb();
      }
    }, 100);
    setTimeout(() => clearInterval(timer), 5000);
  }

  function init() {
    try {
      showDebug("TCG script loaded");
      const panel = createPanel();
      let title = getTitleText();
      console.log("[renaiss-tcg] title:", title);
      let data = parseTitle(title);
      render(panel, data);

      let retries = 0;
      const retryTimer = setInterval(() => {
        if (retries > 12) return clearInterval(retryTimer);
        const t = getTitleText();
        if (t && t !== title) {
          title = t;
          data = parseTitle(t);
          render(panel, data);
          console.log("[renaiss-tcg] title:", t);
          clearInterval(retryTimer);
        }
        retries += 1;
      }, 500);

      const observer = new MutationObserver(() => {
        const t = getTitleText();
        if (t && t !== data.raw) {
          const next = parseTitle(t);
          render(panel, next);
          data.raw = t;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      console.error("[renaiss-tcg] init error", e);
    }
  }

  GM_addStyle(`
    #tcg-parser-debug {
      position: fixed;
      left: 12px;
      bottom: 12px;
      z-index: 999999;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 6px 10px;
      font-size: 12px;
      border-radius: 8px;
    }
    #tcg-parser-panel {
      position: fixed;
      right: 18px;
      bottom: 18px;
      width: 360px;
      z-index: 999999;
      background: rgba(18, 18, 18, 0.92);
      color: #f4f4f4;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      font-family: "PingFang SC", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif;
      overflow: hidden;
    }
    #tcg-parser-panel .tcg-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: rgba(255,255,255,0.04);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    #tcg-parser-panel .tcg-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    #tcg-parser-panel .tcg-toggle {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      padding: 4px 8px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
    }
    #tcg-parser-panel .tcg-body {
      padding: 12px 14px 14px;
    }
    #tcg-parser-panel .tcg-raw {
      font-size: 12px;
      color: #bdbdbd;
      margin-bottom: 10px;
      line-height: 1.4;
      word-break: break-word;
    }
    #tcg-parser-panel .tcg-rows {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }
    #tcg-parser-panel .tcg-row {
      display: grid;
      grid-template-columns: 90px 1fr;
      gap: 8px;
      align-items: start;
    }
    #tcg-parser-panel .tcg-key {
      color: #9aa3af;
      font-size: 12px;
      line-height: 1.4;
    }
    #tcg-parser-panel .tcg-val {
      font-size: 12px;
      line-height: 1.4;
      word-break: break-word;
    }
    @media (max-width: 720px) {
      #tcg-parser-panel {
        width: calc(100% - 24px);
        right: 12px;
        bottom: 12px;
      }
    }
  `);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => waitForBodyReady(init));
  } else {
    waitForBodyReady(init);
  }
})();
