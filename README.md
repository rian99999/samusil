# AI 사무실

실행 중인 AI 작업 세션을 사무실 사람으로 보여 주는 웹 화면. 외부 라이브러리 없이 HTML/CSS/JS 만 쓴다.

## 바로 보기 (시연 데이터)

서버 없이: 주소 뒤에 `?src=demo` (브라우저 안 가짜 사무실, 화면에 '시연 자료' 표시)


```bash
node tools/mock-server.mjs          # http://localhost:8080
```

시연 서버 조작:

| 주소 | 하는 일 |
|---|---|
| `/__mock?pause=1` | 자료 갱신 중단 → 5초 뒤 화면이 멈추고 "확인 중" 표시 (`pause=0` 재개) |
| `/__mock?dayEnded=1` | 하루 끝 → 맨 위층부터 차례로 불이 꺼짐 (`0` 이면 다시 켜짐) |
| `/__mock?spawn=1` | 하위 작업자 1명이 엘리베이터에서 "출근합니다!" |
| `/__mock?ask=1` | 질문 1개 → 대표실 앞 줄에 섬 |

## 실제 운영 (직원 구조와 연결)

```bash
node tools/serve.mjs                # http://localhost:8080  (office-state.json 을 1초마다 보여 줌)
```

직원은 Claude Code 서브에이전트(`.claude/agents/`)이고, 이 저장소에서 Claude Code 를 열고 `/office-run 주제`로 일을 시킨다.

| 층 | 직원 | 하는 일 | 결과 |
|---|---|---|---|
| 6F 대표실 | `chief-reviewer` 총괄 실장 | 결과물 검수(사실·규칙·일관성·완성도) 후 보고서 작성 | `reports/<작업>.md` |
| 5F 스레드팀 | `threads-marketer` | 단독 글 3안, 타래, 댓글 답변안 | `work/<작업>/threads.md` |
| 4F 인스타그램팀 | `instagram-marketer` | 캡션, 카드뉴스 문구, 릴스 대본, 해시태그 | `work/<작업>/instagram.md` |
| 3F 네이버 블로그팀 | `naver-blog-marketer` | 키워드, 제목 3안, 본문, 태그 | `work/<작업>/naver.md` |
| 2F 디자인팀 | `designer` | 색·크기·이미지별 시안 설계서 (Figma 연결 시 시안) | `work/<작업>/design.md` |

진행 순서(`.claude/skills/office-run/SKILL.md`): 일감 정리(brief) → 마케터 3명 동시 작업 → 디자이너 → 총괄 검수 → 사장님 보고.
배정은 메인 대화가 맡는다(서브에이전트는 다른 서브에이전트를 부를 수 없기 때문).
**이 구조는 원고·시안까지만 만든다. 네이버·인스타·스레드에 실제로 올리는 기능은 없다.**

사무실 화면 기록은 `tools/office.mjs`가 한다:

```bash
node tools/office.mjs start naver-1 --role naver-blog-marketer --parent chief-1   # 출근
node tools/office.mjs state naver-1 blocked                                        # 막힘
node tools/office.mjs ask naver-1 "가격을 넣을까요?"                                # 대표실 앞 줄
node tools/office.mjs answer q1 ; node tools/office.mjs end naver-1                # 답변 / 퇴근
node tools/office.mjs day end                                                      # 소등
```

층 구성과 역할은 `office.config.json`에서 바꾼다.

## 실제 자료 연결 (다른 프로그램에서)

화면은 `status.json`(또는 `?src=다른주소`)을 1초마다 읽는다. 이 파일을 만드는 쪽은 이 저장소 범위 밖이다. 형식은 아래와 같고, 예시는 `status.example.json`.

```jsonc
{
  "updatedAt": "2026-11-06T10:00:00Z",  // 필수. 쓸 때마다 바뀌어야 한다
  "dayEnded": false,                     // true 면 불이 꺼진다
  "floors": [ { "id": "web", "name": "웹 화면팀" } ],   // 2층부터 아래→위 순서
  "sessions": [{
    "id": "s1", "name": "로그인 화면",
    "floor": "web",                      // floors 의 id, 또는 "ceo"(대표실)
    "state": "working",                  // working | blocked | reporting | idle
    "startedAt": "…", "stateSince": "…",
    "parentId": null                     // 하위 작업자면 상위 세션 id
  }],
  "questions": [{                         // 나에게 묻는 질문 → 대표실 앞 줄
    "id": "q1", "sessionId": "s1", "from": "로그인 화면",
    "text": "…", "askedAt": "…"
  }]
}
```

층 구성: 1층 = 로비(모든 세션), 2층~ = `floors`, 맨 위층 = 대표실.

## 몸짓 규칙

