#!/usr/bin/env node
// 사장님이 확인해야 할 일을 30초마다 살펴서 휴대폰 알림(ntfy)을 보낸다. serve.mjs 가 함께 켠다.
// 따로 켜려면: node tools/watch.mjs
//
// 알림 종류 (office.secrets.json → notify.events 로 끌 수 있음)
//   approval  새 결재 · 오래 기다리는 결재(30분, 2시간)
//   question  새 질문 · 답 없는 질문(10분, 1시간)
//   publish   게시 완료·실패 · 승인됐는데 아직 안 올린 게시본(2시간)
//   blocked   직원이 막힘(5분 넘게)
//   task      화면에서 보낸 업무를 아무 Claude 도 안 받음(3분) · 업무 끝남/실패
//   alert     직원·본부장이 직접 보낸 확인 요청(office.mjs alert)
//   system    상태 파일이 깨짐 · 사전지식 30일 지남(하루 한 번)
// 같은 알림은 한 번만 보낸다(보낸 기록: office-notify-log.json). 조용한 시간(notify.quietHours)에는 소리 없이 보낸다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { ROOT } from "./secrets.mjs";
import { notify } from "./notify.mjs";

const STATE = process.env.OFFICE_STATE || path.join(ROOT, "office-state.json");
const LOG = process.env.OFFICE_NOTIFY_LOG || path.join(path.dirname(STATE), "office-notify-log.json");
const MIN = 60000;
const age = (iso, now) => (iso ? (now - Date.parse(iso)) / MIN : 0);

function loadLog() { try { return JSON.parse(fs.readFileSync(LOG, "utf8")); } catch { return {}; } }
function saveLog(l) {
  // 30일 지난 기록은 버린다
  const cut = Date.now() - 30 * 24 * 60 * MIN;
  for (const k of Object.keys(l)) if (l[k] < cut) delete l[k];
  const tmp = LOG + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(l)); fs.renameSync(tmp, LOG);
}

/** office.mjs 가 바로 보낸 알림을 감시가 또 보내지 않게 기록 */
export function markSent(key) { const l = loadLog(); l[key] = Date.now(); saveLog(l); }

/** 지금 상태에서 보내야 할 알림 목록 (key 가 같으면 한 번만) */
export function findAlerts(s, now = Date.now()) {
  const out = [];
  const add = (key, event, title, message, pathHash = "", priority = 4, tags = []) => out.push({ key, event, title, message, path: pathHash, priority, tags });
  const name = (id) => ((s.sessions || []).find((x) => x.id === id) || {}).name || id;

  for (const q of s.questions || []) {
    if (q.answer || q.to === "lead") continue; // 팀장에게 먼저 묻는 질문은 사장님께 알리지 않음
    const m = age(q.askedAt, now);
    add(`q:${q.id}:new`, "question", `질문 ${q.id} — ${q.from || name(q.sessionId)}`, "답이 필요합니다. 질문함에서 답해 주세요.", "#q", 4, ["question"]);
    if (m >= 10 && m < 60) add(`q:${q.id}:10`, "question", `질문 ${q.id} 10분째 대기`, "직원이 답을 기다리며 멈춰 있습니다.", "#q", 4, ["hourglass"]);
    if (m >= 60) add(`q:${q.id}:60`, "question", `질문 ${q.id} 1시간째 대기`, "답이 없으면 일이 진행되지 않습니다.", "#q", 5, ["warning"]);
  }
  for (const a of s.approvals || []) {
    if (a.status === "pending") {
      const m = age(a.submittedAt, now);
      add(`a:${a.id}:new`, "approval", a.kind === "guideline" ? `가이드라인 제안 ${a.id} — 정해 주세요` : `결재 ${a.id} — 확인해 주세요`, String(a.title || "").slice(0, 80), "#" + a.id, 4, ["clipboard"]);
      if (m >= 30 && m < 120) add(`a:${a.id}:30`, "approval", `결재 ${a.id} 30분째 대기`, String(a.title || "").slice(0, 80), "#" + a.id, 4, ["hourglass"]);
      if (m >= 120) add(`a:${a.id}:120`, "approval", `결재 ${a.id} 2시간째 대기`, String(a.title || "").slice(0, 80), "#" + a.id, 5, ["warning"]);
    }
    if (a.status === "approved") {
      const files = (a.files || []).map((f) => String(f).split("/").pop());
      for (const ch of ["instagram", "threads"]) {
        if (!files.includes(`post-${ch}.json`)) continue;
        const p = (a.published || {})[ch];
        const label = ch === "instagram" ? "인스타그램" : "스레드";
        if (p && p.status === "done") add(`p:${a.id}:${ch}:done`, "publish", `${label} 게시 완료 (${a.id})`, p.url || "결재함에서 확인하세요", "#" + a.id, 3, ["white_check_mark"]);
        else if (p && p.status === "failed") add(`p:${a.id}:${ch}:failed:${p.at}`, "publish", `${label} 게시 실패 (${a.id})`, String(p.error || "").slice(0, 200), "#" + a.id, 5, ["warning"]);
        else if (!p && age(a.decidedAt, now) >= 120) add(`p:${a.id}:${ch}:wait`, "publish", `${label} 게시 대기 (${a.id})`, "승인된 게시본이 아직 올라가지 않았습니다. 결재함에서 '게시'를 눌러 주세요.", "#" + a.id, 3, ["hourglass"]);
      }
    }
  }
  for (const x of s.sessions || []) {
    if (x.state === "blocked" && age(x.stateSince, now) >= 5)
      add(`b:${x.id}:${x.stateSince}`, "blocked", `${x.name || x.id} 막힘`, "직원이 막혀서 진행하지 못하고 있습니다. 사무실 화면에서 확인해 주세요.", "#" + (x.floor || ""), 4, ["construction"]);
  }
  for (const t of s.tasks || []) {
    if (t.status === "new" && age(t.createdAt, now) >= 3)
      add(`t:${t.id}:untaken`, "task", `업무 ${t.id}를 받는 Claude 가 없습니다`, "Claude 대화에서 /office-watch 를 켜 두었는지 확인해 주세요.", "", 4, ["warning"]);
    if (t.status === "done") add(`t:${t.id}:done`, "task", `업무 ${t.id} 끝남`, String(t.note || "결과를 확인해 주세요.").slice(0, 200), "", 3, ["white_check_mark"]);
    if (t.status === "failed") add(`t:${t.id}:failed`, "task", `업무 ${t.id} 실패`, String(t.note || "").slice(0, 200), "", 5, ["warning"]);
  }
  for (const al of s.alerts || []) {
    add(`x:${al.id}`, "alert", al.title, String(al.message || "").slice(0, 300), al.path || "", al.urgent ? 5 : 4, ["bell"]);
  }
  return out;
}


