#!/usr/bin/env node
// 승인된 결재를 인스타그램·스레드에 게시한다 (Meta 공식 API). 사장님 컴퓨터에서 serve.mjs 가 부른다.
//
//   node tools/publish.mjs <결재id> --channel instagram|threads [--dry-run]
//
// 지키는 것
//  1. 결재가 '승인'이고, 결재 자료에 post-<채널>.json 이 들어 있어야 한다.
//  2. 결재 올릴 때 남긴 지문(sha256)과 지금 파일이 같아야 한다(승인 뒤 바뀐 글은 안 올림). 그림 파일도 같다.
//  3. 올리기 전 검사: 광고 표시 첫 줄, 해시태그 5개 이하, 글자 수, 그림 형식, 브랜드 검사 오류 0.
//  4. 같은 결재·채널은 한 번만 게시. 스레드는 글 1개만(타래 이어 달기는 문서 확인 전이라 꺼 둠).
//  5. Meta 는 그림을 '인터넷 주소'에서 가져간다 → 게시하는 동안만 그 그림들만 임시 공개 주소(cloudflared)로 연다.
// 토큰은 office.secrets.json 에서만 읽고, 어디에도 출력하지 않는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { ROOT, loadSecrets } from "./secrets.mjs";
import { notify } from "./notify.mjs";

const STATE = process.env.OFFICE_STATE || path.join(ROOT, "office-state.json");
const argv = process.argv.slice(2);
const aid = argv[0];
const flag = (k) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : undefined; };
const channel = flag("channel");
const dryRun = argv.includes("--dry-run");
const LABEL = { instagram: "인스타그램", threads: "스레드" };

const sha256 = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let SECRET_VALUES = [];
const scrub = (t) => SECRET_VALUES.reduce((acc, v) => (v ? acc.split(v).join("***") : acc), String(t));
function office(args) { execFileSync(process.execPath, [path.join(ROOT, "tools/office.mjs"), ...args], { env: process.env, stdio: ["ignore", "ignore", "pipe"] }); }
function fail(msg, { record = true } = {}) {
  const m = scrub(msg);
  console.error("게시 안 함: " + m);
  if (record && !dryRun) { try { office(["record-publish", aid, "--channel", channel, "--status", "failed", "--error", m]); } catch {} }
  return m;
}

