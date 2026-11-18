#!/usr/bin/env node
// 실제 운영용 서버: 화면 파일 + /status.json (office-state.json 을 매번 새로 읽어서 내보냄)
//
//   node tools/serve.mjs [--port 8080]      → http://localhost:8080
//
// updatedAt = "서버가 기록 파일을 방금 읽었다"는 시각. 서버가 멈추면 화면은 5초 뒤 '확인 중'으로 멈춘다.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { publicSetup } from "./secrets.mjs";
import { startWatcher } from "./watch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE = process.env.OFFICE_STATE || path.join(ROOT, "office-state.json");
const i = process.argv.indexOf("--port");
const PORT = i > 0 ? +process.argv[i + 1] : 8080;
// 업무 지시를 화면에서 받으려면 사무실 비밀번호가 필요하다: --pin 1234 또는 OFFICE_PIN=1234
const pi = process.argv.indexOf("--pin");
const PIN = String(pi > 0 ? process.argv[pi + 1] : process.env.OFFICE_PIN || "");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const PUBLIC = new Set(["index.html", "app.js", "style.css", "sim.js", "assets/office.png", "assets/layout.json",
  ...[0, 1, 2, 3, 4, 5].map((n) => `assets/chars/c${n}.png`),
  "manifest.webmanifest", "assets/icons/icon-192.png", "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png", "assets/icons/apple-touch-icon.png"]);

