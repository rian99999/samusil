#!/usr/bin/env node
// RIAN 브랜드 자동 검사기: 직원이 만든 원고·시안 설계서를 brand/RIAN.md 와 brand/facts.md 규칙으로 검사한다.
//
//   node tools/brand-check.mjs work/<작업>/naver.md [더 많은 파일…]
//   node tools/brand-check.mjs --json work/<작업>/*.md
//
// 오류(✗) 가 하나라도 있으면 종료 코드 1. 경고(△)는 사람이 판단할 것.
// 파일 이름으로 채널을 알아낸다: naver / instagram / threads / design.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FULL_NAME = "리안 퍼스널컬러&메이크업";

// ---- 사실 자료에서 허용 금액을 읽는다 (가격이 바뀌어도 facts.md 만 고치면 됨)
function allowedPrices() {
  const set = new Set();
  try {
    const t = fs.readFileSync(path.join(ROOT, "brand/facts.md"), "utf8");
    for (const m of t.matchAll(/(\d{1,3}(?:,\d{3})+)원/g)) set.add(m[1]);
  } catch { /* 없으면 금액 검사는 건너뜀 */ }
  return set;
}

// [정규식, 이유, 수준]
const RULES = [
  [/무조건/g, "결과를 보장하는 말 '무조건'", "error"],
  [/100\s?%/g, "효과 보장 '100%'", "error"],
  [/실패\s?없는/g, "효과 보장 '실패 없는'", "error"],
  [/(부산|서면|전포|국내|업계)\s?(1위|최고)|최고의|최고급|넘버원|No\.?\s?1/gi, "근거 없는 최상급", "error"],
  [/유일한/g, "근거 없는 최상급 '유일한'", "error"],
  [/환골탈태|완전(히)? 다른 사람|다시 태어나/g, "극적인 변신 강조", "error"],
  [/단점을? (완벽하게 )?(없애|감추|가리)|누구나 똑같이/g, "고객을 고칠 대상으로 / 누구나 같은 결과", "error"],
  [/[✨💎]/gu, "금지 이모지 ✨💎", "error"],
  [/보석|원석|다이아|주얼리|글리터|로즈골드/g, "보석·주얼리 연상 (업종 오인)", "error"],
  [/테크노플라자|테크노 플라자/g, "건물명 오기 → 테크노프라자", "error"],
  [/\bRian\b|R\.I\.A\.N|리안뷰티|리안주얼리/g, "금지 상호 표기", "error"],
  [/이미지 ?컨설팅/g, "아직 없는 메뉴 '이미지 컨설팅'", "error"],
  [/(계좌|입금).{0,20}\d[\d-]{9,}/g, "계좌번호로 보이는 숫자 (어떤 글에도 쓰지 않음)", "error"],
  [/커버(하|해|할|된)|보완(하|해|할)/g, "'커버·보완' 대신 '정돈·조화'", "warn"],
  [/여성분|여자분|남성분|남자분|(\d0대)\s?(여성|남성|직장인)/g, "성별·나이를 전제하는 표현", "warn"],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "이모지 (✨💎 외에는 꼭 필요할 때만)", "warn"],
];