// ---------------------------------------------------------------- 검사
const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️/u;
/** 스레드 글자 수: 이모지는 UTF-8 바이트 수만큼 센다 (Meta 개발자 문서) */
export function threadsLength(t) { let n = 0; for (const ch of String(t)) n += EMOJI.test(ch) ? Buffer.byteLength(ch) : 1; return n; }
const hashtags = (t) => (String(t).match(/(^|\s)#[^\s#]+/g) || []).length;
const firstLine = (t) => (String(t).split("\n").find((l) => l.trim()) || "").trim();
const AD_WORDS = /(광고|협찬|유료\s*광고|수수료)/;

function checkSpec(ch, spec, files) {
  const errs = [];
  if (ch === "instagram") {
    const cap = String(spec.caption || "");
    if (!cap.trim()) errs.push("캡션(caption)이 비었습니다");
    if ([...cap].length > 2200) errs.push(`캡션이 ${[...cap].length}자입니다 (2200자 이하)`);
    if (hashtags(cap) > 5) errs.push(`해시태그가 ${hashtags(cap)}개입니다 (5개 이하)`);
    const imgs = Array.isArray(spec.images) ? spec.images : [];
    if (imgs.length < 1 || imgs.length > 10) errs.push(`그림은 1~10장이어야 합니다 (지금 ${imgs.length}장)`);
    for (const p of imgs) if (!/\.jpe?g$/i.test(p)) errs.push(`인스타그램 API 는 JPEG 그림만 받습니다: ${p}`);
    if (spec.ad && !AD_WORDS.test(firstLine(cap))) errs.push("광고 글인데 캡션 첫 줄에 광고 표시(광고·협찬·수수료)가 없습니다");
  } else {
    const posts = Array.isArray(spec.posts) ? spec.posts.map(String) : [];
    if (!posts.length || posts.some((p) => !p.trim())) errs.push("글(posts)이 비었습니다");
    // 타래(앞 글에 이어 달기)에 쓰는 reply_to_id 는 Meta 문서에서 아직 확인하지 못했다 → 자동 게시는 글 1개만
    if (posts.length > 1) errs.push("스레드 자동 게시는 글 1개만 됩니다(타래 이어 달기는 Meta 문서 확인 전이라 꺼 둠). 나머지 글은 앱에서 직접 이어 달아 주세요");
    posts.forEach((p, i) => { const n = threadsLength(p); if (n > 500) errs.push(`${i + 1}번째 글이 ${n}자입니다 (500자 이하, 이모지는 바이트로 셈)`); });
    const tag = spec.topicTag == null ? "" : String(spec.topicTag);
    if (tag && (tag.length > 50 || /[.&\s]/.test(tag))) errs.push("주제 태그는 1~50자, 마침표·&·띄어쓰기 없이 하나만");
    if (spec.image && !/\.(jpe?g|png)$/i.test(spec.image)) errs.push("스레드 그림은 JPEG·PNG 만: " + spec.image);
    if (spec.ad && !AD_WORDS.test(firstLine(posts[0] || ""))) errs.push("광고 글인데 첫 글 첫 줄에 광고 표시(광고·협찬·수수료)가 없습니다");
  }
  // 그림은 결재 자료에 들어 있어야 하고, 결재 때와 같아야 한다
  const imgs = ch === "instagram" ? (spec.images || []) : (spec.image ? [spec.image] : []);
  for (const p of imgs) {
    if (!files.list.includes(p)) errs.push("결재 자료에 없는 그림: " + p);
    else if (files.hashes[p] && fs.existsSync(path.join(ROOT, p)) && sha256(path.join(ROOT, p)) !== files.hashes[p]) errs.push("결재 뒤에 바뀐 그림: " + p);
    else if (!fs.existsSync(path.join(ROOT, p))) errs.push("그림 파일 없음: " + p);
  }
  // 브랜드 검사기(금지어·상호 표기·가격·계좌번호 등)를 글 전체에 돌린다
  const text = ch === "instagram" ? String(spec.caption || "") : (spec.posts || []).join("\n\n");
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "office-pub-")), `${ch}.md`);
  fs.writeFileSync(tmp, text);
  try { execFileSync(process.execPath, [path.join(ROOT, "tools/brand-check.mjs"), tmp], { stdio: "pipe" }); }
  catch (e) { errs.push("브랜드 검사 오류: " + String(e.stdout || "").split("\n").filter((l) => /^\s+✗/.test(l)).map((l) => l.trim().replace(/^✗\s*/, "")).join(" / ").slice(0, 400)); }
  finally { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); }
  return errs;
}

// ---------------------------------------------------------------- 그림 임시 공개
async function openMedia(paths, mode) {
  const token = crypto.randomBytes(16).toString("hex");
  const map = new Map(paths.map((p, i) => [`/${token}/${i}${path.extname(p).toLowerCase()}`, path.join(ROOT, p)]));
  const type = (f) => (/\.png$/i.test(f) ? "image/png" : "image/jpeg");
  const server = http.createServer((req, res) => {
    const f = map.get(new URL(req.url, "http://x").pathname); // 이 게시물의 그림만, 추측하기 어려운 주소로
    if (!f || !["GET", "HEAD"].includes(req.method)) { res.writeHead(404); return res.end(); }
    const buf = fs.readFileSync(f);
    res.writeHead(200, { "content-type": type(f), "content-length": buf.length, "cache-control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : buf);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const local = `http://127.0.0.1:${server.address().port}`;
  let tunnel = null, base = local;
  if (mode !== "local") {
    // Cloudflare 무료 임시 터널: 계정 없이 https://<임의>.trycloudflare.com 주소가 생긴다. 끝나면 바로 닫는다.
    tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", local], { stdio: ["ignore", "pipe", "pipe"] });
    base = await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("임시 공개 주소를 30초 안에 못 만들었습니다")), 30000);
      const onData = (b) => { const m = String(b).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m) { clearTimeout(to); resolve(m[0]); } };
      tunnel.stdout.on("data", onData); tunnel.stderr.on("data", onData);
      tunnel.on("error", (e) => { clearTimeout(to); reject(new Error(e.code === "ENOENT" ? "cloudflared 가 설치돼 있지 않습니다 (README '게시 준비' 참고)" : e.message)); });
      tunnel.on("exit", (c) => { clearTimeout(to); reject(new Error("cloudflared 가 멈췄습니다 (" + c + ")")); });
    });
    // 주소가 실제로 열릴 때까지 확인
    const first = base + [...map.keys()][0];
    for (let i = 0; ; i++) {
      try { const r = await fetch(first, { method: "HEAD", signal: AbortSignal.timeout(5000) }); if (r.ok) break; } catch {}
      if (i > 15) throw new Error("임시 공개 주소가 열리지 않습니다");
      await sleep(2000);
    }
  }
  return {
    urls: [...map.keys()].map((k) => base + k),
    close: () => { try { tunnel && tunnel.kill(); } catch {} server.close(); },
  };
}