function status() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "office.config.json"), "utf8"));
  let s = { dayEnded: false, sessions: [], questions: [] };
  try { s = JSON.parse(fs.readFileSync(STATE, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
  let setup = { instagram: false, threads: false, notify: false };
  try { setup = publicSetup(); } catch {}
  return { updatedAt: new Date().toISOString(), dayEnded: !!s.dayEnded, floors: cfg.floors, canAnswer: true, canApprove: true, canSendTask: !!PIN,
    canPublish: { instagram: !!PIN && setup.instagram, threads: !!PIN && setup.threads }, notifyOn: setup.notify,
    tasks: (s.tasks || []).slice(-10).map((t) => ({ id: t.id, status: t.status, createdAt: t.createdAt, takenAt: t.takenAt, doneAt: t.doneAt, note: t.note })), approvals: s.approvals || [], roles: cfg.roles || {}, sites: cfg.sites || [], sessions: s.sessions || [], questions: s.questions || [] };
}

// 화면의 질문함에서 '보내기' → office.mjs reply 로 기록 (잠금·검사는 office.mjs 가 한다)
function reply(id, text) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(ROOT, "tools/office.mjs"), "reply", id, "--text", text, "--via", "screen"],
      { env: process.env, timeout: 10000 }, (err, stdout, stderr) =>
        resolve(err ? { id, ok: false, error: (stderr || err.message).replace(/^오류: /, "").trim() } : { id, ok: true }));
  });
}
// 결재할 자료 보여 주기: work/ 와 reports/ 안의 글·그림만, 그 밖은 막는다
const VIEW_TYPES = { ".md": "text/plain; charset=utf-8", ".json": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
function fileApi(url, res) {
  const rel = String(url.searchParams.get("path") || "").replace(/\\/g, "/");
  const abs = path.resolve(ROOT, rel);
  const relNorm = path.relative(ROOT, abs).split(path.sep).join("/");
  const type = VIEW_TYPES[path.extname(abs).toLowerCase()];
  let real;
  try { real = fs.realpathSync(abs); } catch { real = null; }
  const inside = real && /^(work|reports)\//.test(path.relative(fs.realpathSync(ROOT), real).split(path.sep).join("/"));
  if (!/^(work|reports)\//.test(relNorm) || !type || !inside) { res.writeHead(404); return res.end("not found"); }
  fs.readFile(real, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    const head = { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" };
    // SVG 는 글자로 된 그림이라 안에 스크립트를 넣을 수 있다 → 그림으로만 보이게 막는다
    if (type === "image/svg+xml") head["content-security-policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";
    if (url.searchParams.get("download")) head["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(real))}`;
    res.writeHead(200, head);
    res.end(buf);
  });
}
function runOffice(args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(ROOT, "tools/office.mjs"), ...args], { env: process.env, timeout: 10000 }, (err, stdout, stderr) =>
      resolve(err ? { ok: false, error: (stderr || err.message).replace(/^오류: /, "").trim() } : { ok: true }));
  });
}
function readJson(req, res, send, cb) {
  if (req.method !== "POST") return send(405, { error: "POST 만 됩니다" });
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}`) return send(403, { error: "다른 사이트에서 온 요청" });
  if (!(req.headers["content-type"] || "").startsWith("application/json")) return send(415, { error: "JSON 만 됩니다" });
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 50000) req.destroy(); });
  req.on("end", () => { let j; try { j = JSON.parse(body); } catch { return send(400, { error: "잘못된 JSON" }); } cb(j); });
}
// 비밀번호 틀림이 잦으면 잠시 막는다 (10분에 5번)
const pinFails = [];
function pinOk(given) {
  const now = Date.now();
  while (pinFails.length && now - pinFails[0] > 600000) pinFails.shift();
  if (pinFails.length >= 5) return "locked";
  const a = Buffer.from(String(given || "")), b = Buffer.from(PIN);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) pinFails.push(now);
  return ok ? "ok" : "bad";
}
function taskApi(req, res) {
  const send = (code, obj) => { res.writeHead(code, { "content-type": TYPES[".json"], "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
  if (!PIN) return send(403, { error: "사무실 비밀번호가 설정되지 않아 업무를 받을 수 없습니다 (serve.mjs --pin 으로 실행)" });
  readJson(req, res, send, async (j) => {
    const r = pinOk(j.pin);
    if (r === "locked") return send(429, { error: "비밀번호를 여러 번 틀려 10분 동안 막혔습니다" });
    if (r !== "ok") return send(401, { error: "사무실 비밀번호가 맞지 않습니다" });
    const text = String(j.text || "").trim();
    if (!text || text.length > 8000) return send(400, { error: "업무 내용이 비었거나 너무 깁니다" });
    const out = await new Promise((resolve) => execFile(process.execPath, [path.join(ROOT, "tools/office.mjs"), "task-add", "--text", text, "--via", "screen"],
      { env: process.env, timeout: 10000 }, (err, stdout, stderr) => resolve(err ? { ok: false, error: (stderr || err.message).replace(/^오류: /, "").trim() } : { ok: true, id: stdout.trim() })));
    send(out.ok ? 200 : 500, out);
  });
}
// 승인된 결재를 인스타·스레드에 게시 (사장님이 화면에서 '게시'를 눌렀을 때만). 실제 일은 publish.mjs 가 한다.
const publishing = new Set();
function publishApi(req, res) {
  const send = (code, obj) => { res.writeHead(code, { "content-type": TYPES[".json"], "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
  if (!PIN) return send(403, { error: "사무실 비밀번호가 설정되지 않아 게시할 수 없습니다 (serve.mjs --pin 으로 실행)" });
  readJson(req, res, send, (j) => {
    const r = pinOk(j.pin);
    if (r === "locked") return send(429, { error: "비밀번호를 여러 번 틀려 10분 동안 막혔습니다" });
    if (r !== "ok") return send(401, { error: "사무실 비밀번호가 맞지 않습니다" });
    const id = String(j.id || ""), ch = String(j.channel || "");
    if (!/^a\d+$/.test(id) || !["instagram", "threads"].includes(ch)) return send(400, { error: "결재 번호나 채널이 잘못됐습니다" });
    try {
      const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
      const a = (st.approvals || []).find((x) => x.id === id);
      if (!a || a.status !== "approved") return send(409, { error: "승인된 결재가 아닙니다" });
      const p = (a.published || {})[ch];
      if (p && p.status === "done") return send(409, { error: "이미 게시됐습니다" });
    } catch { return send(500, { error: "상태 파일을 읽지 못했습니다" }); }
    const key = id + ":" + ch;
    if (publishing.has(key)) return send(409, { error: "이미 게시 중입니다" });
    publishing.add(key);
    const child = spawn(process.execPath, [path.join(ROOT, "tools/publish.mjs"), id, "--channel", ch], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", (b) => (log += b)); child.stderr.on("data", (b) => (log += b));
    const kill = setTimeout(() => child.kill(), 10 * 60000);
    child.on("exit", (code) => { clearTimeout(kill); publishing.delete(key); console.log(`[게시] ${id} ${ch} → ${code === 0 ? "완료" : "실패"}: ${log.trim().split("\n").pop()}`); });
    send(202, { ok: true, started: true });
  });
}
// 손으로 올린 뒤 '올렸어요' → 게시 완료로 기록 (재촉 알림이 멈추고, 자동 게시가 같은 글을 또 올리지 않게)
function manualPostedApi(req, res) {
  const send = (code, obj) => { res.writeHead(code, { "content-type": TYPES[".json"], "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
  readJson(req, res, send, async (j) => {
    const id = String(j.id || ""), ch = String(j.channel || ""), u = String(j.url || "").trim();
    if (!/^a\d+$/.test(id) || !["instagram", "threads"].includes(ch)) return send(400, { error: "결재 번호나 채널이 잘못됐습니다" });
    if (u && (!/^https:\/\/[^\s]+$/.test(u) || u.length > 500)) return send(400, { error: "주소가 올바르지 않습니다" });
    const r = await runOffice(["record-publish", id, "--channel", ch, "--status", "done", "--manual", "yes", ...(u ? ["--url", u] : [])]);
    send(r.ok ? 200 : 409, r.ok ? { ok: true } : { error: r.error });
  });
}
function decideApi(req, res) {
  const send = (code, obj) => { res.writeHead(code, { "content-type": TYPES[".json"], "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
  readJson(req, res, send, async (j) => {
    const id = String(j.id || ""), decision = String(j.decision || ""), note = String(j.note || "").trim();
    if (!/^a\d+$/.test(id) || !["approve", "revise"].includes(decision)) return send(400, { error: "결재 번호나 결정이 잘못됐습니다" });
    const r = await runOffice(["decide", id, decision, ...(note ? ["--note", note] : []), "--via", "screen"]);
    send(r.ok ? 200 : 409, r.ok ? { ok: true } : { error: r.error });
  });
}
function answerApi(req, res) {
  const send = (code, obj) => { res.writeHead(code, { "content-type": TYPES[".json"], "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
  if (req.method !== "POST") return send(405, { error: "POST 만 됩니다" });
  // 다른 사이트에서 몰래 보내는 것을 막는다: 이 화면(같은 주소)에서 온 요청만 받는다
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}`) return send(403, { error: "다른 사이트에서 온 요청" });
  if (!(req.headers["content-type"] || "").startsWith("application/json")) return send(415, { error: "JSON 만 됩니다" });
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 50000) { req.destroy(); } });
  req.on("end", async () => {
    let list;
    try { list = JSON.parse(body).answers; } catch { return send(400, { error: "잘못된 JSON" }); }
    if (!Array.isArray(list) || !list.length || list.length > 20) return send(400, { error: "answers 가 필요합니다" });
    const results = [];
    for (const a of list) {
      const id = String(a && a.id || ""), text = String(a && a.text || "").trim();
      if (!/^q\d+$/.test(id) || !text) { results.push({ id, ok: false, error: "질문 번호나 답이 비었습니다" }); continue; }
      results.push(await reply(id, text));
    }
    send(200, { results });
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/status.json") {
    try {
      const body = JSON.stringify(status());
      res.writeHead(200, { "content-type": TYPES[".json"], "cache-control": "no-store" });
      return res.end(body);
    } catch (e) {
      // 기록 파일이 깨졌으면 성공인 척하지 않는다 → 화면은 '확인 중'
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      return res.end("상태 파일을 읽지 못함: " + e.message);
    }
  }
  if (url.pathname === "/api/answer") return answerApi(req, res);
  if (url.pathname === "/api/decide") return decideApi(req, res);
  if (url.pathname === "/api/task") return taskApi(req, res);
  if (url.pathname === "/api/publish") return publishApi(req, res);
  if (url.pathname === "/api/manual-posted") return manualPostedApi(req, res);
  if (url.pathname === "/api/file") return fileApi(url, res);
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!PUBLIC.has(rel)) { res.writeHead(404); return res.end("not found"); }
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, async () => {
  const { networkInterfaces } = await import("node:os");
  const ips = Object.values(networkInterfaces()).flat().filter((n) => n && n.family === "IPv4" && !n.internal).map((n) => n.address);
  console.log(`AI 사무실: http://localhost:${PORT}`);
  console.log(PIN ? "업무 지시 받기: 켜짐 (사무실 비밀번호 설정됨)" : "업무 지시 받기: 꺼짐 (켜려면 --pin <비밀번호>)");
  for (const ip of ips) console.log(`같은 와이파이의 휴대폰에서: http://${ip}:${PORT}`);
  let st = {};
  try { st = publicSetup(); } catch (e) { console.log("연결 정보 파일 오류: " + e.message); }
  if (st.notify) startWatcher(30000);
  console.log(`휴대폰 알림: ${st.notify ? "켜짐" : "꺼짐 (office.secrets.json 의 notify.ntfyTopic)"} · 게시 연결: 인스타 ${st.instagram ? "있음" : "없음"} / 스레드 ${st.threads ? "있음" : "없음"}${PIN ? "" : " (게시는 --pin 필요)"}`);
});
