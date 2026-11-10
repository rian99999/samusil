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
      mk("ceo", "총괄 실장", "working", 15, null, 0, "chief-reviewer"),
      mk("design", "디자이너", "working", 22, null, 0, "designer"),
      mk("design", "썸네일 시안", "working", 47, "s2"),        // 40분 초과 → 땀
      mk("naver", "네이버 담당", "working", 12, null, 0, "naver-blog-marketer"),
      mk("naver", "키워드 조사", "reporting", 9, "s4"),         // 만세 + 별
      mk("insta", "인스타 담당", "blocked", 30, null, 7, "instagram-marketer"),       // 막힘
      mk("insta", "릴스 대본", "idle", 20, "s6", 4),            // 커피
      mk("threads", "스레드 담당", "idle", 40, null, 14, "threads-marketer"),       // 졸음
    ];
    const questions = [
      { id: "q" + (++qseq), sessionId: "s6", from: "인스타 담당", text: "브랜드 해시태그를 새로 만들까요, 기존 것을 쓸까요?", askedAt: iso(now() - 12 * MIN) },
      { id: "q" + (++qseq), sessionId: "s2", from: "디자이너", text: "메인 색을 파랑으로 확정해도 될까요?", askedAt: iso(now() - 4 * MIN) },
    ];
    const timers = [];
    const later = (ms, fn) => timers.push({ at: now() + ms, fn });
    const SUB = { design: ["카드뉴스 시안", "배너 수정"], naver: ["본문 초안", "태그 정리"], insta: ["캡션 작성", "해시태그 조사"], threads: ["타래 초안", "댓글 답변안"] };

    function spawn() {
      const parents = sessions.filter((s) => !s.parentId && s.floor !== "ceo");
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
        if (s.parentId && s.state === "reporting" && now() - Date.parse(s.stateSince) > 4000) sessions.splice(i, 1);
      }
      if (Math.random() < 0.06 && sessions.filter((s) => s.parentId).length < 6) spawn();
      if (Math.random() < 0.03 && questions.length < 6) ask();
      if (Math.random() < 0.04) {
        const s = pick(sessions.filter((x) => !x.parentId && x.floor !== "ceo"));
        const next = pick(["working", "working", "idle", "reporting", "blocked"]);
        if (s && s.state !== next) { s.state = next; s.stateSince = iso(now()); }
      }
    }
    const snapshot = () => (paused ? frozen : JSON.parse(JSON.stringify({ demo: true, updatedAt: iso(now()), dayEnded, floors, sessions, questions })));
    return {
      tick, snapshot, spawn, ask,
      setPaused(v) { paused = v; frozen = v ? JSON.parse(JSON.stringify({ demo: true, updatedAt: iso(now()), dayEnded, floors, sessions, questions })) : null; },
      setDayEnded(v) { dayEnded = v; },
      get paused() { return paused; }, get dayEnded() { return dayEnded; },
    };
  }
  return { createSim };
});
