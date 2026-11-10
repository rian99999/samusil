#!/usr/bin/env node
// 3D 캐릭터를 그려 assets/chars/c0.png ~ c5.png (각 4x3 칸 스프라이트)로 굽는다.
//
//   cd tools/char3d && npm install && node render.mjs
//
// 모습을 바꾸려면 아래 AVATARS 를 고치고 다시 실행한다. 칸 순서는 render.html 의 SHEET.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../assets/chars");
const { chromium } = createRequire(import.meta.url)("playwright");

// 성별을 섞은 6가지 모습 – app.js 의 AVATARS 설명과 순서가 같아야 한다.
export const AVATARS = [
  { id: 0, label: "남 · 짧은 머리",   style: "short", skin: 0xf2c9a0, hair: 0x2b2420, top: 0x3d6fd8, bottom: 0x39414f },
  { id: 1, label: "여 · 긴 머리",     style: "long",  skin: 0xf6d2b4, hair: 0x5a3a26, top: 0xe8735a, bottom: 0x2f3a5a, skirt: true, collar: 0xffffff },
  { id: 2, label: "남 · 안경",       style: "short", skin: 0xe9bd93, hair: 0x6b4a33, top: 0x3aa76d, bottom: 0x6b7280, glasses: true },
  { id: 3, label: "여 · 단발",       style: "bob",   skin: 0xf3cba8, hair: 0x1f1b1a, top: 0xe8b62a, bottom: 0x3f4756 },
  { id: 4, label: "남 · 곱슬머리",   style: "curly", skin: 0xb98563, hair: 0x2a1d16, top: 0x8e5bd0, bottom: 0xc9b79a },
  { id: 5, label: "여 · 묶은 머리",   style: "pony",  skin: 0xf0c7a2, hair: 0x8a3b22, top: 0x2aa3b8, bottom: 0x555b66, skirt: true },
];

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "render.html";
  const file = path.resolve(HERE, rel);
  if (!file.startsWith(HERE + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, b) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(b);
  });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.goto(`http://localhost:${port}/render.html`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 20000 }).catch(() => {});
  if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  for (const a of AVATARS) {
    const url = await page.evaluate((av) => window.renderSheet(av), a);
    fs.writeFileSync(path.join(OUT, `c${a.id}.png`), Buffer.from(url.split(",")[1], "base64"));
    console.log(`c${a.id}.png  ${a.label}`);
  }
  await browser.close();
  server.close();
}