export async function checkOnce() {
  const log = loadLog();
  const now = Date.now();
  let s;
  try { s = JSON.parse(fs.readFileSync(STATE, "utf8")); }
  catch (e) {
    if (e.code === "ENOENT") return 0;
    const key = "sys:state-broken:" + new Date().toISOString().slice(0, 13);
    if (!log[key]) { await notify({ event: "system", title: "사무실 기록 파일 오류", message: "office-state.json 을 읽지 못했습니다. 화면이 멈춰 있을 수 있습니다.", priority: 5, tags: ["warning"] }); log[key] = now; saveLog(log); }
    return 1;
  }
  const alerts = findAlerts(s, now);
  // 사전지식 30일 지남 (하루 한 번)
  const day = new Date().toISOString().slice(0, 10);
  if (!log["sys:knowledge:" + day]) {
    try { execFileSync(process.execPath, [path.join(ROOT, "tools/knowledge-check.mjs")], { stdio: "ignore" }); }
    catch { alerts.push({ key: "sys:knowledge:" + day, event: "system", title: "직원 사전지식이 30일 지났습니다", message: "Claude 대화에서 /knowledge-refresh 를 실행해 주세요.", path: "", priority: 2, tags: ["books"] }); }
    log["sys:knowledge-checked:" + day] = now;
  }
  let sent = 0;
  for (const a of alerts) {
    if (log[a.key]) continue;
    const r = await notify(a); // 조용한 시간 처리는 notify 가 한다
    if (r.sent || /주제.*없음|알림 끔/.test(r.reason || "")) log[a.key] = now; // 알림을 꺼 둔 종류는 다시 시도하지 않음
    if (r.sent) sent++;
  }
  saveLog(log);
  return sent;
}

/** serve.mjs 가 부른다. 처음 켤 때 이미 있던 것들은 '보낸 것'으로 치고(폭탄 알림 방지), 그다음부터 새로 생긴 것만 보낸다. */
export function startWatcher(intervalMs = 30000) {
  const log = loadLog();
  if (!log["sys:primed"]) {
    try {
      const s = JSON.parse(fs.readFileSync(STATE, "utf8"));
      for (const a of findAlerts(s)) log[a.key] = Date.now();
    } catch {}
    log["sys:primed"] = Date.now();
    saveLog(log);
  }
  let busy = false;
  const tick = async () => { if (busy) return; busy = true; try { await checkOnce(); } catch (e) { console.error("[알림] " + e.message); } finally { busy = false; } };
  tick();
  return setInterval(tick, intervalMs);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log("사장님 확인 알림 감시 시작 (30초마다). 멈추려면 Ctrl+C");
  startWatcher(30000);
}