// ---------------------------------------------------------------- Meta API
function apiBase(c) { return String(c.apiHost).replace(/\/+$/, "") + (c.apiVersion ? "/" + c.apiVersion : ""); }
async function call(c, method, p, params = {}) {
  const url = new URL(apiBase(c) + "/" + p);
  const body = new URLSearchParams({ ...params, access_token: c.accessToken });
  let r;
  if (method === "GET") { body.forEach((v, k) => url.searchParams.set(k, v)); r = await fetch(url, { signal: AbortSignal.timeout(30000) }); }
  else r = await fetch(url, { method: "POST", body, signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Meta 응답 ${r.status}: ${(j.error && (j.error.error_user_msg || j.error.message)) || "알 수 없는 오류"}`);
  return j;
}
async function waitReady(c, id, field, okVals, badVals, maxMs) {
  const until = Date.now() + maxMs;
  for (;;) {
    let v = null;
    try { v = (await call(c, "GET", id, { fields: field }))[field]; } catch (e) { if (Date.now() > until) throw e; }
    if (v && okVals.includes(v)) return;
    if (v && badVals.includes(v)) throw new Error(`Meta 처리 실패 (${field}: ${v})`);
    if (Date.now() > until) throw new Error(`Meta 처리가 늦습니다 (${field}: ${v || "모름"})`);
    await sleep(3000);
  }
}
async function publishInstagram(c, spec, urls) {
  const caption = String(spec.caption);
  let container;
  if (urls.length === 1) container = (await call(c, "POST", `${c.userId}/media`, { image_url: urls[0], caption })).id;
  else {
    const kids = [];
    for (const u of urls) kids.push((await call(c, "POST", `${c.userId}/media`, { image_url: u, is_carousel_item: "true" })).id);
    for (const k of kids) await waitReady(c, k, "status_code", ["FINISHED"], ["ERROR", "EXPIRED"], 90000);
    container = (await call(c, "POST", `${c.userId}/media`, { media_type: "CAROUSEL", children: kids.join(","), caption })).id;
  }
  await waitReady(c, container, "status_code", ["FINISHED"], ["ERROR", "EXPIRED"], 90000);
  const mediaId = (await call(c, "POST", `${c.userId}/media_publish`, { creation_id: container })).id;
  let url = "";
  try { url = (await call(c, "GET", mediaId, { fields: "permalink" })).permalink || ""; } catch {}
  return { id: mediaId, url, posted: 1 };
}
async function publishThreads(c, spec, urls, progress) {
  const posts = spec.posts.map(String);
  let prev = null, firstUrl = "";
  for (let i = 0; i < posts.length; i++) {
    const params = { text: posts[i], media_type: i === 0 && urls[0] ? "IMAGE" : "TEXT" };
    if (i === 0 && urls[0]) params.image_url = urls[0];
    if (i === 0 && spec.topicTag) params.topic_tag = String(spec.topicTag);
    if (prev) params.reply_to_id = prev; // 타래: 앞 글에 이어 단다
    const container = (await call(c, "POST", `${c.userId}/threads`, params)).id;
    // Meta 는 게시 전 평균 30초 기다리기를 권한다 → 상태가 FINISHED 가 될 때까지 확인
    await waitReady(c, container, "status", ["FINISHED"], ["ERROR", "EXPIRED"], 120000);
    prev = (await call(c, "POST", `${c.userId}/threads_publish`, { creation_id: container })).id;
    progress(i + 1);
    if (i === 0) { try { firstUrl = (await call(c, "GET", prev, { fields: "permalink" })).permalink || ""; } catch {} }
  }
  return { id: prev, url: firstUrl, posted: posts.length };
}

// ---------------------------------------------------------------- 실행
async function main() {
  if (!/^a\d+$/.test(aid || "") || !LABEL[channel]) { console.error("사용: node tools/publish.mjs <결재id> --channel instagram|threads [--dry-run]"); process.exit(2); }
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const ap = (state.approvals || []).find((x) => x.id === aid);
  if (!ap) return fail("없는 결재: " + aid, { record: false }), process.exit(1);
  if (ap.status !== "approved") return fail(`승인되지 않은 결재입니다 (${ap.status})`, { record: false }), process.exit(1);
  const cur = ap.published && ap.published[channel];
  if (cur && cur.status === "done") return fail("이미 게시됨: " + (cur.url || ""), { record: false }), process.exit(1);
  if (cur && cur.status === "failed" && cur.posted > 0) return fail(`지난번에 ${cur.posted}개 글까지 올라간 뒤 멈췄습니다. 중복을 막기 위해 다시 올리지 않습니다. 앱에서 확인해 주세요.`, { record: false }), process.exit(1);
  const specPath = (ap.files || []).find((f) => path.basename(f) === `post-${channel}.json`);
  if (!specPath) return fail(`결재 자료에 post-${channel}.json 이 없습니다`, { record: !dryRun }), process.exit(1);
  const abs = path.join(ROOT, specPath);
  if (!fs.existsSync(abs)) return fail("게시본 파일이 없습니다: " + specPath, { record: !dryRun }), process.exit(1);
  if (!ap.hashes || ap.hashes[specPath] !== sha256(abs)) return fail("검사 실패 — 결재 뒤에 게시본이 바뀌었거나 지문이 없습니다. 다시 결재를 받아야 합니다: " + specPath, { record: !dryRun }), process.exit(1);
  let spec;
  try { spec = JSON.parse(fs.readFileSync(abs, "utf8")); } catch (e) { return fail("게시본 JSON 오류: " + e.message, { record: !dryRun }), process.exit(1); }
  const errs = checkSpec(channel, spec, { list: ap.files || [], hashes: ap.hashes || {} });
  if (errs.length) return fail("검사 실패 — " + errs.join(" | ") + " → 직원에게 수정 요청 후 새로 결재", { record: !dryRun }), process.exit(1);

  const secrets = loadSecrets();
  const c = secrets[channel] || {};
  if (!c.userId || !c.accessToken) return fail(`${LABEL[channel]} 연결 정보가 없습니다 (office.secrets.json 의 ${channel}.userId·accessToken)`, { record: !dryRun }), process.exit(1);
  c.apiHost = c.apiHost || (channel === "instagram" ? "https://graph.instagram.com" : "https://graph.threads.net");
  if (channel === "threads" && c.apiVersion === undefined) c.apiVersion = "v1.0";
  SECRET_VALUES = [c.accessToken];
  if (dryRun) { console.log(`검사 통과: ${aid} ${LABEL[channel]} — 실제로 올리려면 --dry-run 없이`); return; }

  office(["record-publish", aid, "--channel", channel, "--status", "publishing"]);
  const imgs = channel === "instagram" ? spec.images : (spec.image ? [spec.image] : []);
  let media = null, posted = 0;
  try {
    media = imgs.length ? await openMedia(imgs, (secrets.publicMedia || {}).mode) : { urls: [], close() {} };
    const r = channel === "instagram"
      ? await publishInstagram(c, spec, media.urls)
      : await publishThreads(c, spec, media.urls, (n) => { posted = n; });
    office(["record-publish", aid, "--channel", channel, "--status", "done", "--url", r.url || "", "--posted", String(r.posted)]);
    console.log(`게시 완료: ${LABEL[channel]} ${r.url || r.id}`);
    await notify({ event: "publish", title: `${LABEL[channel]} 게시 완료 (${aid})`, message: r.url || "사무실 화면 결재함에서 확인하세요", path: "#" + aid, tags: ["white_check_mark"], priority: 3 });
  } catch (e) {
    const m = scrub(e.message) + (posted ? ` (${posted}개 글까지는 올라감)` : "");
    try { office(["record-publish", aid, "--channel", channel, "--status", "failed", "--error", m, ...(posted ? ["--posted", String(posted)] : [])]); } catch {}
    console.error("게시 실패: " + m);
    await notify({ event: "publish", title: `${LABEL[channel]} 게시 실패 (${aid})`, message: m.slice(0, 200), path: "#" + aid, tags: ["warning"], priority: 4 });
    process.exitCode = 1;
  } finally {
    if (media) media.close();
  }
}
main().catch((e) => { console.error("오류: " + scrub(e.message)); process.exit(1); });
