#!/usr/bin/env node
// 사무실 출근부: 실제 작업 상태를 office-state.json 에 기록한다. (외부 패키지 없음)
//
//   node tools/office.mjs start <id> --role naver-blog-marketer [--name 이름] [--floor 층] [--parent 상위id]
//   node tools/office.mjs state <id> working|blocked|reporting|idle
//   node tools/office.mjs end   <id>                 # 퇴근
//   node tools/office.mjs ask   <id> "질문 내용"      # 대표실 앞 줄에 섬 → 질문 id 출력
//   node tools/office.mjs reply  <질문id> --text "답"  # 사장님 답 기록 (화면의 '보내기'가 쓰는 명령)
//   node tools/office.mjs wait   <질문id> [--timeout 분] # 답이 올 때까지 기다렸다가 답을 출력
//   node tools/office.mjs answer <질문id>             # 줄에서 빠짐(처리 끝)
//   node tools/office.mjs day end|start              # 하루 끝(소등) / 다시 시작
//   node tools/office.mjs list | reset
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE = process.env.OFFICE_STATE || path.join(ROOT, "office-state.json");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "office.config.json"), "utf8"));
const STATES = ["working", "blocked", "reporting", "idle"];
const nowIso = () => new Date().toISOString();

function load() {
  try { return JSON.parse(fs.readFileSync(STATE, "utf8")); }
  catch { return { dayEnded: false, sessions: [], questions: [], seq: 0 }; }
}
function save(s) {
  const tmp = STATE + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, STATE); // 통째로 바꿔치기 → 읽는 쪽이 반쯤 쓴 파일을 보지 않음
}
// 여러 작업자가 동시에 기록해도 꼬이지 않게 잠금
function withLock(fn) {
  const lock = STATE + ".lock";
  const until = Date.now() + 5000;
  for (;;) {
    try { fs.mkdirSync(lock); break; }
    catch {
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 10000) fs.rmSync(lock, { recursive: true }); } catch {}
      if (Date.now() > until) throw new Error("잠금 대기 시간 초과: " + lock);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try { const s = load(); const r = fn(s); save(s); return r; }
  finally { fs.rmSync(lock, { recursive: true, force: true }); }
}
function opts(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) o[argv[i].slice(2)] = argv[++i];
    else o._.push(argv[i]);
  }
  return o;
}
const die = (m) => { throw new Error(m); }; // throw 라서 잠금 해제(finally)가 반드시 실행된다
process.on("uncaughtException", (e) => { console.error("오류: " + e.message); process.exit(1); });

const [cmd, ...rest] = process.argv.slice(2);
const o = opts(rest);
const id = o._[0];

switch (cmd) {
  case "start": {
    if (!id) die("id 가 필요합니다");
    const role = o.role && CONFIG.roles[o.role];
    if (o.role && !role) die("모르는 역할: " + o.role);
    const floor = o.floor || (role && role.floor);
    const valid = ["ceo", ...CONFIG.floors.map((f) => f.id)];
    if (!floor || !valid.includes(floor)) die("층을 정해 주세요 (--floor " + valid.join("|") + ")");
    withLock((s) => {
      s.sessions = s.sessions.filter((x) => x.id !== id);
      s.sessions.push({ id, name: o.name || (role && role.name) || id, floor, role: o.role || null,
        state: "working", parentId: o.parent || null, startedAt: nowIso(), stateSince: nowIso() });
    });
    console.log("출근: " + id);
    break;
  }
  case "state": {
    const st = o._[1];
    if (!STATES.includes(st)) die("상태는 " + STATES.join("|"));
    withLock((s) => {
      const x = s.sessions.find((y) => y.id === id);
      if (!x) die("없는 작업자: " + id);
      if (x.state !== st) { x.state = st; x.stateSince = nowIso(); }
    });
    console.log(id + " → " + st);
    break;
  }
  case "end":
    withLock((s) => { s.sessions = s.sessions.filter((x) => x.id !== id); s.questions = s.questions.filter((q) => q.sessionId !== id); });
    console.log("퇴근: " + id);
    break;
  case "ask": {
    const text = o._.slice(1).join(" ");
    if (!text) die("질문 내용이 필요합니다");
    const qid = withLock((s) => {
      const x = s.sessions.find((y) => y.id === id);
      const q = { id: "q" + (++s.seq), sessionId: id, from: x ? x.name : id, text, askedAt: nowIso() };
      s.questions.push(q);
      return q.id;
    });
    console.log(qid);
    break;
  }
  case "reply": {
    const text = (o.text || "").trim();
    if (!text) die("답 내용이 필요합니다 (--text)");
    if (text.length > 2000) die("답이 너무 깁니다 (2000자 이하)");
    withLock((s) => {
      const q = s.questions.find((x) => x.id === id);
      if (!q) die("없는 질문: " + id + " (이미 처리됐을 수 있음)");
      q.answer = text; q.answeredAt = nowIso(); q.answeredVia = o.via || "screen";
    });
    console.log("답 기록: " + id);
    break;
  }
  case "wait": {
    // 답이 기록될 때까지 2초마다 확인. 잠금 없이 읽기만 한다(쓰기는 통째로 바꿔치기라 반쯤 쓴 파일을 보지 않음).
    const limit = Date.now() + (Number(o.timeout) > 0 ? Number(o.timeout) : 120) * 60000;
    for (;;) {
      const q = load().questions.find((x) => x.id === id);
      if (!q) { console.log(JSON.stringify({ id, status: "gone" })); process.exit(3); }
      if (q.answer) { console.log(JSON.stringify({ id, status: "answered", question: q.text, answer: q.answer, answeredAt: q.answeredAt, via: q.answeredVia })); process.exit(0); }
      if (Date.now() > limit) { console.log(JSON.stringify({ id, status: "timeout" })); process.exit(2); }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
    }
  }
  case "answer":
    withLock((s) => { s.questions = s.questions.filter((q) => q.id !== id); });
    console.log("답변 완료: " + id);
    break;
  case "day":
    if (!["end", "start"].includes(id)) die("day end|start");
    withLock((s) => { s.dayEnded = id === "end"; });
    console.log(id === "end" ? "하루 끝 – 소등" : "하루 시작");
    break;
  case "list": {
    const s = load();
    for (const x of s.sessions) console.log(`${x.id}\t${x.floor}\t${x.state}\t${x.name}`);
    for (const q of s.questions) console.log(`${q.id}\t${q.answer ? "답 옴" : "질문"}\t${q.from}\t${q.text}${q.answer ? "\t→ " + q.answer : ""}`);
    break;
  }
  case "reset":
    withLock((s) => { s.sessions = []; s.questions = []; s.dayEnded = false; });
    console.log("초기화");
    break;
  default:
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 14).join("\n"));
}
