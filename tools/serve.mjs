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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE = process.env.OFFICE_STATE || path.join(ROOT, "office-state.json");
const i = process.argv.indexOf("--port");
const PORT = i > 0 ? +process.argv[i + 1] : 8080;
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
  return { updatedAt: new Date().toISOString(), dayEnded: !!s.dayEnded, floors: cfg.floors, canAnswer: true, roles: cfg.roles || {}, sites: cfg.sites || [], sessions: s.sessions || [], questions: s.questions || [] };
}

// 화면의 질문함에서 '보내기' → office.mjs reply 로 기록 (잠금·검사는 office.mjs 가 한다)
function reply(id, text) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(ROOT, "tools/office.mjs"), "reply", id, "--text", text, "--via", "screen"],
      { env: process.env, timeout: 10000 }, (err, stdout, stderr) =>
        resolve(err ? { id, ok: false, error: (stderr || err.message).replace(/^오류: /, "").trim() } : { id, ok: true }));
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
  for (const ip of ips) console.log(`같은 와이파이의 휴대폰에서: http://${ip}:${PORT}`);
});
