#!/usr/bin/env node
// 휴대폰 알림 (ntfy). 휴대폰에 ntfy 앱을 깔고 office.secrets.json 의 notify.ntfyTopic 을 구독하면 알림이 온다.
//   node tools/notify.mjs test                 # 시험 알림 보내기
//   import { notify } from "./notify.mjs"       # office.mjs·publish.mjs 가 쓴다
// 알림에는 제목과 번호만 넣는다(글 내용·고객 정보는 넣지 않는다). 주제 이름이 곧 비밀번호다 — 길고 짐작하기 어렵게.
import { loadSecrets } from "./secrets.mjs";
import { fileURLToPath } from "node:url";

/** @returns {Promise<{sent:boolean, reason?:string}>} 실패해도 던지지 않는다(알림 때문에 일이 멈추면 안 됨) */
export async function notify({ event, title, message, path = "", priority = 4, tags = [] }) {
  let s;
  try { s = loadSecrets().notify || {}; } catch (e) { return { sent: false, reason: e.message }; }
  if (!s.ntfyTopic) return { sent: false, reason: "알림 주제(notify.ntfyTopic)가 없음" };
  if (event && Array.isArray(s.events) && !s.events.includes(event)) return { sent: false, reason: "이 종류는 알림 끔: " + event };
  const server = String(s.ntfyServer || "https://ntfy.sh").replace(/\/+$/, "");
  // 한글 제목은 HTTP 헤더에 그대로 못 넣으므로, ntfy 가 받는 주소 뒤 쿼리(?title=…)로 보낸다
  const q = new URLSearchParams({ title: String(title || "").replace(/[\r\n]+/g, " ").slice(0, 120), priority: String(priority) });
  if (tags.length) q.set("tags", tags.join(","));
  if (s.officeUrl) q.set("click", String(s.officeUrl).replace(/\/+$/, "") + "/" + path);
  try {
    const r = await fetch(`${server}/${encodeURIComponent(s.ntfyTopic)}?${q}`, { method: "POST", body: message, signal: AbortSignal.timeout(8000) });
    return r.ok ? { sent: true } : { sent: false, reason: "알림 서버 응답 " + r.status };
  } catch (e) {
    return { sent: false, reason: "알림 서버에 닿지 못함: " + e.message };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] !== "test") { console.log("사용: node tools/notify.mjs test"); process.exit(0); }
  const r = await notify({ title: "AI 사무실 알림 시험", message: "이 알림이 보이면 연결된 것입니다.", tags: ["office"], priority: 3 });
  console.log(r.sent ? "보냈습니다. 휴대폰을 확인하세요." : "보내지 못했습니다: " + r.reason);
  process.exit(r.sent ? 0 : 1);
}
