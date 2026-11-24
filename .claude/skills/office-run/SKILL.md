---
name: office-run
description: (큰 캠페인 전용) 여러 날·여러 채널·디자인 시안이 함께 필요한 큰 일에만 직급 구조(본부장 opus → 팀장 sonnet → 팀원 sonnet)로 진행한다. 글 하나·게시물 하나는 이것 대신 /post 를 쓴다. "캠페인", "한 달 계획", "/office-run" 같은 요청에 사용.
---
# AI 사무실 업무 진행 (직급제)

## 직급
| 직급 | 서브에이전트 | 모델 | 하는 일 |
|---|---|---|---|
| 본부장 (대표실) | `director` | opus | 팀별 분배(plan.md) · 최종결재 · 사장님 보고서 |
| 팀장 (각 층) | `team-lead` (팀 이름을 함께 준다) | sonnet | 팀원 일감표(tasks.md) · 팀원 결과 검토/반려 · 합쳐서 최종 결과 파일 · 팀 보고 |
| 팀원 (각 층) | `naver-blog-marketer` · `instagram-marketer` · `threads-marketer` · `designer` | sonnet | 팀장이 준 일 한 개씩 → `<팀>/parts/` |

모델은 각 에이전트 파일 맨 위 `model:` 줄에 있다. 바꾸려면 그 줄만 고친다(`haiku`·`sonnet`·`opus`). 지금: 본부장 opus · 팀장 sonnet · 팀원 sonnet.

**보고·지시는 반드시 위아래로만:** 사장님 → 본부장 → 팀장 → 팀원, 보고는 팀원 → 팀장 → 본부장 → 사장님.
Claude Code 에서 서브에이전트는 다른 서브에이전트를 부를 수 없다. 그래서 이 대화(메인 세션)는 **비서**다: 순서대로 사람을 불러 주고, 서로 주고받는 내용은 **파일**로 전한다. 비서는 내용을 직접 쓰거나 고치거나 결재하지 않는다.

| 팀 | 층 | 팀장 역할 id | 팀원 서브에이전트 | 최종 결과 파일 |
|---|---|---|---|---|
| naver | 3F 네이버 블로그팀 | `naver-lead` | `naver-blog-marketer` | `naver.md` |
| insta | 4F 인스타그램팀 | `insta-lead` | `instagram-marketer` | `instagram.md` |
| threads | 5F 스레드팀 | `threads-lead` | `threads-marketer` | `threads.md` |
| design | 2F 디자인팀 | `design-lead` | `designer` | `design.md` (+그림) |

작업 폴더: `work/<작업이름>/` — `brief.md`(비서) · `plan.md`(본부장) · `<팀>/tasks.md`·`review.md`·`report.md`(팀장) · `<팀>/parts/*.md`(팀원) · 최종 결과 파일(팀장) · `reports/<작업이름>.md`(본부장 최종결재)

## 0. 사전지식 확인 (비서)
`node tools/knowledge-check.mjs` → ✗(30일 지남)가 있으면 Skill 도구로 `knowledge-refresh`를 그 파일만 대상으로 먼저 돌린다(조사가 막히면 그대로 진행하고 보고에 적는다). 지난 작업 결과에 `사전지식 갱신 필요:` 줄이 있으면 그것도 함께 갱신한다.