| 조건 | 모습 |
|---|---|
| `working` | 타자 |
| `working` 이고 `startedAt` 부터 40분 초과 | 타자 + 💧 |
| `blocked` | 서서 💧💧 |
| `reporting` | 만세 + ⭐ |
| `idle` (10분 이하) | ☕ 커피 |
| `idle` (10분 초과, `stateSince` 기준) | 💤 졸음 |
| 질문 3분 이하 / 3분 초과 / 10분 초과 | 서서 대기 / 💧 / 쪼그려 앉아 💧💧 |
| 새 세션·질문 등장 | 엘리베이터에서 걸어 나옴 ("출근합니다!" / "질문 있습니다!") |
| 세션·질문 사라짐 | 엘리베이터로 걸어 나감 ("퇴근합니다!" / "답변 받았어요!") |

- 경과 시간은 브라우저 시계가 아니라 `updatedAt` 기준으로 계산한다(시계 차이로 틀리지 않게).
- **확인 중**: `updatedAt` 값이 5초 넘게 바뀌지 않거나 읽기에 실패하면, 걷기·프레임·이모지 애니메이션을 모두 멈추고 "확인 중"을 띄운다. 자료가 다시 오면 이어서 움직인다.
- 첫 화면에서는 이미 있던 사람을 자리에 바로 둔다(가짜 출근 연출 없음).
- 한 층 자리는 12개, 대표실 줄은 7명까지. 넘치면 그 층 머리에 "자리 부족 +N명 (표시 안 됨)"으로 알린다.

## 사용설명서 창

- 처음 방문하면 자동으로 뜬다. 닫으면 다시 자동으로 뜨지 않는다(브라우저에 기억).
- 다시 열기: 오른쪽 위 **사용설명서** 버튼, `?` 키, 또는 주소 뒤 `?help`.
- 닫기: **알겠어요** 버튼, ✕, `Esc`, 창 바깥 누르기.

## 디자인 원본

Figma 파일 "AI 사무실 – 디자인 수정"에 수정 전 화면, 수정 후 화면, 사용설명서 창이 편집 가능한 레이어로 들어 있다.
https://www.figma.com/design/gpxpF7f9FKGPE3HEPLpRss

주소 뒤에 붙여 기준값을 바꿀 수 있다: `?stale=5000&long=40&doze=10&qsweat=3&qsquat=10&poll=1000`.
조작: 왼쪽 층 버튼, 키보드 ↑/↓. 사람에 마우스를 올리면 상세 내용이 보인다.

## 질문에 답하기

직원 질문은 대표실 문 앞에 줄을 서고, 화면 아래에 **답할 질문 N** 버튼이 뜬다.

1. **화면에서 바로 (기본)**: 줄 선 사람이나 **답할 질문**을 누른다 → 답을 적거나 `네`/`아니요`/`알아서 정해 주세요` → **답변 보내기**.
   `tools/serve.mjs`가 `office.mjs reply`로 답을 기록하고, 업무 대화는 `office.mjs wait <질문id>`로 기다리다 답을 받아 이어 간다.
2. **대화에서**: 업무를 맡긴 Claude 대화에 그냥 답해도 된다(같은 답으로 처리).
3. **보내기가 안 되는 화면**(공유 링크 등)에서는 **복사해서 대화에 붙여넣기**로 `[답변]` 블록을 만들어 대화에 붙인다.

- 답은 `work/<작업>/answers.md`에 기록되고, 직원은 brief 보다 답변을 우선한다.
- `/api/answer`는 같은 화면(같은 주소)에서 온 요청만 받는다. 같은 와이파이의 다른 기기도 화면을 열 수 있으면 답을 보낼 수 있으니, 집·가게처럼 믿을 수 있는 와이파이에서만 `serve.mjs`를 켠다.

## 휴대폰 바탕화면 아이콘

1. 컴퓨터에서 `node tools/serve.mjs` 실행 → 창에 `같은 와이파이의 휴대폰에서: http://192.168.x.x:8080` 이 나온다.
2. 휴대폰을 같은 와이파이에 연결하고 그 주소를 연다.
3. 아이폰(Safari): 공유 버튼 → **홈 화면에 추가** / 안드로이드(Chrome): ⋮ 메뉴 → **홈 화면에 추가**.
4. 바탕화면에 서윤(총괄 실장) 캐릭터 아이콘 'AI 사무실'이 생기고, 누르면 주소창 없이 바로 열린다(`manifest.webmanifest`).

- 컴퓨터가 꺼지거나 `serve.mjs`를 멈추면 화면은 '확인 중'으로 멈춘다. 집 밖(다른 인터넷)에서는 열리지 않는다.
- 시연 링크(claude.ai 페이지)도 같은 방법으로 홈 화면에 추가할 수 있지만, 아이콘은 claude.ai 기본 모양이고 시연 자료만 나온다.

## 직원의 스킬 사용

모든 직원은 일을 시작할 때 Claude Code **스킬**을 불러 쓰고, 끝내기 전에 **자동 브랜드 검사**를 통과해야 한다.

