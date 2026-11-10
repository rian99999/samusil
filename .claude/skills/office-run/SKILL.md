---
name: office-run
description: AI 사무실 직원(네이버·인스타·스레드 마케터, 디자이너, 총괄 실장)에게 마케팅 일을 나눠 주고, 검수 보고서를 받아 사장님께 보고한다. "마케팅 해줘", "직원들한테 시켜", "/office-run 주제" 같은 요청에 사용.
---
# AI 사무실 업무 진행

이 대화(메인 세션)가 **업무 배정 담당**이다. 직원은 `.claude/agents/`의 서브에이전트다.
서브에이전트는 다른 서브에이전트를 부를 수 없으므로, 배정·순서·사무실 기록은 모두 여기서 한다.

| 층 | 직원(서브에이전트) | 만드는 파일 |
|---|---|---|
| 2F 디자인팀 | `designer` | `design.md` |
| 3F 네이버 블로그팀 | `naver-blog-marketer` | `naver.md` |
| 4F 인스타그램팀 | `instagram-marketer` | `instagram.md` |
| 5F 스레드팀 | `threads-marketer` | `threads.md` |
| 대표실 | `chief-reviewer` | `reports/<작업이름>.md` |

## 1. 일감 정리
- 주제, 대상 고객, 핵심 메시지, 사실 자료(가격·기간·주소 등), 금지 사항, 필요한 채널을 확인한다. 빠진 것이 있으면 사장님께 한 번에 묻는다(AskUserQuestion).
- 작업 이름 `<YYYY-MM-DD>-<짧은영문>`을 정하고 `work/<작업이름>/brief.md`에 정리한다. brief 에 없는 사실은 직원이 쓰지 못한다.

## 2. 출근 기록 (사무실 화면에 사람이 나타남)
```bash
node tools/office.mjs start chief-<작업이름> --role chief-reviewer
node tools/office.mjs start naver-<작업이름>   --role naver-blog-marketer --parent chief-<작업이름>
node tools/office.mjs start insta-<작업이름>   --role instagram-marketer  --parent chief-<작업이름>
node tools/office.mjs start threads-<작업이름> --role threads-marketer    --parent chief-<작업이름>
```
고르지 않은 채널은 빼고, 실장은 검수 전까지 `idle`로 둔다(`state chief-<작업이름> idle`).

## 3. 마케터 배정 (동시에)
고른 마케터들을 **한 번에 함께** 부른다. 각자에게 줄 내용: 작업 폴더 경로, 자기 id, "brief.md 를 읽고 너의 할 일대로 파일을 만들어라".
한 명이 끝날 때마다:
```bash
node tools/office.mjs state <id> reporting   # 만세 + 별
node tools/office.mjs end <id>               # 퇴근
```

## 4. 디자이너 배정 (마케터 다음)
마케터 원고의 사진 자리·카드뉴스 문구가 필요하므로 마케터가 끝난 뒤 `designer`를 부른다. 시작 전에 `start design-<작업이름> --role designer --parent chief-<작업이름>`, 끝나면 `reporting` → `end`.

## 5. 총괄 검수
```bash
node tools/office.mjs state chief-<작업이름> working
```
`chief-reviewer`에게 작업 폴더 경로를 주고 검수·보고서를 맡긴다. 끝나면 `state chief-<작업이름> reporting`.

## 6. 사장님 질문
직원·실장이 남긴 질문은 `node tools/office.mjs list`로 본다(대표실 앞 줄). AskUserQuestion 으로 한 번에 묻고, 답을 받으면 `node tools/office.mjs answer <질문id>`. 답 때문에 고칠 것이 있으면 해당 직원을 다시 부른다.

## 7. 보고
사장님께 아래만 짧게 보고한다. 꾸밈말 없이.
1. 한 줄 결론 (보고서의 결론 그대로)
2. 보고서 경로와 결과 파일 경로
3. 꼭 고칠 것 / 정해 주셔야 할 것
그 뒤 `node tools/office.mjs end chief-<작업이름>`. 하루 업무를 마치면 `node tools/office.mjs day end`(불 끄기).

## 지킬 것
- 직원 결과를 "올렸다"고 말하지 않는다. 이 구조는 **원고와 시안까지**만 만든다. 네이버·인스타·스레드에 실제로 올리는 연결은 없다.
- 실장 판정이 "다시 만들어야 함"이면 보고 전에 해당 직원을 한 번 다시 부른다.
- 사무실 기록 명령이 실패하면 숨기지 말고 보고에 적는다.
