#!/usr/bin/env node
// 네이버 블로그 썸네일 (1:1, 1080×1080) — 공지사항 썸네일과 같은 디자인
//   공지(kind: notice) = Mist Light 보라 배경 / 정보성 글(kind: info) = 미색 Raw #F5F5F4 (사장님 결정 2026-11-27)
//
//   node tools/thumb.mjs work/<작업>/thumb.json
//   { "out": "work/<작업>/thumbnail.jpg", "kind": "info",
//     "cat": "메이크업 팁", "label": "LIP COLOR GUIDE 01", "title": "푸른기 있는\n입술",
//     "info": "쿨톤이어도 *뉴트럴 립*", "foot": "서면·전포 퍼스널컬러" }
// info 의 *별표* 안 글자만 Tourmaline(한 곳). 블로그 그림은 사장님이 따로 말하기 전까지 이 썸네일 1장만 만든다.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = process.argv[2];
if (!specPath) { console.log("사용: node tools/thumb.mjs work/<작업>/thumb.json"); process.exit(2); }
const t = JSON.parse(fs.readFileSync(path.resolve(ROOT, specPath), "utf8"));
const out = path.resolve(ROOT, t.out || path.join(path.dirname(specPath), "thumbnail.jpg"));
if (!path.relative(ROOT, out).startsWith("work")) { console.error("out 은 work/ 안이어야 합니다"); process.exit(2); }

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const BG = {
  notice: "radial-gradient(120% 140% at 75% 30%, #EFE4E9 0%, #D9D2E3 40%, #F5F5F4 85%)", // 공지: Mist Light
  tint: "#EFE4E9", // 정보: Tourmaline Tint (연한 분홍빛)
  raw: "#F5F5F4",  // 정보: Raw (가장 연한 미색)
};
const bg = t.kind === "notice" ? BG.notice : BG[t.bg] || BG.raw; // 정보성 글 기본 = 미색(사장님 결정 2026-11-27)
const info = esc(t.info).replace(/\*([^*]+)\*/, "<em>$1</em>");
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Tenor+Sans&family=Hahmlet:wght@300;400&family=IBM+Plex+Sans+KR:wght@400;500;600&display=block" rel="stylesheet">
<style>
:root{--raw:#F5F5F4;--white:#FFFFFF;--slate:#6B6670;--onyx:#221F26;--tour:#7E4560}
*{margin:0;padding:0;box-sizing:border-box}
.card{width:1080px;height:1080px;position:relative;overflow:hidden;color:var(--onyx);background:${bg};font-family:"IBM Plex Sans KR",sans-serif;padding:96px}
.head{display:flex;justify-content:space-between;align-items:flex-start}
.logo b{display:block;font-family:"Tenor Sans",serif;font-weight:400;font-size:52px;letter-spacing:.34em;line-height:1}
.logo span{display:block;margin-top:20px;font-family:"Tenor Sans",serif;font-size:15px;letter-spacing:.3em}
.cat{font-size:40px;font-weight:600;line-height:1;letter-spacing:-.01em;color:var(--raw);background:var(--onyx);padding:20px 40px 22px;border-radius:999px;margin-top:-6px}
.label{position:absolute;left:96px;top:330px;font-family:"Tenor Sans",serif;font-size:26px;letter-spacing:.24em}
h1{position:absolute;left:92px;top:390px;font-family:"Hahmlet",serif;font-weight:400;font-size:${t.titleSize || 128}px;line-height:1.22;letter-spacing:-.02em}
.panel{position:absolute;left:96px;right:96px;bottom:96px;background:var(--white);border-top:1px solid var(--onyx);padding:40px 48px;display:flex;justify-content:space-between;align-items:center;gap:24px}
.panel p{font-size:34px;font-weight:500;letter-spacing:-.01em}
.panel p em{font-style:normal;color:var(--tour);font-weight:600}
.panel small{font-size:24px;color:var(--slate);letter-spacing:-.01em;white-space:nowrap}
</style></head><body><div class="card">
<div class="head"><div class="logo"><b>RIAN</b><span>PERSONAL COLOR &amp; MAKEUP</span></div>${t.cat ? `<div class="cat">${esc(t.cat)}</div>` : ""}</div>
<div class="label">${esc(t.label)}</div>
<h1>${esc(t.title).replace(/\n/g, "<br>")}</h1>
<div class="panel"><p>${info}</p><small>${esc(t.foot || "서면·전포 퍼스널컬러")}</small></div>
</div></body></html>`;

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { console.error("playwright 가 없어 썸네일을 못 만듭니다. 클라우드 세션(samusil)에서 실행해 주세요."); process.exit(1); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
await p.setContent(html, { waitUntil: "load" });
await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
await p.waitForTimeout(300);
fs.mkdirSync(path.dirname(out), { recursive: true });
await p.screenshot({ path: out, type: "jpeg", quality: 92 });
await b.close();
console.log(path.relative(ROOT, out));
