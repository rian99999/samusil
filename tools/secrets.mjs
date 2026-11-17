// office.secrets.json 읽기 (토큰·알림 주소). 파일이 없으면 빈 설정. 값은 절대 출력하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SECRETS_PATH = process.env.OFFICE_SECRETS || path.join(ROOT, "office.secrets.json");

export function loadSecrets() {
  try { return JSON.parse(fs.readFileSync(SECRETS_PATH, "utf8")) || {}; }
  catch (e) {
    if (e.code === "ENOENT") return {};
    throw new Error("office.secrets.json 을 읽지 못했습니다: " + e.message);
  }
}
// 화면에 알려도 되는 것: 무엇이 설정됐는지(예/아니오)만
export function publicSetup(s = loadSecrets()) {
  const ok = (c) => !!(c && c.userId && c.accessToken);
  return { instagram: ok(s.instagram), threads: ok(s.threads), notify: !!(s.notify && s.notify.ntfyTopic) };
}
