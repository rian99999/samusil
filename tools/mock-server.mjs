#!/usr/bin/env node
// 시연용 서버: 정적 파일 + 가짜 상태(/status.json, sim.js). 외부 패키지 없음.
//
//   node tools/mock-server.mjs [--port 8080]
//
// 조작: /__mock?pause=1|0  /__mock?dayEnded=1|0  /__mock?spawn=1  /__mock?ask=1
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { createSim } = createRequire(import.meta.url)(path.join(ROOT, "sim.js"));
const i = process.argv.indexOf("--port");
const PORT = i > 0 ? +process.argv[i + 1] : 8080;
const sim = createSim();
setInterval(() => sim.tick(), 1000);

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/status.json") {
    res.writeHead(200, { "content-type": TYPES[".json"], "cache-control": "no-store" });
    return res.end(JSON.stringify(sim.snapshot()));
  }
  if (url.pathname === "/__mock") {
    const p = url.searchParams;
    if (p.has("pause")) sim.setPaused(p.get("pause") === "1");
    if (p.has("dayEnded")) sim.setDayEnded(p.get("dayEnded") === "1");
    if (p.has("spawn")) sim.spawn();
    if (p.has("ask")) sim.ask();
    res.writeHead(200, { "content-type": TYPES[".json"] });
    return res.end(JSON.stringify({ paused: sim.paused, dayEnded: sim.dayEnded }));
  }
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`시연: http://localhost:${PORT}  (조작: /__mock?pause=1 | dayEnded=1 | spawn=1 | ask=1)`));
