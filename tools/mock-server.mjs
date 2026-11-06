#!/usr/bin/env node
// 시연용 서버: 정적 파일 + 가짜 상태(/status.json)를 만든다. 외부 패키지 없음.
//
//   node tools/mock-server.mjs [--port 8080]
//
// 조작(브라우저 주소창이나 curl 로):
//   /__mock?pause=1      updatedAt 갱신 중단 → 5초 뒤 화면이 '확인 중'으로 멈춰야 한다
//   /__mock?pause=0      재개
//   /__mock?dayEnded=1   하루 끝 → 층마다 차례로 불이 꺼진다 (0 이면 다시 켜짐)
//   /__mock?spawn=1      하위 작업자 1명 즉시 출근
//   /__mock?ask=1        질문 1개 즉시 추가
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argPort = process.argv.indexOf("--port");
const PORT = argPort > 0 ? +process.argv[argPort + 1] : 8080;

const MIN = 60_000;
const now = () => Date.now();
const iso = (t) => new Date(t).toISOString();
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const floors = [
  { id: "web", name: "웹 화면팀" },
  { id: "api", name: "서버팀" },
  { id: "data", name: "데이터팀" },
];

let seq = 0;
const mk = (floor, name, state, startedAgoMin, parentId = null, stateAgoMin = 0) => ({
  id: `s${++seq}`, name, floor, state, parentId,
  startedAt: iso(now() - startedAgoMin * MIN),
  stateSince: iso(now() - stateAgoMin * MIN),
});

const sessions = [
  mk("ceo", "총괄 비서", "working", 12),
  mk("web", "로그인 화면", "working", 8),
  mk("web", "결제 페이지", "working", 52),           // 40분 초과 → 땀
  mk("web", "디자인 점검", "idle", 30, null, 4),     // 커피
  mk("api", "주문 API", "blocked", 25, null, 6),     // 막힘 → 땀
  mk("api", "로그 정리", "idle", 60, null, 15),      // 졸음
  mk("api", "배포 준비", "reporting", 18),            // 만세 + 별
  mk("data", "매출 집계", "working", 3),
  mk("data", "보고서 초안", "working", 44),
];
const questions = [
  { id: "q1", sessionId: "s5", from: "주문 API", text: "결제 실패 시 재시도 횟수를 몇 번으로 할까요?", askedAt: iso(now() - 12 * MIN) },
  { id: "q2", sessionId: "s3", from: "결제 페이지", text: "카드 외에 계좌이체도 넣을까요?", askedAt: iso(now() - 4 * MIN) },
];

let paused = false;
let dayEnded = false;
let frozen = null;
let qseq = 10;
const SUB = ["테스트 작성", "문서 정리", "코드 검토", "자료 조사", "버그 재현", "번역"];

function spawnSub() {
  const parents = sessions.filter((s) => !s.parentId && s.floor !== "ceo");
  if (!parents.length) return;
  const p = pick(parents);
  const s = mk(p.floor, `${p.name}·${pick(SUB)}`, "working", 0, p.id);
  sessions.push(s);
  // 20~40초 일하고 → 4초 보고 → 퇴근
  setTimeout(() => { s.state = "reporting"; s.stateSince = iso(now()); }, 20_000 + Math.random() * 20_000);
}
function ask() {
  const s = pick(sessions.filter((x) => x.floor !== "ceo"));
  const q = { id: `q${++qseq}`, sessionId: s.id, from: s.name, text: pick(["이 방향 맞나요?", "삭제해도 될까요?", "어느 안으로 할까요?", "마감 언제까지인가요?"]), askedAt: iso(now()) };
  questions.push(q);
  setTimeout(() => { const i = questions.indexOf(q); if (i >= 0) questions.splice(i, 1); }, 25_000 + Math.random() * 35_000);
}

// 시뮬레이션: 매초 조금씩 상태가 바뀐다
setInterval(() => {
  if (paused) return;
  // 보고가 끝난 하위 작업자는 퇴근
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (s.parentId && s.state === "reporting" && now() - Date.parse(s.stateSince) > 4000) sessions.splice(i, 1);
  }
  if (Math.random() < 0.06 && sessions.filter((s) => s.parentId).length < 5) spawnSub();
  if (Math.random() < 0.03 && questions.length < 6) ask();
  if (Math.random() < 0.05) {
    const s = pick(sessions.filter((x) => !x.parentId && x.id !== "s3" && x.id !== "s5"));
    const next = pick(["working", "idle", "reporting", "working"]);
    if (s && s.state !== next) { s.state = next; s.stateSince = iso(now()); }
  }
}, 1000);

function snapshot() {
  return { updatedAt: iso(now()), dayEnded, floors, sessions, questions };
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/status.json") {
    const body = paused ? frozen : JSON.stringify(snapshot());
    res.writeHead(200, { "content-type": TYPES[".json"], "cache-control": "no-store" });
    return res.end(body);
  }
  if (url.pathname === "/__mock") {
    const p = url.searchParams;
    if (p.has("pause")) { paused = p.get("pause") === "1"; frozen = JSON.stringify(snapshot()); }
    if (p.has("dayEnded")) dayEnded = p.get("dayEnded") === "1";
    if (p.has("spawn")) spawnSub();
    if (p.has("ask")) ask();
    res.writeHead(200, { "content-type": TYPES[".json"] });
    return res.end(JSON.stringify({ paused, dayEnded, sessions: sessions.length, questions: questions.length }));
  }
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (조작: /__mock?pause=1 | dayEnded=1 | spawn=1 | ask=1)`));
