#!/usr/bin/env node
// 직원 사전지식(knowledge/*.md) 점검: 오래된 파일, 근거 등급 없는 사실 줄.
//   node tools/knowledge-check.mjs            # 사람이 읽는 결과
//   node tools/knowledge-check.mjs --json     # 기계용
//   node tools/knowledge-check.mjs --max-age 30
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "knowledge");
const args = process.argv.slice(2);
const json = args.includes("--json");
const i = args.indexOf("--max-age");
const maxAge = i >= 0 ? Number(args[i + 1]) : 30;
const today = new Date(new Date().toISOString().slice(0, 10));

const out = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".md") && !["README.md", "CHANGELOG.md"].includes(x)).sort()) {
  const text = readFileSync(join(DIR, f), "utf8");
  const m = text.match(/최종 확인:\s*(\d{4}-\d{2}-\d{2})/);
  const checked = m ? m[1] : null;
  const age = checked ? Math.floor((today - new Date(checked)) / 86400000) : null;
  // 사실 줄: '- '로 시작하는 목록 중 '['로 시작하는 등급 표기가 없는 줄 (출처·판단 기준 절은 제외)
  const missing = [];
  let section = "";
  text.split("\n").forEach((line, n) => {
    if (line.startsWith("#")) section = line;
    if (!/^- /.test(line)) return;
    if (/출처|그래서|적용|지킬|꼭 물어/.test(section)) return;
    if (f === "request-defaults.md") return;
    if (!/\[(공식|보도|미확인|사장님 결정|brand\/|voice-)/.test(line)) missing.push(n + 1);
  });
  const grades = { 공식: (text.match(/\[공식[ ·(]/g) || []).length, 보도: (text.match(/\[보도/g) || []).length, 미확인: (text.match(/\[미확인/g) || []).length };
  const noExpiry = /갱신 주기:\s*없음/.test(text); // 사장님 결정 파일은 날짜로 낡지 않음
  out.push({ file: "knowledge/" + f, checked, age, stale: !noExpiry && (age == null || age > maxAge), noExpiry, missing, grades });
}

if (json) { console.log(JSON.stringify(out, null, 2)); process.exit(out.some((x) => x.stale) ? 1 : 0); }
for (const x of out) {
  const st = x.noExpiry ? "✓ 사장님 기준(기한 없음)" : x.checked == null ? "✗ 확인 날짜 없음" : x.stale ? `✗ 오래됨 (${x.age}일)` : `✓ ${x.age}일 전 확인`;
  console.log(`${st}  ${x.file}  공식 ${x.grades.공식} · 보도 ${x.grades.보도} · 미확인 ${x.grades.미확인}`);
  if (x.missing.length) console.log(`   △ 근거 등급 없는 줄: ${x.missing.join(", ")}`);
}
const stale = out.filter((x) => x.stale);
console.log(stale.length ? `\n갱신 필요 ${stale.length}개 → /knowledge-refresh` : "\n모두 최신 (기준 " + maxAge + "일)");
process.exit(stale.length ? 1 : 0);