function check(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const base = path.basename(file).toLowerCase();
  const channel = /naver/.test(base) ? "naver" : /insta/.test(base) ? "instagram" : /thread/.test(base) ? "threads" : /design/.test(base) ? "design" : "other";
  const out = [];
  const add = (level, line, msg) => out.push({ level, line, msg });
  const lineOf = (idx) => text.slice(0, idx).split("\n").length;

  for (const [re, why, level] of RULES) {
    for (const m of text.matchAll(re)) {
      // 이모지 경고는 ✨💎 오류와 겹치지 않게
      if (level === "warn" && /이모지/.test(why) && /[✨💎]/u.test(m[0])) continue;
      add(level, lineOf(m.index), `${why}: "${m[0]}"`);
    }
  }

  // 상호: 글에서 '리안'이 처음 나올 때 전체 상호여야 한다 (디자인 설계서·워드마크 RIAN 은 제외)
  if (channel !== "design") {
    const first = text.search(/리안/);
    if (first >= 0 && !text.startsWith(FULL_NAME, first)) add("error", lineOf(first), `처음 언급은 '${FULL_NAME}' 전체 상호로`);
  }

  // '빛' 비유: 한 글에 한 번 (파일 안에 여러 글이 있으면 사람이 판단)
  const light = [...text.matchAll(/빛(?!깔)/g)];
  if (light.length > 1) add("warn", lineOf(light[1].index), `'빛' 비유가 ${light.length}번 — 한 글에 한 번만`);

  // 금액: facts.md 에 없는 금액
  const ok = allowedPrices();
  if (ok.size) {
    for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})+)원/g)) {
      if (!ok.has(m[1])) add("error", lineOf(m.index), `brand/facts.md 에 없는 금액 ${m[0]}`);
    }
    for (const m of text.matchAll(/(\d+(?:\.\d)?)\s?만\s?원/g)) {
      const won = Math.round(parseFloat(m[1]) * 10000).toLocaleString("en-US");
      if (!ok.has(won)) add("error", lineOf(m.index), `brand/facts.md 에 없는 금액 ${m[0]}`);
    }
  }

  // 채널 규칙
  if (channel === "instagram") {
    // 문단(빈 줄로 나뉜 덩어리)마다 해시태그 3~5개
    let start = 0;
    for (const block of text.split(/\n\s*\n/)) {
      const tags = block.match(/(^|\s)#[^\s#]+/g) || [];
      const at = lineOf(text.indexOf(block, start)); start = text.indexOf(block, start) + block.length;
      if (tags.length > 5) add("error", at, `해시태그 ${tags.length}개 — 3~5개`);
    }
  }
  if (channel === "naver") {
    // 본문 첫 문장(제목·목록·표·표시가 아닌 첫 문단)에 지역 + 업종 단어
    const firstPara = lines.findIndex((l) => l.trim() && !/^\s*(#|-|\*|\||>|\d+\.|\[|키워드|제목|태그)/.test(l));
    if (firstPara >= 0) {
      const l = lines[firstPara];
      if (!(/서면|전포|부산/.test(l) && /퍼스널컬러|메이크업/.test(l)))
        add("warn", firstPara + 1, "네이버 본문 첫 문장에 지역(서면·전포·부산) + 업종(퍼스널컬러·메이크업) 단어");
    }
  }
  if (channel === "design") {
    const tour = (text.match(/#?7E4560|Tourmaline|투르말린/gi) || []).length;
    if (!tour) add("warn", 1, "이미지마다 Tourmaline(#7E4560) 을 어디에 한 곳 쓰는지 적기");
    for (const m of text.matchAll(/#[0-9A-Fa-f]{6}\b/g)) {
      const allowed = ["F5F5F4", "E6E4E7", "FFFFFF", "D6D2D8", "6B6670", "221F26", "7E4560", "EFE4E9", "D9D2E3"];
      if (!allowed.includes(m[0].slice(1).toUpperCase())) add("error", lineOf(m.index), `가이드에 없는 색 ${m[0]}`);
    }
  }
  out.sort((a, b) => a.line - b.line);
  return { file, channel, errors: out.filter((x) => x.level === "error").length, warnings: out.filter((x) => x.level === "warn").length, issues: out };
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const files = args.filter((a) => a !== "--json");
if (!files.length) { console.error("검사할 파일을 주세요: node tools/brand-check.mjs work/<작업>/naver.md"); process.exit(2); }
const results = files.map((f) => {
  if (!fs.existsSync(f)) return { file: f, channel: "-", errors: 1, warnings: 0, issues: [{ level: "error", line: 0, msg: "파일 없음" }] };
  return check(f);
});
if (asJson) console.log(JSON.stringify(results, null, 2));
else for (const r of results) {
  console.log(`\n${r.errors ? "✗" : "✓"} ${r.file} (${r.channel}) — 오류 ${r.errors}, 경고 ${r.warnings}`);
  for (const x of r.issues) console.log(`  ${x.level === "error" ? "✗" : "△"} ${x.line}행: ${x.msg}`);
}
process.exit(results.some((r) => r.errors) ? 1 : 0);
