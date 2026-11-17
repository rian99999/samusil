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

### 직급 구조: 본부장 → 팀장 → 팀원

| 직급 | 서브에이전트 | 모델 | 하는 일 | 남기는 파일 |
|---|---|---|---|---|
| 본부장 (6F 대표실, 서윤) | `director` | opus | 지시서를 팀별로 분배 · 팀장 보고 검수 · **최종결재**(승인/반려) | `plan.md`, `reports/<작업>.md` |
| 팀장 (각 층: 지우·하린·민준·도윤) | `team-lead` | sonnet | 팀원 일감표 · 팀원 결과 검토/반려 · 합쳐서 최종 결과 · 팀 보고 | `<팀>/tasks.md`, `review.md`, `report.md`, `naver.md` 등 |
| 팀원 (각 층: 수아·태오·예린·현우) | `naver-blog-marketer` · `instagram-marketer` · `threads-marketer` · `designer` | sonnet | 팀장이 준 일 1개씩 | `<팀>/parts/T번호-*.md` |

흐름: 사장님 지시 → 본부장 분배 → 팀장이 팀원에게 1~3개로 나눔 → 팀원 → 팀장 보고(반려 최대 2회) → 본부장 보고·**최종결재**(반려 최대 2회) → 사장님 결재함.
모델은 `.claude/agents/<이름>.md` 맨 위 `model:` 줄로 정한다. 바꾸려면 그 한 줄만 고친다.
Claude Code 의 서브에이전트는 다른 서브에이전트를 부를 수 없다. 그래서 메인 대화가 **비서**로서 순서대로 사람을 불러 주고, 지시·보고 내용은 파일로 위아래로 오간다. 비서는 쓰거나 결재하지 않는다.

### 직원 사전지식 (`knowledge/`)
짧게 지시해도 알아듣도록 분야별 최신 기준을 모아 두었다: 짧은 지시 풀이표(`request-defaults.md`), 광고 표시 법 기준(`ad-disclosure.md`), 네이버·인스타·스레드·그림 크기.
- 모든 항목에 근거 등급(공식 / 공식(요약) / 보도 / 미확인)과 출처·확인일이 붙는다. 결과물에는 공식 항목만 사실로 쓴다.
- `node tools/knowledge-check.mjs` 로 30일 지난 파일을 찾고, `/knowledge-refresh` 로 다시 조사한다(업무 시작 때 자동 확인). 바뀐 내용은 `knowledge/CHANGELOG.md`.
- 이 작업 환경에서는 blog.naver.com·네이버 도움말이 자동 수집 차단이라 네이버 공식 문서는 미확인으로 남아 있다.

**직원은 원고·시안·게시본까지만 만든다.** 인스타그램·스레드는 사장님이 결재 승인 뒤 화면의 **게시** 버튼을 눌러야 올라간다(아래 "게시와 휴대폰 알림"). 네이버 블로그는 자동 게시가 불가능해 붙여넣기용 원고로 준다.

사무실 화면 기록은 `tools/office.mjs`가 한다:

```bash
node tools/office.mjs start director-1 --role director                              # 본부장 출근
node tools/office.mjs start lead-naver-1 --role naver-lead --parent director-1      # 팀장 출근
node tools/office.mjs start naver-1 --role naver-blog-marketer --parent lead-naver-1 # 팀원 출근
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

## 업무 지시를 화면에서 바로 보내기

1. 서버를 비밀번호와 함께 켠다: `node tools/serve.mjs --pin 4821` (비밀번호는 원하는 숫자·글자. 없으면 보내기 버튼이 나오지 않는다)
2. 업무를 받을 Claude 대화(같은 저장소)에서 `/office-watch` 를 한 번 실행해 둔다 → 그 대화가 업무를 기다린다.
3. 화면의 **업무 맡기기 → 지시서 만들기 → Claude에 바로 보내기**. 처음 한 번 사무실 비밀번호를 넣으면 그 기기에 기억된다.
4. 화면에 '보냈습니다 → Claude 가 받아서 시작했습니다 → 끝났습니다'가 차례로 표시된다.

- 기다리는 대화가 없으면 업무는 '보냄' 상태로 남았다가, 누군가 `/office-watch` 를 실행하면 그때 받아진다(화면에 안내가 뜬다).
- 비밀번호를 10분에 5번 틀리면 10분 동안 막힌다. 업무 지시는 Claude 가 실제로 일을 하게 하므로, 믿을 수 있는 와이파이에서만 서버를 켜고 비밀번호를 남에게 알려 주지 않는다.
- 명령: `office.mjs task-add --text …`(화면이 씀) · `task-wait`(대화가 기다림) · `task-done <id>`.

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
4. 바탕화면에 서윤(본부장) 캐릭터 아이콘 'AI 사무실'이 생기고, 누르면 주소창 없이 바로 열린다(`manifest.webmanifest`).

- 컴퓨터가 꺼지거나 `serve.mjs`를 멈추면 화면은 '확인 중'으로 멈춘다. 집 밖(다른 인터넷)에서는 열리지 않는다.
- 시연 링크(claude.ai 페이지)도 같은 방법으로 홈 화면에 추가할 수 있지만, 아이콘은 claude.ai 기본 모양이고 시연 자료만 나온다.

## 직원의 스킬 사용

모든 직원은 일을 시작할 때 Claude Code **스킬**을 불러 쓰고, 끝내기 전에 **자동 브랜드 검사**를 통과해야 한다. 아래 스킬은 모두 설치를 확인했다(2026.11).

| 직원 (팀원은 채널 이름) | 스킬 (순서대로) |
|---|---|
| 모두 | `rian-brand` (이 저장소의 스킬: 브랜드 규칙 + 검사 순서) |
| 네이버 | `marketing:seo-audit`(키워드 조사만) · `marketing:draft-content` · `brand-voice:brand-voice-enforcement` · `design:ux-copy` · (경쟁사 사이트 연결 시) `marketing:competitive-brief` |
| 인스타 | `marketing:content-creation` · `marketing:draft-content` · `brand-voice:brand-voice-enforcement` · `design:ux-copy` |
| 스레드 | `marketing:draft-content` · `marketing:content-creation` · `brand-voice:brand-voice-enforcement` · `design:ux-copy` |
| 디자이너 | Figma(`figma:figma-use`·`figma-generate-design`) 또는 Canva(`canva:edit-design`·`resize-for-social-media`·`brand-check`) · `design:design-critique` · `design:accessibility-review` · `design:ux-copy` |
| 본부장 | `marketing:campaign-plan`(분배) · `marketing:brand-review` · `brand-voice:brand-voice-enforcement` · `design:design-critique` · `design:accessibility-review` |
| 팀장 | `marketing:brand-review` · `brand-voice:brand-voice-enforcement` (디자인팀: `design:design-critique` · `design:accessibility-review`) |
| 비서(메인 대화) | `rian-brand` |

- **쓰지 않는 스킬:** `brand-guidelines`(Anthropic 브랜드 색·서체), `theme-factory`, `algorithmic-art` — RIAN 과 충돌.
- `brand-voice` 스킬은 `.claude/brand-voice-guidelines.md`를 찾는다 → `brand/RIAN.md`로 연결해 두었다(바로가기). 설정은 `.claude/brand-voice.local.md`(엄격하게, 이유 설명).
- marketing 스킬이 "먼저 물어보라"는 단계는 직원이 brief·brand 파일로 채우고, 없으면 `[확인 필요]`. SEO 도구(Ahrefs)는 연결돼 있지 않아 검색량 숫자는 추정으로만 쓴다.
- 자동 검사: `node tools/brand-check.mjs work/<작업>/*.md` — 오류가 있으면 본부장 결재로 넘어가지 않는다.
- 결과 파일 맨 위에 `사용한 스킬:`과 `브랜드 검사:` 줄이 남고, 본부장 보고서에 직원별 스킬 사용 표가 들어간다.

## 브랜드: RIAN

직원은 모두 **리안 퍼스널컬러&메이크업(RIAN)** 규칙을 따른다.

- `brand/RIAN.md` — 이름 표기, 슬로건, 브랜드 스토리, 말하는 방식(쓸/쓰지 않을 표현), 채널별 규칙, 색·서체·로고, 사진 규칙. 출처: RIAN 브랜드 가이드라인 v1.6, RIAN 디자인 시스템.
- `brand/facts.md` — 직원이 써도 되는 사실: 주소·주차·영업시간·예약금·메뉴 가격(가격표 2026.11). 출처 문서를 항목마다 표시. ⚠ 표시는 문서끼리 값이 달라 사장님 확인이 필요한 항목.
- 계좌번호는 일부러 넣지 않았다(어떤 글에도 쓰지 않는 값).
- 가격·주소가 바뀌면 `brand/facts.md`만 고치면 모든 직원에게 적용된다.

## 시안·자료 결재 (컨펌)

본부장 최종결재가 끝난 결과물은 **결재함**에 올라온다. 대표실 앞에 📋를 든 직원이 서고 화면 아래에 **결재 대기 N** 버튼이 뜬다.

1. 버튼(또는 줄 선 직원)을 누르면 결재 목록 → 하나를 누르면 원고(마크다운 표·목록까지)와 시안 그림을 그 자리에서 본다.
2. **승인** 또는 **수정 요청**(무엇을 고칠지 의견 필수)을 누른다 → 직원에게 바로 전달된다.
3. 수정 요청이면 직원이 고쳐서 다시 올린다.

- 명령: `office.mjs submit … --file …` (결재 올리기) · `decide <id> approve|revise --note` · `wait-approval <id>` · `close <id>`.
- 화면은 `work/`·`reports/` 안의 .md·.txt·.png·.jpg·.webp 만 보여 준다(`/api/file`). 그 밖의 파일·경로는 열리지 않는다.
- 공유 링크(시연)에서는 예시 결재로 화면만 체험할 수 있다.

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

## 게시와 휴대폰 알림

### 무엇이 되나
| | 자동 게시 | 이유 |
|---|---|---|
| 인스타그램 (비즈니스 계정) | 됨 — 사진 1~10장 + 캡션 | Meta 공식 게시 API |
| 스레드 | 됨 — 글 1개(+그림 1장) | Meta 공식 Threads API. 타래 이어 달기는 문서 확인 전이라 꺼 둠 |
| 네이버 블로그 | 안 됨 | 네이버가 2020-05-06 블로그 글쓰기 API 를 종료. 붙여넣기용 원고로 받는다 |

### 흐름
1. 직원이 만든 결과 + **게시본**(`post-instagram.json`, `post-threads.json`)이 본부장 최종결재를 거쳐 결재함에 올라온다 → **휴대폰 알림**.
2. 알림을 누르면 그 결재가 열린다(같은 와이파이일 때). 글·그림·게시본을 보고 **승인**.
3. 결재함의 **게시 대기**에서 **인스타그램에 게시 / 스레드에 게시**를 누른다(사무실 비밀번호, 한 번 더 확인 창).
4. `tools/publish.mjs`가 올리기 직전에 다시 검사한다: 결재 때 파일과 같은지(지문), 광고 표시가 첫 줄에 있는지, 해시태그 5개 이하, 글자 수, 인스타 그림 JPEG, 브랜드 검사 오류 0. 하나라도 걸리면 올리지 않는다.
5. 게시가 끝나면 결재함에 게시물 주소가 남고 휴대폰 알림이 온다. 같은 결재·채널은 두 번 올라가지 않는다.

Claude(비서·직원)는 게시를 실행하지 못하게 `.claude/settings.json`에서 `publish.mjs` 실행과 `office.secrets.json` 읽기를 막아 두었다. 이것은 Claude Code 권한 규칙이라, 같은 컴퓨터의 사람이 직접 실행하는 것까지 막지는 않는다.

### 준비 (사장님 컴퓨터, 한 번만)
1. **연결 파일**: `office.secrets.example.json`을 `office.secrets.json`으로 복사한다. 이 파일은 git 에 올라가지 않는다. 토큰을 대화·메신저에 붙여넣지 않는다.
2. **휴대폰 알림 (ntfy)**
   - 휴대폰에 **ntfy** 앱 설치(안드로이드·아이폰).
   - 길고 짐작하기 어려운 주제 이름을 정한다(예: `rian-office-` 뒤에 무작위 글자 20개). 이 이름을 아는 사람은 알림을 볼 수 있으니 비밀번호처럼 다룬다.
   - 앱에서 그 주제를 구독하고, `office.secrets.json`의 `notify.ntfyTopic`에 같은 이름을 넣는다. `officeUrl`에는 serve.mjs 가 알려 주는 `http://192.168.x.x:8080`을 넣는다(알림을 누르면 그 결재가 열림).
   - `node tools/notify.mjs test` → 휴대폰에 시험 알림이 오면 끝.
   - 알림에는 결재 번호와 제목만 간다(글 내용·고객 정보는 보내지 않는다). 알림은 ntfy.sh 서버를 거친다.
3. **인스타그램·스레드 연결 (Meta 개발자 앱)**
   - [Meta for Developers](https://developers.facebook.com/)에서 앱을 만들고, 인스타그램 비즈니스 계정에 `instagram_business_basic`·`instagram_business_content_publish` 권한(Instagram 로그인 방식, 호스트 graph.instagram.com), 스레드에 `threads_basic`·`threads_content_publish` 권한을 승인한다. 화면 이름·순서는 Meta 가 자주 바꾸므로 [인스타 게시 문서](https://developers.facebook.com/docs/instagram-platform/content-publishing/)·[스레드 문서](https://developers.facebook.com/documentation/threads/overview)를 따른다.
   - 받은 계정 ID 와 액세스 토큰을 `office.secrets.json`의 `instagram.userId/accessToken`, `threads.userId/accessToken`에 넣는다. 토큰은 만료될 수 있다 — 게시가 "Meta 응답 401/190" 으로 실패하면 새로 받는다.
4. **그림 임시 공개 (cloudflared)**: Meta 는 그림을 인터넷 주소에서 가져간다. `cloudflared`를 설치해 두면 게시하는 몇십 초 동안만 그 게시물의 그림들만 추측하기 어려운 임시 주소(`*.trycloudflare.com`)로 열고, 끝나면 닫는다. 계정은 필요 없다.
   - 맥: `brew install cloudflared` / 윈도우: `winget install --id Cloudflare.cloudflared`
5. 서버를 비밀번호와 함께 켠다: `node tools/serve.mjs --pin 1234` → 창에 "휴대폰 알림: 켜짐 · 게시 연결: 인스타 있음 / 스레드 있음"이 보이면 준비 끝.

### 확인한 것 / 못 한 것
- 이 저장소 안에서 가짜 Meta·알림 서버로 끝까지 시험함: 승인 전 게시 거절, 비밀번호 틀림·다른 사이트 요청 거절, 사진 2장 캐러셀 게시, 스레드 게시, 게시 완료 알림, 같은 글 두 번 게시 거절, 승인 뒤 바뀐 파일 거절, 해시태그 6개·광고 표시 누락 거절, 화면에 토큰이 나오지 않음.
- **실제 Meta·ntfy 서버로는 아직 시험하지 못했다**(이 작업 환경에서 접속 차단). 첫 게시는 사장님 컴퓨터에서 시험용 글 하나로 확인한다.
