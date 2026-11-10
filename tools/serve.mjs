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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE = process.env.OFFICE_STATE || path.join(ROOT, "office-state.json");
const i = process.argv.indexOf("--port");
const PORT = i > 0 ? +process.argv[i + 1] : 8080;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
const PUBLIC = new Set(["index.html", "app.js", "style.css", "sim.js", "assets/office.png", "assets/layout.json",
  ...[0, 1, 2, 3, 4, 5].map((n) => `assets/chars/c${n}.png`)]);

function status() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "office.config.json"), "utf8"));
  let s = { dayEnded: false, sessions: [], questions: [] };
  try { s = JSON.parse(fs.readFileSync(STATE, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
  return { updatedAt: new Date().toISOString(), dayEnded: !!s.dayEnded, floors: cfg.floors, roles: cfg.roles || {}, sessions: s.sessions || [], questions: s.questions || [] };
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
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!PUBLIC.has(rel)) { res.writeHead(404); return res.end("not found"); }
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`AI 사무실: http://localhost:${PORT}`));