## 1. 일감 정리 (비서)
- 사장님 지시가 짧아도 되묻지 않는다. 받은 말을 그대로 brief.md 에 옮기고, 풀어 쓰기는 본부장이 `knowledge/request-defaults.md`로 한다(plan.md 의 "지시 풀이"). 본부장이 '꼭 물어야 하는 것'으로 올린 것만 묻는다.
- Skill 도구로 `rian-brand`를 불러 규칙을 확인한다. 브랜드는 RIAN(리안 퍼스널컬러&메이크업), 규칙 `brand/RIAN.md`, 사실 `brand/facts.md`.
- 메시지의 `[업무 지시서]` 블록을 그대로 `brief.md`로 옮긴다(맨 위에 "브랜드 규칙: brand/RIAN.md, 사실: brand/facts.md"). `(없음)` 항목만 필요할 때 묻는다.
- 지시서의 사실이 facts.md 와 다르면 진행 전에 사장님께 묻는다. 빠진 것이 있으면 한 번에 묻는다(AskUserQuestion).
- 참고 사이트: 지시서 `참고 사이트:` + `office.config.json`의 `sites`. 직원은 WebFetch 가 거절되는 곳(네이버 블로그 등)을 `node tools/site-read.mjs <주소>`로 읽는다(읽기만). 사장님은 화면 '사이트 연결 → 연결 확인'으로 열리는지 본다. brief 에 목록을 적고, 사람을 부를 때 **그 팀(팀장·팀원)에 연결된 사이트만** 알려 준다(팀원 역할에 연결된 사이트는 그 팀장도 본다. `"*"`·`director`는 본부장). 막힌 사이트는 사장님께 알리고 없이 진행한다.
- 작업 이름 `<YYYY-MM-DD>-<짧은영문>`.

## 2. 본부장 분배
```bash
node tools/office.mjs start director-<작업> --role director
```
`director`를 부른다: "[분배] 작업 폴더 work/<작업>/, 내 id director-<작업>". plan.md 가 나오면:
- plan.md 의 '사장님께 먼저 물어야 할 것'이 있으면 6번(질문)으로 묻고, 답을 answers.md 에 적은 뒤 진행한다.
- 본부장은 결재 전까지 `idle`: `node tools/office.mjs state director-<작업> idle`

## 3. 팀장 분배 (팀마다, 동시에)
plan.md 에 배정된 팀마다:
```bash
node tools/office.mjs start lead-<팀>-<작업> --role <팀>-lead --parent director-<작업>
```
`team-lead`를 팀마다 **한 번에 함께** 부른다: "[분배] 팀 <팀>, 작업 폴더 work/<작업>/, 내 id lead-<팀>-<작업>". 디자인팀은 글 팀의 최종 결과 파일이 나온 뒤(5번 다음)에 3~5번을 따로 돈다.

## 4. 팀원 작업 (일감마다, 동시에)
`<팀>/tasks.md`의 T번호마다 출근시키고 그 팀의 팀원 서브에이전트를 **한 번에 함께** 부른다:
```bash
node tools/office.mjs start <팀>-T1-<작업> --role <팀원 역할> --name "<T1 제목>" --parent lead-<팀>-<작업>
```
부를 때 줄 것: "작업 폴더 work/<작업>/, 팀 <팀>, 내 일 T1, 내 id <팀>-T1-<작업>. <팀>/tasks.md 의 T1 만 해라."
팀원이 끝나면 `state <id> reporting`(팀장에게 보고, 만세+별). 팀장은 그동안 `idle`.

## 5. 팀장 취합·검토
`state lead-<팀>-<작업> working` 후 `team-lead`를 "[취합] 팀 <팀>, 작업 폴더 …"로 부른다.
- 답 첫 줄이 `반려: T1, …` → 그 팀원들을 다시 부른다("<팀>/review.md 의 T1 반려부터 고쳐라") → 다시 [취합]. **팀장 반려는 일감마다 2번까지**(3번째는 팀장이 직접 고친다).
- 답 첫 줄이 `보고: <파일>` → 그 팀 팀원들 `end`(퇴근), 팀장 `state … reporting`.

## 5-0. 자동 검사 관문 (비서)
본부장에게 넘기기 전에 `node tools/brand-check.mjs work/<작업>/*.md`를 직접 돌린다. 오류(✗)가 있으면 그 팀장에게 "[취합] 자동 검사 오류: …"로 되돌린다. 오류 0일 때만 결재로 간다.

## 5-1. 본부장 최종결재
`state director-<작업> working` 후 `director`를 "[최종결재] 작업 폴더 work/<작업>/"로 부른다 → `reports/<작업>.md`.
- **반려** 팀이 있으면: 그 팀장을 "[재작업] 팀 <팀>…"으로 부른다 → 4~5번 → 다시 [최종결재]. 본부장 반려는 2번까지, 그 뒤에도 반려면 사장님께 그대로 보고하고 결정을 묻는다.
- **승인**이면 팀장들 `end`, 본부장 `state … reporting`.

