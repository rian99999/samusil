#!/usr/bin/env node
// RIAN 카드뉴스 그림 만들기 → 1080×1350 JPEG (인스타 API 가 JPEG 만 받음) + 한눈에 보기(sheet.png)
//
//   node tools/card.mjs work/<작업>/cards.json
//
// cards.json 예:
// { "out": "work/2026-11-24-lip/images",
//   "cards": [
//     { "style": "mist", "eyebrow": "퍼스널컬러", "title": "같은 코랄인데\n왜 나만 칙칙할까요?", "sub": "색 이름보다 명도·채도 차이예요" },
//     { "style": "raw", "title": "고르는 법", "items": ["밝기(명도)부터 맞춰요", "그다음 맑기(채도)", "온도는 마지막"], "accent": "예약 · 네이버 플레이스" } ] }
// 규칙(brand/RIAN.md 7장): 바탕 Raw 또는 Mist Light, 글자 Onyx/Slate, Tourmaline 은 한 장에 한 곳(accent)만,
// 모서리 0, 그림자 없음, 반짝이·보석·골드 없음. 사진 위 글자·얼굴 위 로고 없음(이 도구는 글자 카드만 만든다).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = process.argv[2];
if (!specPath) { console.log("사용: node tools/card.mjs work/<작업>/cards.json"); process.exit(2); }
const spec = JSON.parse(fs.readFileSync(path.resolve(ROOT, specPath), "utf8"));
const outDir = path.resolve(ROOT, spec.out || path.join(path.dirname(specPath), "images"));
if (!path.relative(ROOT, outDir).startsWith("work")) { console.error("out 은 work/ 안이어야 합니다"); process.exit(2); }
const cards = Array.isArray(spec.cards) ? spec.cards : [];
if (!cards.length || cards.length > 10) { console.error("카드는 1~10장"); process.exit(2); }

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/\n/g, "<br>");
const MIST = "radial-gradient(120% 140% at 75% 30%, #EFE4E9 0%, #D9D2E3 40%, #F5F5F4 85%)";
function html(c, i, n) {
  const bg = c.style === "mist" ? MIST : c.style === "white" ? "#FFFFFF" : "#F5F5F4";
  const items = (c.items || []).map((t) => `<li><i></i><span>${esc(t)}</span></li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Tenor+Sans&family=Hahmlet:wght@300;400&family=IBM+Plex+Sans+KR:wght@400;500&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;background:${bg};color:#221F26;font-family:Pretendard,"IBM Plex Sans KR","Noto Sans KR",sans-serif;padding:110px 100px;display:flex;flex-direction:column}
.wm{font-family:"Tenor Sans",serif;letter-spacing:.34em;font-size:30px;color:#221F26}
.eyebrow{margin-top:120px;font-size:30px;color:#6B6670;letter-spacing:.02em}
h1{margin-top:28px;font-family:Hahmlet,serif;font-weight:300;font-size:${c.title && c.title.length > 18 ? 78 : 92}px;line-height:1.28;letter-spacing:-.02em}
.sub{margin-top:40px;font-size:38px;line-height:1.7;color:#6B6670}
ul{list-style:none;padding:0;margin-top:70px;display:grid;gap:34px;border-top:1px solid #221F26;padding-top:56px}
li{display:flex;gap:26px;align-items:baseline;font-size:42px;line-height:1.6}
li i{flex:none;width:16px;height:16px;border:1.6px solid #221F26;transform:rotate(45deg) translateY(-4px)}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;font-size:26px;color:#6B6670}
.accent{display:inline-block;background:#EFE4E9;color:#7E4560;font-size:36px;font-weight:500;padding:22px 30px;border-left:3px solid #7E4560}
.no{font-family:"Tenor Sans",serif;letter-spacing:.2em}
</style></head><body>
<div class="wm">RIAN</div>
${c.eyebrow ? `<p class="eyebrow">${esc(c.eyebrow)}</p>` : `<div style="height:${c.items ? 60 : 150}px"></div>`}
${c.title ? `<h1>${esc(c.title)}</h1>` : ""}
${c.sub ? `<p class="sub">${esc(c.sub)}</p>` : ""}
${items ? `<ul>${items}</ul>` : ""}
<div class="foot">${c.accent ? `<span class="accent">${esc(c.accent)}</span>` : "<span></span>"}<span class="no">${n > 1 ? `${i + 1} / ${n}` : ""}</span></div>
</body></html>`;
}

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { console.error("playwright 가 없어 그림을 못 만듭니다. Claude 앱의 클라우드 세션(samusil)에서 실행하거나, Canva 로 만들어 주세요."); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
const files = [];
for (let i = 0; i < cards.length; i++) {
  await page.setContent(html(cards[i], i, cards.length), { waitUntil: "load" });
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(300);
  const f = path.join(outDir, `card-${i + 1}.jpg`);
  await page.screenshot({ path: f, type: "jpeg", quality: 90 });
  files.push(path.relative(ROOT, f));
}
// 한눈에 보기: 카드를 작게 나란히
const imgs = files.map((f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(ROOT, f)).toString("base64")}`);
const sheet = await browser.newPage({ viewport: { width: Math.min(5, imgs.length) * 290 + 30, height: Math.ceil(imgs.length / 5) * 357 + 30 } });
await sheet.setContent(`<body style="margin:0;padding:15px;background:#E6E4E7;display:flex;flex-wrap:wrap;gap:20px">${imgs.map((s) => `<img src="${s}" style="width:270px;height:337px;border:1px solid #D6D2D8">`).join("")}</body>`);
const sheetPath = path.join(outDir, "sheet.png");
await sheet.screenshot({ path: sheetPath, fullPage: true });
await browser.close();
console.log(JSON.stringify({ cards: files, sheet: path.relative(ROOT, sheetPath) }, null, 2));
