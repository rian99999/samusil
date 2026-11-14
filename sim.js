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
    // 시연용 결재: 실제 파일 대신 내용을 함께 들고 있다
    const approvals = [{
      id: "a1", sessionId: "s1", from: "총괄 실장", status: "pending", submittedAt: iso(now() - 6 * MIN),
      title: "가을 립 톤 — 인스타 피드 원고 + 카드뉴스 시안 설계",
      files: ["work/demo/instagram.md", "work/demo/design.md"],
      preview: {
        "work/demo/instagram.md": "사용한 스킬: rian-brand, marketing:content-creation, brand-voice:brand-voice-enforcement, design:ux-copy\n브랜드 검사: 오류 0 / 경고 0\n\n# 인스타그램 피드\n\n## 첫 줄\n같은 코랄인데 왜 나만 얼굴이 칙칙해 보일까요?\n\n## 본문\n원인은 색 이름이 아니라 명도와 채도 차이예요. 리안 퍼스널컬러&메이크업에서는 진단 결과에 맞춰 같은 계열 안에서 고르는 법을 알려 드려요.\n\n나중에 립 고를 때 보려면 저장해 두세요.\n\n#서면퍼스널컬러 #부산퍼스널컬러 #퍼스널컬러진단 #메이크업컨설팅\n\n| 메뉴 | 총액 | 예약금 |\n| --- | --- | --- |\n| 퍼스널컬러 진단 1인 | 70,000원 | 20,000원 |",
        "work/demo/design.md": "사용한 스킬: rian-brand, design:design-critique, design:accessibility-review\n브랜드 검사: 오류 0 / 경고 0\n\n# 카드뉴스 4장 (1080×1350)\n\n1. **표지** — Mist Light 배경, 국문 헤드 Hahmlet Light 88px, Tourmaline 은 쓰지 않음\n2. **원인** — Raw 배경, 명도·채도 비교 칩 2개(고객 색 칩만 유채색)\n3. **고르는 법** — Raw 배경, 목록 기호는 Tourmaline 마름모 (이 장의 Tourmaline 한 곳)\n4. **예약 안내** — '예약 · 네이버 플레이스' 만 Tourmaline, RIAN 워드마크 좌상단\n\nFigma 미연결 – 설계서만 작성",
      },
    }];
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
    const snapshot = () => (paused ? frozen : JSON.parse(JSON.stringify({ demo: true, canAnswer: true, canApprove: true, canSendTask: true, updatedAt: iso(now()), dayEnded, floors, sessions, questions, approvals })));
    return {
      tick, snapshot, spawn, ask,
      setPaused(v) { paused = v; frozen = v ? JSON.parse(JSON.stringify({ demo: true, canAnswer: true, canApprove: true, canSendTask: true, updatedAt: iso(now()), dayEnded, floors, sessions, questions, approvals })) : null; },
      setDayEnded(v) { dayEnded = v; },
      decide(id, decision, note) { const a = approvals.find((x) => x.id === id); if (a && a.status === "pending") { a.status = decision === "approve" ? "approved" : "revise"; a.decisionNote = note || ""; a.decidedAt = iso(now()); } },
      answer(id) { const i = questions.findIndex((q) => q.id === id); if (i >= 0) questions.splice(i, 1); },
      get paused() { return paused; }, get dayEnded() { return dayEnded; },
    };
  }
  return { createSim };
});