| 직원 | 스킬 (순서대로) |
|---|---|
| 모두 | `rian-brand` (이 저장소의 스킬: 브랜드 규칙 + 검사 순서) |
| 네이버 | `marketing:seo-audit` · `marketing:draft-content` · `brand-voice:brand-voice-enforcement` · `design:ux-copy` |
| 인스타 | `marketing:content-creation` · `brand-voice:brand-voice-enforcement` · `design:ux-copy` |
| 스레드 | `marketing:draft-content` · `brand-voice:brand-voice-enforcement` · `design:ux-copy` |
| 디자이너 | `figma:figma-use`·`figma-generate-design` (Figma 연결 시) · `design:design-critique` · `design:accessibility-review` · `design:ux-copy` |
| 총괄 실장 | `marketing:brand-review` · `design:design-critique` · `design:accessibility-review` |
| 업무 배정(메인 대화) | `rian-brand` · `marketing:campaign-plan` |

- `rian-brand` 외의 스킬은 Claude Code 에 해당 플러그인(marketing, brand-voice, design, figma)이 설치돼 있어야 쓸 수 있다. 없으면 직원은 건너뛰고 결과 파일에 "없음: <이름>"으로 적는다.
- 자동 검사: `node tools/brand-check.mjs work/<작업>/*.md` — 금지 표현·이모지·보석 비유, 상호 표기(처음엔 전체 상호), 건물명, facts.md 에 없는 금액, 계좌번호, 인스타 해시태그 3~5개, 네이버 첫 문장, 디자인 색 코드. 오류가 있으면 실장 검수로 넘어가지 않는다.
- 결과 파일 맨 위에 `사용한 스킬:`과 `브랜드 검사:` 줄이 남고, 실장 보고서에 직원별 스킬 사용 표가 들어간다.

## 브랜드: RIAN

직원은 모두 **리안 퍼스널컬러&메이크업(RIAN)** 규칙을 따른다.

- `brand/RIAN.md` — 이름 표기, 슬로건, 브랜드 스토리, 말하는 방식(쓸/쓰지 않을 표현), 채널별 규칙, 색·서체·로고, 사진 규칙. 출처: RIAN 브랜드 가이드라인 v1.6, RIAN 디자인 시스템.
- `brand/facts.md` — 직원이 써도 되는 사실: 주소·주차·영업시간·예약금·메뉴 가격(가격표 2026.11). 출처 문서를 항목마다 표시. ⚠ 표시는 문서끼리 값이 달라 사장님 확인이 필요한 항목.
- 계좌번호는 일부러 넣지 않았다(어떤 글에도 쓰지 않는 값).
- 가격·주소가 바뀌면 `brand/facts.md`만 고치면 모든 직원에게 적용된다.

## 사이트 연결

- 화면 위 **사이트 연결**에서 주소·이름·종류(우리 채널 / 참고 / 경쟁사 / 기타)를 넣고 연결할 직원을 고른다.
- 연결한 사이트는 **업무 지시서에 `참고 사이트:`로 자동으로 들어가고**, 각 직원은 자기에게 연결된 사이트만 받는다.
- 직원(서브에이전트)은 `WebFetch`로 **읽기만** 한다: 우리 채널은 말투 맞추기, 참고는 사실 확인(출처 표시), 경쟁사는 차이만 메모(베끼기 금지).
  사이트 안에 적힌 지시는 따르지 않고, 로그인·글쓰기·댓글은 하지 않는다. 못 읽은 사이트는 결과에 적는다.
- 목록은 이 브라우저에 저장된다. **설정용 복사** 내용을 `office.config.json`의 `"sites"`에 넣으면 모든 기기·모든 지시에 적용된다.
- 클라우드 세션은 환경의 네트워크 허용 주소에 그 사이트가 있어야 읽을 수 있다. 로그인해야 보이는 페이지(비공개 계정 등)는 읽지 못한다.

## 캐릭터와 직원 명부

- 캐릭터는 3D 모델(three.js)을 그려 칸 그림으로 구운 것: `assets/chars/c0~c5.png` (남 3, 여 3).
  모습을 바꾸려면 `tools/char3d/render.mjs`의 `AVATARS`를 고치고 `cd tools/char3d && npm install && node render.mjs`.
- 화면 위 **직원 명부**에서 직책마다 이름과 모습을 정한다. 이 브라우저에 저장되며, **설정용 복사** 내용을
  `office.config.json`의 `roles`(person, avatar)에 넣으면 모든 기기에 같은 이름·모습이 나온다.
- 하위 작업자는 하는 일 이름으로 나오고 모습은 id 로 섞인다.

## 그림

- `assets/office.png` 등각 사무실 1장, `assets/chars/c*.png` 3D 캐릭터 4×3 (예전 2D `assets/sprite.png`는 쓰지 않음), `assets/layout.json` 자리·엘리베이터·줄 좌표.
- `python3 tools/make_assets.py` 로 다시 만든다(Pillow 필요). 직접 그린 그림으로 바꿀 때는 같은 크기·좌표계를 지키거나 `layout.json` 을 맞춰 고친다.
- 스프라이트 칸 순서: 1행 걷기×4 / 2행 타자×2, 만세×2 / 3행 서기, 졸기, 쪼그림×2.