## 5-2. 사장님 결재함 (올리기 전 마지막 확인)
본부장 최종결재 승인분만 사장님 결재에 올린다. 사장님은 사무실 화면의 **결재함**에서 원고·시안을 읽고 승인/수정 요청을 보낸다.
```bash
node tools/office.mjs submit director-<작업> --title "<주제> — <채널들>" \
  --file work/<작업>/naver.md --file work/<작업>/design.md --file reports/<작업>.md
```
- 올린 파일만 화면에 보인다(`work/`·`reports/` 안의 .md·.txt·.json·.png·.jpg·.webp). 그림 파일도 `--file`로 함께.
- 게시본이 있으면 **반드시 함께** 올린다: `--file work/<작업>/post-instagram.json --file work/<작업>/post-threads.json` + 게시본이 가리키는 그림 파일 전부. 결재 때 파일 지문이 남고, 승인 뒤 한 글자라도 바뀌면 게시가 막힌다.
- 결재를 올리면 사장님 휴대폰으로 알림이 간다(ntfy, office.secrets.json 설정 시). 이 대화에서도 PushNotification 도구가 있으면 "결재 a번호 대기: 제목"을 한 번 보낸다.
- 결재 번호(a숫자)를 이 대화에 알리고 **백그라운드로** `node tools/office.mjs wait-approval <결재id> --timeout 240`.
- `approved` → 7번 보고. 게시본이 있었으면 "사무실 화면 결재함에서 '게시'를 누르면 올라갑니다"라고만 알린다. **비서·직원은 `tools/publish.mjs`를 실행하지 않는다** — 게시는 사장님이 화면에서 PIN 과 함께 직접 누른다. `revise` → 의견을 answers.md 에 "결재 의견"으로 적고 **본부장부터** 다시: director [분배 수정이 필요하면 분배] → 해당 팀장 [재작업] → 팀원 → 팀장 → 본부장 [최종결재] → 새로 `submit`(이전 결재는 `close`).
- 사장님이 대화에서 "승인"/"○○ 고쳐 줘"라고 해도 같은 결정: `node tools/office.mjs decide <결재id> approve|revise --note "…" --via chat`.
- brief 에 "시안 먼저 확인"이 있으면 디자인팀 결과만 먼저 같은 길(팀장 → 본부장 → 결재함)로 올린다.
- 끝나면 `node tools/office.mjs close <결재id>`.

## 6. 질문 흐름 — 팀원 → 팀장 → (필요할 때만) 사장님
**팀원 질문은 팀장이 먼저 받는다.** `office.mjs ask`는 팀원이 물으면 자동으로 `to: lead`(팀장 앞)로, 팀장·본부장이 물으면 `to: owner`(사장님 질문함)로 기록한다. 사장님 화면·알림에는 사장님께 올라온 질문만 나온다(팀 층에는 '팀장에게 질문 N'만 표시).

1. 팀원 답 첫 줄에 `팀장 질문: q번호`가 있으면 → 그 팀 `team-lead`를 **[질문 답변] q번호**로 부른다.
2. 팀장 답이 `답함: q번호` → 그 팀원을 다시 불러 "<팀>/answers-team.md 의 q번호 답으로 [확인 필요: q번호] 자리를 채워라"를 준다.
3. 팀장 답이 `사장님께 올림: q번호` → 이 대화에 "q번호 질문(팀장이 올림): … — 사무실 질문함에서 답해 주세요"를 적고, **백그라운드로** `node tools/office.mjs wait q번호 --timeout 120`.
   - `answered` → `work/<작업>/answers.md`에 `질문id / 질문 / 답 / 시각 / 받은 곳`을 덧붙이고 `office.mjs answer q번호` → 그 팀원(과 필요하면 팀장)을 다시 부른다.
   - `timeout` → 한 번 더 알리고 다시 기다린다. `gone` → 넘어간다.
   - 사장님이 이 대화에 답하면 `office.mjs reply q번호 --text "답" --via chat`.
