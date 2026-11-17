---
name: office-run
description: AI 사무실의 직급 구조(본부장 opus → 팀장 sonnet → 팀원 sonnet)로 일을 진행한다. 본부장이 팀에 분배하고, 팀장이 팀원에게 나누고, 팀원→팀장→본부장 순서로 보고해 본부장이 최종결재한 뒤 사장님 결재함에 올린다. "마케팅 해줘", "직원들한테 시켜", "/office-run 주제" 같은 요청에 사용.
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

## 1. 일감 정리 (비서)
- Skill 도구로 `rian-brand`를 불러 규칙을 확인한다. 브랜드는 RIAN(리안 퍼스널컬러&메이크업), 규칙 `brand/RIAN.md`, 사실 `brand/facts.md`.
- 메시지의 `[업무 지시서]` 블록을 그대로 `brief.md`로 옮긴다(맨 위에 "브랜드 규칙: brand/RIAN.md, 사실: brand/facts.md"). `(없음)` 항목만 필요할 때 묻는다.
- 지시서의 사실이 facts.md 와 다르면 진행 전에 사장님께 묻는다. 빠진 것이 있으면 한 번에 묻는다(AskUserQuestion).
- 참고 사이트: 지시서 `참고 사이트:` + `office.config.json`의 `sites`. brief 에 목록을 적고, 사람을 부를 때 **그 팀(팀장·팀원)에 연결된 사이트만** 알려 준다(팀원 역할에 연결된 사이트는 그 팀장도 본다. `"*"`·`director`는 본부장). 막힌 사이트는 사장님께 알리고 없이 진행한다.
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
- 올린 파일만 화면에 보인다(`work/`·`reports/` 안의 .md·.txt·.png·.jpg·.webp). 그림 파일도 `--file`로 함께.
- 결재 번호(a숫자)를 이 대화에 알리고 **백그라운드로** `node tools/office.mjs wait-approval <결재id> --timeout 240`.
- `approved` → 7번 보고. `revise` → 의견을 answers.md 에 "결재 의견"으로 적고 **본부장부터** 다시: director [분배 수정이 필요하면 분배] → 해당 팀장 [재작업] → 팀원 → 팀장 → 본부장 [최종결재] → 새로 `submit`(이전 결재는 `close`).
- 사장님이 대화에서 "승인"/"○○ 고쳐 줘"라고 해도 같은 결정: `node tools/office.mjs decide <결재id> approve|revise --note "…" --via chat`.
- brief 에 "시안 먼저 확인"이 있으면 디자인팀 결과만 먼저 같은 길(팀장 → 본부장 → 결재함)로 올린다.
- 끝나면 `node tools/office.mjs close <결재id>`.

## 6. 사장님 질문
직원(본부장·팀장·팀원)이 사장님 결정이 필요하면 `node tools/office.mjs ask <id> "질문"` → 질문 id(q숫자)가 나온다. 대표실 앞 줄에 서고 화면에 '답할 질문'이 뜬다.

**답은 사장님이 사무실 화면의 질문함에서 바로 보낸다.** 그래서 질문할 때는 AskUserQuestion 으로 막아 두지 않고:
1. 이 대화에 질문을 짧게 적는다: "q3 질문: … — 사무실 화면의 질문함에서 답하시거나 여기 답해 주세요."
2. 기다리기를 **백그라운드로** 실행한다(Bash `run_in_background`, 제한 시간 넉넉히):
   `node tools/office.mjs wait <질문id> --timeout 120`
   끝나면 이 대화가 다시 깨어난다. 출력(JSON)의 `status`:
   - `answered` → `answer`가 사장님 답이다.
   - `gone` → 이미 처리됨(대화에서 답을 받아 처리했을 수 있다). 넘어간다.
   - `timeout` → 아직 답이 없다. 사장님께 다시 알리고 같은 명령으로 또 기다린다.
3. 사장님이 화면 대신 **이 대화에** 답하거나 `[답변]` 블록을 붙여넣어도 같은 답으로 처리한다(그때는 `node tools/office.mjs reply <질문id> --text "답" --via chat`으로 기록).

답을 받으면 질문마다:
- `work/<작업이름>/answers.md`에 `질문id / 질문 / 답 / 받은 시각 / 받은 곳(화면·대화)`을 덧붙인다(직원은 brief 보다 이 파일을 우선한다).
- `node tools/office.mjs answer <질문id>` (줄에서 정리), 그 직원 상태를 `working`으로.
- 답 때문에 고칠 것이 있으면 그 직원을 다시 부르며 답을 그대로 전한다.
답을 지어내거나 대신 정하지 않는다. 기다리는 동안 답과 상관없는 다른 직원 일은 계속 진행해도 된다.

## 7. 보고
사장님께 아래만 짧게 보고한다. 꾸밈말 없이.
1. 한 줄 결론 (본부장 보고서의 결론 그대로)과 결재 흐름(팀장 반려 N회, 본부장 반려 N회, 사장님 결재 결과)
2. 직원별로 쓴 스킬과 브랜드 검사 결과(오류 0 / 경고 N), 빠진 스킬이 있으면 그 이름
3. 보고서 경로와 결과 파일 경로
4. 꼭 고칠 것 / 정해 주셔야 할 것
그 뒤 `node tools/office.mjs end director-<작업이름>`. 하루 업무를 마치면 `node tools/office.mjs day end`(불 끄기).

## 지킬 것
- 직원 결과를 "올렸다"고 말하지 않는다. 이 구조는 **원고와 시안까지**만 만든다. 네이버·인스타·스레드에 실제로 올리는 연결은 없다.
- 비서(이 대화)는 직급을 건너뛰지 않는다: 팀원 결과를 본부장에게 바로 주거나, 본부장 반려를 팀원에게 바로 전하지 않는다.
- 본부장 최종결재 없이 사장님 결재함에 올리지 않는다.
- 사무실 기록 명령이 실패하면 숨기지 말고 보고에 적는다.
