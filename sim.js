/* 시연용 가짜 사무실. 브라우저(시연 모드)와 tools/mock-server.mjs 가 함께 쓴다.
 * 진짜 자료가 아니다 — 화면에는 반드시 '시연' 표시가 붙는다.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OfficeSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const MIN = 60000;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function createSim() {
    const now = () => Date.now();
    const iso = (t) => new Date(t).toISOString();
    const floors = [
      { id: "design", name: "디자인팀" },
      { id: "naver", name: "네이버 블로그팀" },
      { id: "insta", name: "인스타그램팀" },
      { id: "threads", name: "스레드팀" },
    ];
    let seq = 0, qseq = 0, paused = false, frozen = null, dayEnded = false;
    const mk = (floor, name, state, startedAgo, parentId = null, stateAgo = 0, role = null) => ({
      id: "s" + (++seq), name, floor, state, parentId, role,
      startedAt: iso(now() - startedAgo * MIN), stateSince: iso(now() - stateAgo * MIN),
    });
    const sessions = [
      mk("ceo", "본부장", "working", 15, null, 0, "director"),
      mk("design", "디자인 팀장", "working", 22, "s1", 0, "design-lead"),
      mk("design", "디자인 팀원", "working", 47, "s2", 0, "designer"),           // 40분 초과 → 땀
      mk("naver", "네이버 팀장", "working", 12, "s1", 0, "naver-lead"),
      mk("naver", "네이버 팀원", "reporting", 9, "s4", 0, "naver-blog-marketer"),  // 만세 + 별 (팀장에게 보고)
      mk("insta", "인스타 팀장", "blocked", 30, "s1", 7, "insta-lead"),          // 막힘
      mk("insta", "인스타 팀원", "idle", 20, "s6", 4, "instagram-marketer"),     // 커피
      mk("threads", "스레드 팀장", "idle", 40, "s1", 14, "threads-lead"),         // 졸음
    ];
    const card = (x, label, state) => {
      const fill = state === "done" ? "#efeaf2" : state === "now" ? "#ffffff" : "#f7f7f7";
      const dash = state === "todo" ? ' stroke-dasharray="6 5"' : "";
      return `<g><rect x="${x}" y="20" width="150" height="190" fill="${fill}" stroke="#221f26" stroke-width="2"${dash}/>` +
        `<text x="${x + 75}" y="230" text-anchor="middle" font-size="14" fill="#221f26">${label}</text>` +
        (state === "done" ? `<rect x="${x + 20}" y="50" width="110" height="14" fill="#c9bfd0"/><rect x="${x + 20}" y="74" width="80" height="10" fill="#d9d2de"/>` : "") +
        (state === "now" ? `<rect x="${x + 20}" y="50" width="110" height="18" fill="#3e6fd8"/><rect x="${x + 20}" y="80" width="110" height="60" fill="none" stroke="#9a949e" stroke-dasharray="4 4"/>` : "") + "</g>";
    };
    // 안마다 예시 그림: 3번 카드를 그 안대로 그린 작은 목업
    const optCard = (titleColor, chipColor) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" font-family="sans-serif"><rect width="400" height="500" fill="#F5F5F4"/>` +
      `<text x="32" y="80" font-size="34" font-weight="700" fill="${titleColor}">3 고르는 법</text>` +
      `<text x="32" y="122" font-size="18" fill="#6B6670">같은 계열 안에서 명도·채도로</text>` +
      `<rect x="32" y="170" width="150" height="150" fill="${chipColor}"/><rect x="218" y="170" width="150" height="150" fill="#E6E4E7"/>` +
      `<text x="107" y="350" font-size="16" text-anchor="middle" fill="#221F26">고객 색</text><text x="293" y="350" font-size="16" text-anchor="middle" fill="#221F26">비교 색</text>` +
      `<text x="32" y="450" font-size="14" fill="#6B6670">RIAN</text></svg>`);
    const DEMO_SVG = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 250" font-family="sans-serif"><rect width="680" height="250" fill="#fafafa"/>` +
      card(10, "1 표지", "done") + card(180, "2 원인", "done") + card(350, "3 고르는 법", "now") + card(520, "4 예약 안내", "todo") + "</svg>");
    const questions = [
      { id: "q" + (++qseq), sessionId: "s6", from: "인스타 팀원", text: "브랜드 해시태그를 새로 만들까요, 기존 것을 쓸까요?", askedAt: iso(now() - 12 * MIN) },
      {
        id: "q" + (++qseq), sessionId: "s2", from: "디자인 팀원", text: "3번 카드 제목 색을 어떻게 할까요?", askedAt: iso(now() - 4 * MIN),
        progress: { done: ["1 표지", "2 원인"], todo: ["3 고르는 법", "4 예약 안내"] },
        visual: { src: DEMO_SVG, title: "카드뉴스 시안 · 3번 카드 작업 중", pins: [{ key: "A", x: 63, y: 20 }, { key: "B", x: 63, y: 50 }] },
        options: [
          { key: "A", label: "제목을 파랑으로", where: "3번 카드 맨 위 제목 줄", image: optCard("#3e6fd8", "#c9bfd0") },
          { key: "B", label: "제목은 검정, 비교 칩만 색", where: "3번 카드 가운데 칩 자리", image: optCard("#221f26", "#3e6fd8") },
        ],
      },
    ];
    // 시연용 결재: 실제 파일 대신 내용을 함께 들고 있다
    const approvals = [{
      id: "a1", sessionId: "s1", from: "본부장", status: "pending", submittedAt: iso(now() - 6 * MIN),
      title: "가을 립 톤 — 인스타 피드 원고 + 카드뉴스 시안 설계",
      files: ["work/demo/instagram.md", "work/demo/design.md"],
      preview: {
        "work/demo/instagram.md": "사용한 스킬: rian-brand, marketing:content-creation, brand-voice:brand-voice-enforcement, design:ux-copy\n브랜드 검사: 오류 0 / 경고 0\n\n# 인스타그램 피드\n\n## 첫 줄\n같은 코랄인데 왜 나만 얼굴이 칙칙해 보일까요?\n\n## 본문\n원인은 색 이름이 아니라 명도와 채도 차이예요. 리안 퍼스널컬러&메이크업에서는 진단 결과에 맞춰 같은 계열 안에서 고르는 법을 알려 드려요.\n\n나중에 립 고를 때 보려면 저장해 두세요.\n\n#서면퍼스널컬러 #부산퍼스널컬러 #퍼스널컬러진단 #메이크업컨설팅\n\n| 메뉴 | 총액 | 예약금 |\n| --- | --- | --- |\n| 퍼스널컬러 진단 1인 | 70,000원 | 20,000원 |",
        "work/demo/design.md": "사용한 스킬: rian-brand, design:design-critique, design:accessibility-review\n브랜드 검사: 오류 0 / 경고 0\n\n# 카드뉴스 4장 (1080×1350)\n\n1. **표지** — Mist Light 배경, 국문 헤드 Hahmlet Light 88px, Tourmaline 은 쓰지 않음\n2. **원인** — Raw 배경, 명도·채도 비교 칩 2개(고객 색 칩만 유채색)\n3. **고르는 법** — Raw 배경, 목록 기호는 Tourmaline 마름모 (이 장의 Tourmaline 한 곳)\n4. **예약 안내** — '예약 · 네이버 플레이스' 만 Tourmaline, RIAN 워드마크 좌상단\n\nFigma 미연결 – 설계서만 작성",
      },
    }];
    // 시연용: 이미 승인돼 '게시 대기'인 결재 (실제로 올리지 않는다)
    approvals.push({
      id: "a2", sessionId: "s1", from: "본부장", status: "approved", submittedAt: iso(now() - 40 * MIN), decidedAt: iso(now() - 30 * MIN),
      title: "진단 결과로 립 고르기 — 인스타그램·스레드 게시본",
      files: ["work/demo/post-instagram.json", "work/demo/post-threads.json"],
      preview: {
        "work/demo/post-instagram.json": JSON.stringify({ ad: false, caption: "같은 코랄인데 왜 나만 칙칙해 보일까요?\n\n원인은 색 이름이 아니라 명도와 채도 차이예요.\n\n#서면퍼스널컬러 #부산퍼스널컬러 #퍼스널컬러진단", images: ["work/demo/card-1.jpg", "work/demo/card-2.jpg"] }),
        "work/demo/post-threads.json": JSON.stringify({ ad: false, posts: ["같은 코랄 립인데 사람마다 달라 보이는 이유, 명도와 채도예요. 진단에서는 같은 계열 안에서 고르는 법을 알려 드려요."], topicTag: "퍼스널컬러" }),
      },
      published: {},
    });
    const timers = [];
    const later = (ms, fn) => timers.push({ at: now() + ms, fn });
    const SUB = { design: ["카드뉴스 시안", "배너 수정"], naver: ["본문 초안", "태그 정리"], insta: ["캡션 작성", "해시태그 조사"], threads: ["타래 초안", "댓글 답변안"] };

    function spawn() {
      const parents = sessions.filter((s) => s.role && /-lead$/.test(s.role));
      if (!parents.length) return;
      const p = pick(parents);
      const s = mk(p.floor, pick(SUB[p.floor]), "working", 0, p.id);
      sessions.push(s);
      later(20000 + Math.random() * 20000, () => { s.state = "reporting"; s.stateSince = iso(now()); });
    }
    function ask() {
      const s = pick(sessions.filter((x) => x.floor !== "ceo"));
      const q = { id: "q" + (++qseq), sessionId: s.id, from: s.name, text: pick(["이 문구로 올려도 될까요?", "어느 시안이 좋으세요?", "올리는 시간은 언제가 좋을까요?", "가격을 글에 넣어도 될까요?"]), askedAt: iso(now()) };
      questions.push(q);
      later(25000 + Math.random() * 35000, () => { const i = questions.indexOf(q); if (i >= 0) questions.splice(i, 1); });
    }
    function tick() {
      if (paused) return;
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= now()) { timers[i].fn(); timers.splice(i, 1); }
      for (let i = sessions.length - 1; i >= 0; i--) {
        const s = sessions[i];
        if (s.parentId && !s.role && s.state === "reporting" && now() - Date.parse(s.stateSince) > 4000) sessions.splice(i, 1);
      }
      if (Math.random() < 0.06 && sessions.filter((s) => s.parentId && !s.role).length < 6) spawn();
      if (Math.random() < 0.03 && questions.length < 6) ask();
      if (Math.random() < 0.04) {
        const s = pick(sessions.filter((x) => x.role && /-lead$/.test(x.role)));
        const next = pick(["working", "working", "idle", "reporting", "blocked"]);
        if (s && s.state !== next) { s.state = next; s.stateSince = iso(now()); }
      }
    }
    const snapshot = () => (paused ? frozen : JSON.parse(JSON.stringify({ demo: true, canAnswer: true, canApprove: true, canSendTask: true, canPublish: { instagram: true, threads: true }, updatedAt: iso(now()), dayEnded, floors, sessions, questions, approvals })));
    return {
      tick, snapshot, spawn, ask,
      setPaused(v) { paused = v; frozen = v ? JSON.parse(JSON.stringify({ demo: true, canAnswer: true, canApprove: true, canSendTask: true, canPublish: { instagram: true, threads: true }, updatedAt: iso(now()), dayEnded, floors, sessions, questions, approvals })) : null; },
      setDayEnded(v) { dayEnded = v; },
      decide(id, decision, note) { const a = approvals.find((x) => x.id === id); if (a && a.status === "pending") { a.status = decision === "approve" ? "approved" : "revise"; a.decisionNote = note || ""; a.decidedAt = iso(now()); } },
      publish(id, ch) { const a = approvals.find((x) => x.id === id); if (a && a.status === "approved") { a.published = a.published || {}; a.published[ch] = { status: "publishing", at: iso(now()) }; later(4000, () => { a.published[ch] = { status: "done", at: iso(now()), url: "" }; }); } },
      answer(id) { const i = questions.findIndex((q) => q.id === id); if (i >= 0) questions.splice(i, 1); },
      get paused() { return paused; }, get dayEnded() { return dayEnded; },
    };
  }
  return { createSim };
});
