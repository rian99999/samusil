/* AI 사무실 – 상태 JSON 을 1초마다 읽어 사무실 그림 위 사람들의 몸짓을 바꾼다.
 * 데이터 형식은 README.md 참고.
 */
(() => {
  "use strict";

  // ------------------------------------------------------------ 설정
  const qs = new URLSearchParams(location.search);
  const num = (k, d) => (qs.has(k) && !isNaN(+qs.get(k)) ? +qs.get(k) : d);
  const CFG = {
    src: qs.get("src") || "status.json",
    pollMs: num("poll", 1000),        // 1초마다 읽기
    staleMs: num("stale", 5000),      // 5초 넘게 갱신 없으면 '확인 중'
    longTaskMin: num("long", 40),     // 40분 넘으면 땀방울
    dozeMin: num("doze", 10),         // 대기 10분 넘으면 졸음
    queueSweatMin: num("qsweat", 3),  // 질문 3분 넘게 기다리면 땀
    queueSquatMin: num("qsquat", 10), // 10분 넘으면 쪼그려 앉음
    walkSpeed: 2.4,                   // 타일/초
    bubbleMs: 2600,
    lightStepMs: 700,                 // 층마다 불 꺼지는 간격
  };

  // 스프라이트 4x3 – tools/make_assets.py 의 SHEET 와 같은 순서
  const FRAMES = {
    walk: { f: [0, 1, 2, 3], fps: 8 },
    type: { f: [4, 5], fps: 5 },
    cheer: { f: [6, 7], fps: 3 },
    stand: { f: [8], fps: 1 },
    doze: { f: [9], fps: 1 },
    squat: { f: [10, 11], fps: 1.2 },
  };
  const COLORS = ["#4a7bd0", "#d9534f", "#3aa76d", "#e0a526", "#8e5bd0", "#2aa3b8", "#d0679b", "#6d7a8a"];
  // 3D 캐릭터 6가지 (assets/chars/c0~c5.png, tools/char3d/render.mjs 의 AVATARS 와 같은 순서)
  const AVATARS = ["남 · 짧은 머리", "여 · 긴 머리", "남 · 안경", "여 · 단발", "남 · 곱슬머리", "여 · 묶은 머리"];
  const charUrl = (n) => `assets/chars/c${n}.png`;
  // 직책별 기본 이름·모습. 자료(status.json)의 roles 가 있으면 그것이 먼저, 이 브라우저에서 고친 값이 가장 먼저.
  const DEFAULT_ROLES = {
    "chief-reviewer": { name: "총괄 실장", person: "서윤", avatar: 1 },
    "designer": { name: "디자이너", person: "도윤", avatar: 2 },
    "naver-blog-marketer": { name: "네이버 담당", person: "지우", avatar: 3 },
    "instagram-marketer": { name: "인스타 담당", person: "하린", avatar: 5 },
    "threads-marketer": { name: "스레드 담당", person: "민준", avatar: 4 },
  };
  const ROSTER_KEY = "office-roster";
  let rosterLocal = {};
  try { rosterLocal = JSON.parse(localStorage.getItem(ROSTER_KEY) || "{}") || {}; } catch (_) {}
  const clampAvatar = (n) => (Number.isInteger(+n) && +n >= 0 && +n < AVATARS.length ? +n : 0);
  function roleKeys() { return [...new Set([...Object.keys(DEFAULT_ROLES), ...Object.keys((data && data.roles) || {})])]; }
  function roleInfo(role) {
    const base = (data && data.roles && data.roles[role]) || DEFAULT_ROLES[role];
    if (!base) return null;
    const loc = rosterLocal[role] || {};
    return { role, title: base.name || role, person: (loc.person ?? base.person ?? "").trim(), avatar: clampAvatar(loc.avatar ?? base.avatar ?? 0) };
  }
  // 세션 → 화면에 보일 이름·모습
  function who(sess, fallbackKey) {
    const r = sess && sess.role ? roleInfo(sess.role) : null;
    if (r) return { label: r.person || r.title, title: r.title, avatar: r.avatar, role: r.role };
    const k = sess ? sess.id : fallbackKey;
    return { label: sess ? (sess.name || sess.id) : "질문", title: null, avatar: Math.abs(hash(k)) % AVATARS.length, role: null };
  }

  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const ms = (t) => { const v = Date.parse(t); return isNaN(v) ? null : v; };
  const fmtMin = (m) => (m < 60 ? `${Math.floor(m)}분` : `${Math.floor(m / 60)}시간 ${Math.floor(m % 60)}분`);

  // ------------------------------------------------------------ 상태
  let L = null;                 // layout.json
  let floors = [];              // 아래(로비)→위(대표실)
  let floorKey = "";            // 층 구성이 바뀌었는지 판별
  let current = 0;              // 보고 있는 층 index
  let data = null;              // 마지막 상태 JSON
  let lastStamp = null;         // 마지막 updatedAt 값
  let lastFreshAt = 0;          // 새 updatedAt 을 받은 시각(브라우저 시계)
  let firstSnapshot = true;     // 첫 화면은 걸어 들어오는 연출 없이 자리에 바로 둔다
  let stale = true;
  let dayEnded = null;
  let lightTimers = [];

  // ------------------------------------------------------------ 좌표
  function toScreen(x, y) {
    const sx = L.origin.x + (x - y) * L.tile.w / 2;
    const sy = L.origin.y + (x + y) * L.tile.h / 2;
    return { left: (sx / L.image.width) * 100, top: (sy / L.image.height) * 100 };
  }
  const seatPos = (i) => L.seats[i];
  const queuePos = (i) => ({ x: L.queue.x, y: L.queue.y0 + i * L.queue.step });
  const elevator = () => ({ x: L.elevator.x, y: L.elevator.y });
  const frontAisleY = () => L.grid.y - 1.0;

  // 엘리베이터 → 자리 경로 (책상을 피해 통로로)
  function pathIn(target, kind) {
    const e = elevator();
    const ax = L.aisleX;
    if (kind === "queue") {
      const fy = frontAisleY();
      return [{ x: ax, y: e.y }, { x: ax, y: fy }, { x: target.x, y: fy }, target];
    }
    return [{ x: ax, y: e.y }, { x: ax, y: target.y }, target];
  }
  function pathOut(from, kind) {
    const e = elevator();
    const ax = L.aisleX;
    if (kind === "queue") {
      const fy = frontAisleY();
      return [{ x: from.x, y: fy }, { x: ax, y: fy }, { x: ax, y: e.y }, e];
    }
    return [{ x: ax, y: from.y }, { x: ax, y: e.y }, e];
  }

  // ------------------------------------------------------------ 층 만들기
  function buildFloors(teamFloors) {
    const list = [{ id: "__lobby", name: "로비 (전체)", kind: "lobby" }]
      .concat(teamFloors.map((f) => ({ id: String(f.id), name: f.name || String(f.id), kind: "team" })))
      .concat([{ id: "ceo", name: "대표실", kind: "ceo" }]);
    const key = list.map((f) => f.id + ":" + f.name).join("|");
    if (key === floorKey) return;
    floorKey = key;
    firstSnapshot = true; // 층 구성이 바뀌어 다시 그릴 때는 출근 연출 없이 자리에 둔다

    const prevId = floors[current] && floors[current].id;
    const stack = $("#stack");
    stack.textContent = "";
    $("#buttons").textContent = "";
    floors = list.map((f, i) => {
      const no = i + 1;
      const root = el("article", "floor");
      root.dataset.id = f.id;
      const head = el("div", "floor-head");
      const title = el("div", "title");
      title.append(el("span", "nm", f.name), el("span", "sub",
        f.kind === "lobby" ? "모든 세션이 모이는 곳" : f.kind === "ceo" ? "질문은 문 앞에 줄을 섭니다" : "이 팀의 작업 세션"));
      head.append(el("span", "badge", `${no}F`), title);
      const chips = el("div", "chips");
      head.append(chips);
      const room = el("div", "room");
      if (f.kind === "ceo") {
        const sign = el("div", "door-sign", "대표실");
        const p = toScreen(L.door.x, L.door.y);
        sign.style.left = p.left + "%";
        sign.style.top = (p.top - 21) + "%";
        room.append(sign);
      }
      const night = el("div", "night");
      const mask = el("div", "checking-mask");
      mask.append(el("span", null, "확인 중 – 움직임 정지"));
      room.append(night, mask);
      const scroller = el("div", "room-scroll"); // 휴대폰에서는 사무실을 크게 놓고 좌우로 밀어서 본다
      scroller.append(room);
      root.append(head, scroller);
      stack.prepend(root); // 위층이 위에 오도록

      const li = el("li");
      const b = el("button");
      b.type = "button";
      const lamp = el("span", "lamp");
      const cnt = el("span", "cnt");
      b.append(el("span", "no", String(no)), el("span", "nm", f.name), cnt, lamp);
      b.setAttribute("aria-label", `${no}층 ${f.name}`);
      b.addEventListener("click", () => goTo(i));
      li.style.setProperty("--o", no); // 휴대폰 가로 줄에서는 1층부터 왼쪽→오른쪽
      li.append(b);
      $("#buttons").prepend(li);

      return { ...f, no, root, room, chips, btn: b, lamp, cnt, actors: new Map(), seats: new Map() };
    });
    const idx = floors.findIndex((f) => f.id === prevId);
    goTo(idx >= 0 ? idx : Math.min(current, floors.length - 1), true);
    dayEnded = null; // 불 상태 다시 적용
    requestAnimationFrame(centerRooms);
  }

  // 휴대폰: 넓은 사무실 그림의 가운데부터 보이게
  const narrow = () => window.matchMedia("(max-width: 760px)").matches;
  function centerRooms() {
    for (const f of floors) {
      const sc = f.root.querySelector(".room-scroll");
      if (sc && !sc.dataset.touched) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
      if (sc && !sc.dataset.bound) {
        sc.dataset.bound = "1";
        sc.addEventListener("pointerdown", () => (sc.dataset.touched = "1"), { passive: true });
      }
    }
  }
  window.addEventListener("resize", () => requestAnimationFrame(centerRooms));

  function goTo(i, instant) {
    i = Math.max(0, Math.min(floors.length - 1, i));
    const from = current;
    current = i;
    const n = floors.length;
    const stack = $("#stack");
    // stack 안에서 위층이 먼저 나오므로 index 를 뒤집는다
    const pos = n - 1 - i;
    if (instant) stack.style.transition = "none";
    stack.style.transform = `translateY(${(-100 * pos) / n}%)`;
    if (instant) { void stack.offsetHeight; stack.style.transition = ""; }
    floors.forEach((f, k) => f.btn.setAttribute("aria-current", k === i ? "true" : "false"));
    $("#floorNo").textContent = floors[i].no;
    const dir = $("#dir");
    dir.textContent = instant || from === i ? "" : i > from ? "▲" : "▼";
    clearTimeout(goTo.t);
    goTo.t = setTimeout(() => (dir.textContent = ""), 900);
    try { history.replaceState(null, "", `#${encodeURIComponent(floors[i].id)}`); } catch (_) {}
    if (narrow()) {
      // 가로 층 줄에서 고른 층 버튼이 화면 안에 오도록 (페이지는 위아래로 움직이지 않음)
      const strip = $("#buttons"), btn = floors[i].btn;
      const left = btn.offsetLeft - (strip.clientWidth - btn.offsetWidth) / 2;
      try { strip.scrollTo({ left, behavior: instant ? "auto" : "smooth" }); } catch (_) { strip.scrollLeft = left; }
    }
  }

  document.addEventListener("keydown", (e) => {
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "ArrowUp" || e.key === "PageUp") { goTo(current + 1); e.preventDefault(); }
    if (e.key === "ArrowDown" || e.key === "PageDown") { goTo(current - 1); e.preventDefault(); }
  });

  // ------------------------------------------------------------ 사람(Actor)
  function setAvatar(a, n) {
    if (a.avatar === n) return;
    a.avatar = n;
    a.sprite.style.backgroundImage = `url("${charUrl(n)}")`;
  }
  function makeActor(floor, key, kind, label, color) {
    const root = el("div", "person");
    const sprite = el("div", "sprite");
    const fx = el("div", "fxwrap");
    const tag = el("div", "tag", label);
    tag.style.setProperty("--c", color);
    root.append(sprite, fx, tag);
    root.tabIndex = 0;
    root.setAttribute("role", "button");
    const open = () => showInfo(root);
    root.addEventListener("click", open); // 휴대폰은 마우스 올리기가 없으므로 눌러서 본다
    root.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    floor.room.append(root);
    return {
      key, kind, floor, root, sprite, fx, tag,
      x: 0, y: 0, path: [], leaving: false, pose: "stand", fxKey: "",
      frameT: Math.random() * 10, bubble: null, bubbleUntil: 0, info: null,
    };
  }

  function say(a, text, now) {
    if (a.bubble) a.bubble.remove();
    a.bubble = el("div", "bubble", text);
    a.root.append(a.bubble);
    a.bubbleUntil = now + CFG.bubbleMs;
  }

  function place(a, p) {
    a.x = p.x; a.y = p.y;
    const s = toScreen(p.x, p.y);
    a.root.style.left = s.left + "%";
    a.root.style.top = s.top + "%";
    a.root.style.zIndex = String(Math.round((p.x + p.y) * 10) + 100);
  }

  function setFx(a, key) {
    if (a.fxKey === key) return;
    a.fxKey = key;
    a.fx.textContent = "";
    const add = (cls, t) => { const s = el("span", "fx " + cls, t); s.setAttribute("aria-hidden", "true"); a.fx.append(s); };
    for (const k of key.split(" ").filter(Boolean)) {
      if (k === "sweat") add("sweat", "💧");
      if (k === "sweat2") add("sweat2", "💧");
      if (k === "star") add("star", "⭐");
      if (k === "coffee") add("coffee", "☕");
      if (k === "zzz") add("zzz", "💤");
      if (k === "ask") add("ask", "❓");
    }
  }

  // ------------------------------------------------------------ 몸짓 결정
  function sessionLook(s, nowSrv) {
    const started = ms(s.startedAt);
    const since = ms(s.stateSince) ?? started;
    const runMin = started != null ? (nowSrv - started) / 60000 : 0;
    const stateMin = since != null ? (nowSrv - since) / 60000 : 0;
    switch (s.state) {
      case "working":
        return runMin > CFG.longTaskMin
          ? { pose: "type", fx: "sweat", text: `작업 중 · ${fmtMin(runMin)} 경과(40분 초과)` }
          : { pose: "type", fx: "", text: `작업 중 · ${fmtMin(runMin)} 경과` };
      case "blocked":
        return { pose: "stand", fx: "sweat sweat2", text: `막힘 · ${fmtMin(stateMin)}째` };
      case "reporting":
        return { pose: "cheer", fx: "star", text: "결과 보고" };
      case "idle":
      default:
        return stateMin > CFG.dozeMin
          ? { pose: "doze", fx: "zzz", text: `대기 · ${fmtMin(stateMin)}째 (졸음)` }
          : { pose: "stand", fx: "coffee", text: `대기 · ${fmtMin(stateMin)}째` };
    }
  }
  function questionLook(q, nowSrv) {
    const t = ms(q.askedAt);
    const w = t != null ? (nowSrv - t) / 60000 : 0;
    if (w > CFG.queueSquatMin) return { pose: "squat", fx: "ask sweat sweat2", text: `질문 대기 ${fmtMin(w)}` };
    if (w > CFG.queueSweatMin) return { pose: "stand", fx: "ask sweat", text: `질문 대기 ${fmtMin(w)}` };
    return { pose: "stand", fx: "ask", text: `질문 대기 ${fmtMin(w)}` };
  }

  // ------------------------------------------------------------ 데이터 반영
  function sessionsFor(f, sessions) {
    if (f.kind === "lobby") return sessions;
    return sessions.filter((s) => String(s.floor) === f.id);
  }

  function apply(d) {
    const sessions = Array.isArray(d.sessions) ? d.sessions.filter((s) => s && s.id != null) : [];
    const questions = Array.isArray(d.questions) ? d.questions.filter((q) => q && q.id != null) : [];
    buildFloors(Array.isArray(d.floors) ? d.floors.filter((f) => f && f.id != null && f.id !== "ceo") : []);
    const nowSrv = ms(d.updatedAt);
    const now = performance.now();
    const byId = new Map(sessions.map((s) => [String(s.id), s]));

    for (const f of floors) {
      const want = new Map();
      // 세션 → 자리
      const list = sessionsFor(f, sessions);
      for (const [id, idx] of f.seats) if (!list.some((s) => String(s.id) === id)) f.seats.delete(id);
      const used = new Set(f.seats.values());
      let overflow = 0;
      for (const s of list) {
        const id = String(s.id);
        if (!f.seats.has(id)) {
          let i = 0;
          while (used.has(i)) i++;
          if (i >= L.seats.length) { overflow++; continue; }
          f.seats.set(id, i); used.add(i);
        }
        want.set("s:" + id, { kind: "seat", target: seatPos(f.seats.get(id)), s, look: sessionLook(s, nowSrv) });
      }
      // 질문 → 대표실 앞 줄
      if (f.kind === "ceo") {
        const qs2 = questions.slice().sort((a, b) => (ms(a.askedAt) ?? 0) - (ms(b.askedAt) ?? 0));
        qs2.forEach((q, i) => {
          if (i >= L.queue.max) { overflow++; return; }
          const from = byId.get(String(q.sessionId));
          want.set("q:" + q.id, { kind: "queue", target: queuePos(i), q, from, look: questionLook(q, nowSrv) });
        });
      }

      // 새로 온 사람 / 남아 있는 사람
      for (const [key, w] of want) {
        let a = f.actors.get(key);
        const sess = w.kind === "queue" ? w.from : w.s;
        const info = sess ? who(sess) : { label: w.q.from || "질문", title: null, avatar: Math.abs(hash(w.q.sessionId ?? w.q.id)) % AVATARS.length, role: null };
        const label = info.label;
        const colorKey = w.kind === "queue" ? (w.q.sessionId ?? w.q.id) : (w.s.parentId ?? w.s.id);
        if (!a) {
          a = makeActor(f, key, w.kind, label, COLORS[Math.abs(hash(colorKey)) % COLORS.length]);
          f.actors.set(key, a);
          if (firstSnapshot) {
            place(a, w.target);
          } else {
            place(a, elevator());
            a.path = pathIn(w.target, w.kind);
            say(a, w.kind === "queue" ? "질문 있습니다!" : "출근합니다!", now);
          }
        } else if (a.leaving) {
          // 나가던 중 다시 나타나면 되돌아온다
          a.leaving = false;
          a.root.classList.remove("leaving");
          a.path = pathIn(w.target, w.kind);
        } else if (!a.path.length && (Math.abs(a.x - w.target.x) > 0.01 || Math.abs(a.y - w.target.y) > 0.01)) {
          a.path = [w.target]; // 줄이 당겨지면 한 칸 앞으로
        } else if (a.path.length) {
          a.path[a.path.length - 1] = w.target;
        }
        a.tag.textContent = label;
        setAvatar(a, info.avatar);
        if (info.role) a.root.dataset.role = info.role; else delete a.root.dataset.role;
        a.look = w.look;
        const extra = w.kind === "queue"
          ? `\n질문: ${w.q.text || "(내용 없음)"}`
          : `\n층: ${w.s.floor ?? "-"}${w.s.parentId ? `\n상위 작업: ${w.s.parentId}` : ""}`;
        const roleLine = info.title && info.title !== label ? `\n역할: ${info.title}` : "";
        a.root.title = `${label}${roleLine}\n${w.look.text}${extra}`;
        a.root.setAttribute("aria-label", `${label}, ${w.look.text}`);
      }
      // 사라진 사람 → 퇴근
      for (const [key, a] of f.actors) {
        if (want.has(key) || a.leaving) continue;
        a.leaving = true;
        a.root.classList.add("leaving");
        a.path = pathOut({ x: a.x, y: a.y }, a.kind);
        a.look = { pose: "walk", fx: "", text: "" };
        say(a, a.kind === "queue" ? "답변 받았어요!" : "퇴근합니다!", now);
      }

      // 층 요약
      const c = { working: 0, blocked: 0, reporting: 0, idle: 0 };
      for (const s of list) c[s.state in c ? s.state : "idle"]++;
      f.chips.textContent = "";
      const chip = (t, cls) => { const s = el("span", cls, t); f.chips.append(s); };
      chip(`작업 ${c.working}`, "k-work"); chip(`막힘 ${c.blocked}`, "k-block");
      chip(`보고 ${c.reporting}`, "k-report"); chip(`대기 ${c.idle}`, "k-idle");
      if (f.kind === "ceo") chip(`질문 ${questions.length}`, "k-ask");
      if (overflow) chip(`자리 부족 +${overflow}명 (표시 안 됨)`, "overflow");
      f.cnt.textContent = f.kind === "ceo" ? `${list.length}명 · ❓${questions.length}` : `${list.length}명`;
    }
    firstSnapshot = false;

    // 하루 끝 → 방마다 차례로 불 끄기
    const ended = !!d.dayEnded;
    if (ended !== dayEnded) {
      dayEnded = ended;
      lightTimers.forEach(clearTimeout);
      lightTimers = [];
      // 맨 위층부터 아래로 차례로
      const order = floors.slice().reverse();
      order.forEach((f, k) => {
        lightTimers.push(setTimeout(() => {
          f.root.classList.toggle("dark", ended);
          f.lamp.classList.toggle("off", ended);
        }, k * CFG.lightStepMs));
      });
    }
  }

  // ------------------------------------------------------------ 애니메이션 루프
  let lastT = performance.now();
  function tick(t) {
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    if (!stale) {
      for (const f of floors) {
        for (const [key, a] of f.actors) {
          // 이동
          if (a.path.length) {
            let step = CFG.walkSpeed * dt;
            while (step > 0 && a.path.length) {
              const p = a.path[0];
              const dx = p.x - a.x, dy = p.y - a.y;
              const dist = Math.hypot(dx, dy);
              if (dist <= step) { place(a, p); a.path.shift(); step -= dist; }
              else { place(a, { x: a.x + (dx / dist) * step, y: a.y + (dy / dist) * step }); step = 0; }
            }
            if (!a.path.length && a.leaving) {
              a.root.classList.add("gone");
              f.actors.delete(key);
              setTimeout(() => a.root.remove(), 500);
              continue;
            }
          }
          // 몸짓
          const walking = a.path.length > 0;
          const look = a.look || { pose: "stand", fx: "" };
          const pose = walking ? "walk" : look.pose;
          setFx(a, walking ? "" : look.fx);
          a.frameT += dt;
          const F = FRAMES[pose] || FRAMES.stand;
          const fi = F.f[Math.floor(a.frameT * F.fps) % F.f.length];
          if (a.frame !== fi) {
            a.frame = fi;
            const col = fi % 4, row = Math.floor(fi / 4);
            a.sprite.style.backgroundPosition = `${(col / 3) * 100}% ${(row / 2) * 100}%`;
          }
          if (a.bubble && t > a.bubbleUntil) { a.bubble.remove(); a.bubble = null; }
        }
      }
    }
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------ 갱신 감시
  function setStale(v, reason) {
    if (v !== stale) {
      stale = v;
      document.body.classList.toggle("stale", v);
    }
    const st = $("#status");
    st.classList.toggle("checking", v);
    const txt = $("#statusText");
    const isDemo = !!(DEMO || (data && data.demo)); // 가짜 자료는 반드시 '시연'으로 표시
    document.body.classList.toggle("demo", isDemo);
    const tagDemo = isDemo ? "시연 자료 · " : "";
    if (v) txt.textContent = `${tagDemo}확인 중 · ${reason}`;
    else txt.textContent = `${tagDemo}${isDemo ? "" : "실시간 · "}${new Date(ms(data.updatedAt)).toLocaleTimeString("ko-KR")} 갱신`;
  }

  function watchdog() {
    if (!data) return setStale(true, "자료를 아직 받지 못함");
    const age = Date.now() - lastFreshAt;
    if (age > CFG.staleMs) setStale(true, `${Math.floor(age / 1000)}초째 갱신 없음`);
    else setStale(false);
  }

  const DEMO = (CFG.src === "demo" || window.OFFICE_DEMO) && window.OfficeSim ? window.OfficeSim.createSim() : null;
  if (DEMO) document.body.classList.add("demo");

  async function poll() {
    try {
      let d;
      if (DEMO) {
        // 시연 모드: 브라우저 안의 가짜 사무실(sim.js). 화면에 '시연 자료'라고 표시한다.
        DEMO.tick();
        d = DEMO.snapshot();
      } else {
        const r = await fetch(CFG.src + (CFG.src.includes("?") ? "&" : "?") + "_=" + Date.now(), { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        d = await r.json();
      }
      if (ms(d.updatedAt) == null) throw new Error("updatedAt 없음");
      // 같은 updatedAt 이 계속 오면 '갱신 안 됨'으로 본다
      if (d.updatedAt !== lastStamp) {
        lastStamp = d.updatedAt;
        lastFreshAt = Date.now();
        data = d;
        if (!L) return;
        apply(d);
      }
    } catch (e) {
      console.warn("상태 읽기 실패:", e.message);
    } finally {
      watchdog();
    }
  }

  // ------------------------------------------------------------ 시작
  async function start() {
    const want = decodeURIComponent(location.hash.slice(1)); // goTo 가 주소를 바꾸기 전에 읽는다
    L = await (await fetch("assets/layout.json", { cache: "no-store" })).json();
    buildFloors([]);
    // 통로(shaft)는 딱 한 층 높이만 보여 준다
    const fit = () => { const f = $("#stack").firstElementChild; if (f) $(".shaft").style.height = f.offsetHeight + "px"; };
    new ResizeObserver(fit).observe($("#stack"));
    fit();
    await poll();
    if (want) {
      const i = floors.findIndex((f) => f.id === want);
      if (i >= 0) goTo(i, true);
    }
    setInterval(poll, CFG.pollMs);
    setInterval(watchdog, 250);
    requestAnimationFrame(tick);
  }
  // ------------------------------------------------------------ 사람 상세 (눌러서 보기)
  function showInfo(root) {
    const lines = (root.title || "").split("\n");
    $("#infoName").textContent = lines[0] || "";
    const list = $("#infoList");
    list.textContent = "";
    for (const ln of lines.slice(1)) list.append(el("li", null, ln));
    if (root.dataset.role) {
      const mine = siteList().filter((x) => x.roles.includes("*") || x.roles.includes(root.dataset.role));
      if (mine.length) {
        const li = el("li", "info-sites");
        li.append(el("b", null, "연결된 사이트"));
        for (const x of mine) { const a = el("a", null, `${x.name} (${PURPOSES[x.purpose] || x.purpose})`); a.href = x.url; a.target = "_blank"; a.rel = "noopener"; li.append(a); }
        list.append(li);
      }
    }
    const btn = $("#infoRename");
    btn.hidden = !root.dataset.role;
    btn.dataset.role = root.dataset.role || "";
    const d = $("#info");
    if (!d.open) d.showModal();
  }
  $("#infoRename").addEventListener("click", (e) => { const r = e.currentTarget.dataset.role; $("#info").close(); openRoster(r); });

  // ------------------------------------------------------------ 사이트 연결
  // 직원마다 참고할 사이트를 묶어 둔다. 업무 지시서에 함께 들어가서 직원이 그 사이트를 읽고 쓴다.
  const SITES_KEY = "office-sites";
  const PURPOSES = { mine: "우리 채널", ref: "참고", rival: "경쟁사", etc: "기타" };
  const CHANNEL_ROLE = { "네이버 블로그": "naver-blog-marketer", "인스타그램": "instagram-marketer", "스레드": "threads-marketer", "디자인": "designer" };
  let sitesLocal = null;
  try { const v = JSON.parse(localStorage.getItem(SITES_KEY) || "null"); if (Array.isArray(v)) sitesLocal = v; } catch (_) {}
  const cleanSite = (x) => x && typeof x.url === "string" && /^https?:\/\//i.test(x.url)
    ? { id: String(x.id || x.url), name: String(x.name || x.url).slice(0, 40), url: x.url, purpose: PURPOSES[x.purpose] ? x.purpose : "ref",
        roles: Array.isArray(x.roles) && x.roles.length ? x.roles.map(String) : ["*"] }
    : null;
  // 이 브라우저에서 고친 목록이 있으면 그것, 없으면 설정 파일(status.json 의 sites)
  function siteList() { return (sitesLocal ?? ((data && data.sites) || [])).map(cleanSite).filter(Boolean); }
  function saveSites(list) { sitesLocal = list; try { localStorage.setItem(SITES_KEY, JSON.stringify(list)); } catch (_) {} }
  function roleName(role) { if (role === "*") return "모든 직원"; const r = roleInfo(role); return r ? (r.person ? `${r.person}(${r.title})` : r.title) : role; }
  function sitesForOrder(channels) {
    const roles = new Set(["chief-reviewer", ...channels.map((c) => CHANNEL_ROLE[c]).filter(Boolean)]);
    const pick = siteList().filter((x) => x.roles.includes("*") || x.roles.some((r) => roles.has(r)));
    if (!pick.length) return [];
    return ["참고 사이트:", ...pick.map((x) => {
      const who = x.roles.includes("*") ? "모든 직원" : x.roles.filter((r) => roles.has(r)).map((r) => (roleInfo(r) || { title: r }).title).join("·");
      return `- ${who}: ${x.name} ${x.url} [${PURPOSES[x.purpose]}]`;
    })];
  }
  const sitesDlg = $("#sites");
  function renderSites() {
    const list = $("#siteList");
    list.textContent = "";
    const items = siteList();
    $("#siteEmpty").hidden = items.length > 0;
    for (const x of items) {
      const li = el("li", "site-row");
      const top = el("div", "site-top");
      const a = el("a", "site-name", x.name); a.href = x.url; a.target = "_blank"; a.rel = "noopener";
      const chip = el("span", "site-purpose p-" + x.purpose, PURPOSES[x.purpose]);
      const del = el("button", "site-del", "삭제"); del.type = "button"; del.setAttribute("aria-label", x.name + " 삭제");
      del.addEventListener("click", () => { saveSites(siteList().filter((y) => y.id !== x.id)); renderSites(); $("#siteMsg").textContent = `'${x.name}'을(를) 뺐습니다.`; });
      top.append(a, chip, del);
      const url = el("div", "site-url", x.url);
      const who = el("div", "site-who", "연결: " + x.roles.map(roleName).join(", "));
      li.append(top, url, who);
      list.append(li);
    }
    // 직원 고르기 칸
    const box = $("#siteRoles");
    box.textContent = "";
    for (const role of ["*", ...roleKeys()]) {
      const lab = el("label", "check");
      const cb = el("input"); cb.type = "checkbox"; cb.name = "sr"; cb.value = role; cb.checked = role === "*";
      lab.append(cb, document.createTextNode(" " + roleName(role)));
      box.append(lab);
    }
  }
  function openSites() { renderSites(); $("#siteMsg").textContent = ""; $("#siteErr").textContent = ""; if (!sitesDlg.open) sitesDlg.showModal(); }
  document.querySelectorAll("[data-open-sites]").forEach((b) => b.addEventListener("click", () => {
    const parent = b.closest("dialog"); if (parent && parent !== sitesDlg) parent.close();
    openSites();
  }));
  $("#sitesClose").addEventListener("click", () => sitesDlg.close());
  $("#sitesDone").addEventListener("click", () => sitesDlg.close());
  $("#siteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $("#siteErr");
    let raw = $("#sUrl").value.trim();
    if (raw && !/^[a-z]+:\/\//i.test(raw)) raw = "https://" + raw; // 'naver.com' 처럼 적어도 됨
    let u;
    try { u = new URL(raw); } catch (_) { err.textContent = "주소가 올바르지 않습니다. 예: https://blog.naver.com/내아이디"; $("#sUrl").focus(); return; }
    if (!/^https?:$/.test(u.protocol)) { err.textContent = "http:// 또는 https:// 로 시작하는 주소만 됩니다."; return; }
    let roles = [...document.querySelectorAll("#siteRoles input:checked")].map((c) => c.value);
    if (!roles.length) { err.textContent = "연결할 직원을 한 명 이상 고르세요."; return; }
    if (roles.includes("*")) roles = ["*"];
    const item = { id: "site-" + Date.now().toString(36), name: $("#sName").value.trim() || u.hostname, url: u.href, purpose: $("#sPurpose").value, roles };
    saveSites([...siteList(), item]);
    $("#siteForm").reset();
    err.textContent = "";
    renderSites();
    $("#siteMsg").textContent = `'${item.name}'을(를) 연결했습니다. 다음 업무 지시서부터 함께 들어갑니다.`;
  });
  $("#siteCopy").addEventListener("click", async () => {
    const text = JSON.stringify(siteList().map(({ name, url, purpose, roles }) => ({ name, url, purpose, roles })), null, 2);
    try { await navigator.clipboard.writeText(text); $("#siteMsg").textContent = "복사했습니다. office.config.json 의 \"sites\" 에 넣으면 모든 기기에 적용됩니다."; }
    catch (_) { $("#siteMsg").textContent = "자동 복사가 막혀 있습니다: " + text.replace(/\s+/g, " "); }
  });

  // ------------------------------------------------------------ 직원 명부 (이름·모습 정하기)
  const roster = $("#roster");
  function saveRoster() {
    try { localStorage.setItem(ROSTER_KEY, JSON.stringify(rosterLocal)); } catch (_) {}
    if (data) apply(data); // 화면의 이름표·모습을 바로 바꾼다
  }
  function face(n, cls) {
    const i = el("i", "mini " + (cls || ""));
    i.style.setProperty("--c", 0); i.style.setProperty("--r", 2);
    i.style.backgroundImage = `url("${charUrl(n)}")`;
    i.setAttribute("aria-hidden", "true");
    return i;
  }
  function renderRoster(focusRole) {
    const list = $("#rosterList");
    list.textContent = "";
    for (const role of roleKeys()) {
      const r = roleInfo(role);
      const li = el("li", "ros-row");
      const big = face(r.avatar, "ros-face");
      const main = el("div", "ros-main");
      const lab = el("label", null, r.title);
      lab.htmlFor = "rn-" + role;
      const inp = el("input");
      inp.id = "rn-" + role; inp.value = r.person; inp.maxLength = 12; inp.placeholder = r.title; inp.autocomplete = "off";
      inp.addEventListener("input", () => { (rosterLocal[role] ||= {}).person = inp.value; saveRoster(); });
      const group = el("div", "ros-avatars");
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-label", r.title + " 모습");
      AVATARS.forEach((lbl, n) => {
        const b = el("button", "ros-pick");
        b.type = "button";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(n === r.avatar));
        b.setAttribute("aria-label", lbl);
        b.title = lbl;
        b.append(face(n));
        b.addEventListener("click", () => {
          (rosterLocal[role] ||= {}).avatar = n;
          group.querySelectorAll(".ros-pick").forEach((x, k) => x.setAttribute("aria-checked", String(k === n)));
          big.style.backgroundImage = `url("${charUrl(n)}")`;
          saveRoster();
        });
        group.append(b);
      });
      main.append(lab, inp, group);
      li.append(big, main);
      list.append(li);
      if (role === focusRole) requestAnimationFrame(() => { inp.focus(); inp.select(); });
    }
  }
  function openRoster(focusRole) {
    renderRoster(focusRole);
    $("#rosterMsg").textContent = "";
    if (!roster.open) roster.showModal();
  }
  $("#rosterBtn").addEventListener("click", () => openRoster());
  $("#rosterClose").addEventListener("click", () => roster.close());
  $("#rosterDone").addEventListener("click", () => roster.close());
  $("#rosterReset").addEventListener("click", () => { rosterLocal = {}; saveRoster(); renderRoster(); $("#rosterMsg").textContent = "기본값으로 되돌렸습니다."; });
  $("#rosterCopy").addEventListener("click", async () => {
    // 다른 기기에서도 같게 보이도록 office.config.json 의 roles 에 붙여 넣을 내용
    const out = {};
    for (const role of roleKeys()) { const r = roleInfo(role); out[role] = { person: r.person, avatar: r.avatar }; }
    const text = JSON.stringify(out, null, 2);
    try { await navigator.clipboard.writeText(text); $("#rosterMsg").textContent = "복사했습니다. office.config.json 의 roles 에 person·avatar 로 넣으면 모든 기기에 적용됩니다."; }
    catch (_) { $("#rosterMsg").textContent = "자동 복사가 막혀 있습니다: " + text.replace(/\s+/g, " "); }
  });
  $("#infoClose").addEventListener("click", () => $("#info").close());
  $("#info").addEventListener("click", (e) => { if (e.target.id === "info") e.target.close(); });

  // ------------------------------------------------------------ 업무 맡기기 (지시서 만들기 → 복사)
  const task = $("#task"), form = $("#taskForm");
  const DRAFT = "office-task-draft";
  const FIELDS = ["tTopic", "tTarget", "tMessage", "tFacts", "tBan"];
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || "{}");
      for (const id of FIELDS) if (d[id] != null) $("#" + id).value = d[id];
      if (Array.isArray(d.ch)) form.querySelectorAll("input[name=ch]").forEach((c) => (c.checked = d.ch.includes(c.value)));
    } catch (_) {}
  }
  function saveDraft() {
    const d = { ch: [...form.querySelectorAll("input[name=ch]:checked")].map((c) => c.value) };
    for (const id of FIELDS) d[id] = $("#" + id).value;
    try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch (_) {}
  }
  function openTask() {
    loadDraft();
    task.classList.remove("done");
    $("#copyMsg").textContent = "";
    if (!task.open) task.showModal();
  }
  document.querySelectorAll("[data-open-task]").forEach((b) => b.addEventListener("click", openTask));
  $("#taskClose").addEventListener("click", () => task.close());
  $("#taskBack").addEventListener("click", () => task.classList.remove("done"));
  form.addEventListener("input", saveDraft);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ch = [...form.querySelectorAll("input[name=ch]:checked")].map((c) => c.value);
    if (!$("#tTopic").value.trim()) { $("#topicErr").hidden = false; $("#tTopic").focus(); return; }
    $("#topicErr").hidden = true;
    if (!ch.length) { $("#chErr").hidden = false; return; }
    $("#chErr").hidden = true;
    const v = (id) => $("#" + id).value.trim() || "(없음)";
    const text = [
      "/office-run",
      "[업무 지시서]",
      `주제: ${$("#tTopic").value.trim()}`,
      `대상 고객: ${v("tTarget")}`,
      `핵심 메시지: ${v("tMessage")}`,
      `사실 자료: ${v("tFacts")}`,
      `금지할 것: ${v("tBan")}`,
      `채널: ${ch.join(", ")}`,
      ...sitesForOrder(ch),
    ].join("\n");
    $("#taskOut").value = text;
    task.classList.add("done");
    saveDraft();
  });
  $("#copyBtn").addEventListener("click", async () => {
    const out = $("#taskOut");
    try {
      await navigator.clipboard.writeText(out.value);
      $("#copyMsg").textContent = "복사했습니다. Claude 앱 대화창에 붙여넣고 보내세요.";
    } catch (_) {
      out.focus(); out.select();
      $("#copyMsg").textContent = "자동 복사가 막혀 있어 글을 선택해 두었습니다. 길게 눌러 '복사'를 고르세요.";
    }
  });

  // ------------------------------------------------------------ 사용설명서 창
  const help = $("#help");
  const openHelp = () => { if (!help.open) help.showModal(); };
  $("#helpBtn").addEventListener("click", openHelp);
  $("#helpClose").addEventListener("click", () => help.close());
  $("#helpOk").addEventListener("click", () => help.close());
  help.addEventListener("click", (e) => { if (e.target === help) help.close(); }); // 바깥 누르면 닫힘
  help.addEventListener("close", () => { try { localStorage.setItem("office-help-seen", "1"); } catch (_) {} });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, select")) return; // 글 쓰는 중에는 무시
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "?" || e.key === "F1") { openHelp(); e.preventDefault(); }
  });
  let seen = false;
  try { seen = localStorage.getItem("office-help-seen") === "1"; } catch (_) {}
  if (!seen || qs.has("help")) openHelp(); // 처음 온 사람에게는 자동으로 띄움

  start().catch((e) => {
    $("#statusText").textContent = "확인 중 · 시작 실패: " + e.message;
    $("#status").classList.add("checking");
  });
})();