4. 팀장·본부장이 직접 사장님께 묻는 질문은 3번과 같다.
답을 지어내거나 대신 정하지 않는다. 기다리는 동안 상관없는 일은 계속한다.

## 6-0a. 가이드라인 제안 (팀장 → 사장님 결재)
팀장이 `--kind guideline` 결재를 올리면(결재함에 '가이드라인 제안') 백그라운드로 `wait-approval`.
- `approved` → 고른 안과 사장님 의견을 `knowledge/house-rules.md`의 맞는 칸에 한 줄로 적는다: `- <기준> [사장님 결정 · a번호 · 날짜]`. `knowledge/CHANGELOG.md`에도 한 줄. 그다음부터 모든 직원이 이 기준을 따른다. 진행 중인 작업에 해당하면 그 팀장에게 [재작업]으로 알린다.
- `revise` → 의견을 그 팀장에게 전하고 제안서를 고쳐 다시 올리게 한다.

## 6-0. 묻는 방식 (사장님 요청, 2026-11-18)
- **한 번에 한 질문.** 직원 질문은 화면에서 한 사람씩 넘겨 보며 답한다. 비서가 이 대화에서 직접 물을 때도 AskUserQuestion 은 **질문 1개씩** 부른다(여러 질문을 한 창에 묶지 않는다).
- **고르는 질문에는 예시 그림.** 직원 질문은 `office.mjs ask … --option "A|라벨|어디에|그림"`으로 안마다 그림을 붙인다(각 직원 파일 '사장님께 물을 때'). 비서가 AskUserQuestion 으로 물을 때는 각 선택지의 `preview`에 그 안이 실제로 어떻게 보이는지(문구·배치)를 넣는다. 그림 없이 고르게 하지 않는다.

## 6-1. 사장님 알림 (휴대폰)
사무실 서버(serve.mjs)가 새 결재·질문, 오래 기다리는 결재·질문, 막힌 직원, 아무도 안 받은 업무, 게시 결과를 **알아서** 알린다.
그 밖에 사장님이 봐야 할 일은 비서가 직접 알린다:
```bash
node tools/office.mjs alert "보고 도착: <주제>" --message "<한 줄 결론>" --path "#<결재id>"
```
반드시 알릴 때: 최종 보고가 나왔을 때 / 본부장 반려가 2번을 넘어 사장님 결정이 필요할 때 / 같은 브랜드 검사 오류로 2번 실패했을 때 / 참고 사이트가 막혀 일부만 했을 때 / 사전지식 갱신이 막혔을 때 / 그 밖에 일이 멈춰 사장님 판단이 필요할 때(`--urgent yes`).
알림 문구에는 고객 이름·연락처·글 본문을 넣지 않는다(제목과 번호만).

## 7. 보고
사장님께 아래만 짧게 보고한다. 꾸밈말 없이.
1. 한 줄 결론 (본부장 보고서의 결론 그대로)과 결재 흐름(팀장 반려 N회, 본부장 반려 N회, 사장님 결재 결과)
2. 직원별로 쓴 스킬과 브랜드 검사 결과(오류 0 / 경고 N), 빠진 스킬이 있으면 그 이름
3. 보고서 경로와 결과 파일 경로
4. 꼭 고칠 것 / 정해 주셔야 할 것
그 뒤 `node tools/office.mjs end director-<작업이름>`. 하루 업무를 마치면 `node tools/office.mjs day end`(불 끄기).

## 지킬 것
- 직원 결과를 "올렸다"고 말하지 않는다. 직원이 만드는 것은 원고·시안·게시본까지다. 인스타·스레드 게시는 승인 뒤 사장님이 화면의 '게시' 버튼으로만 한다(네이버 블로그는 자동 게시 불가 — 붙여넣기용 원고로 준다).
- 비서(이 대화)는 직급을 건너뛰지 않는다: 팀원 결과를 본부장에게 바로 주거나, 본부장 반려를 팀원에게 바로 전하지 않는다.
- 본부장 최종결재 없이 사장님 결재함에 올리지 않는다.
- 사무실 기록 명령이 실패하면 숨기지 말고 보고에 적는다.
