---
name: post
description: 리안 홍보 글 하나를 빠르게 — 사장님이 한 줄로 말하면 인스타·스레드·네이버 글과 카드 그림을 만들고, 검수자 한 번 거쳐 초안을 보여 준 뒤, 사장님이 "올려"라고 하면 인스타·스레드에 올리고(vidIQ 연결) 네이버는 붙여넣기용으로 준다. "글 써줘", "인스타 올려줘", "홍보해줘", "/post 주제" 같은 평소 요청은 모두 이것으로. (여러 날·여러 채널 큰 캠페인만 office-run)
---
# /post — 쓰고, 보여 주고, 승인받고, 올린다

사장님은 휴대폰 Claude 앱(이 저장소의 클라우드 세션)에서 한 줄로 말한다. 컴퓨터·사무실 서버가 꺼져 있어도 된다.
**직급제(본부장·팀장·팀원)는 쓰지 않는다.** 이 대화가 직접 쓰고, `reviewer` 한 번만 부른다.

## 0. 준비 (매번, 짧게)
- Skill 도구로 `rian-brand` → `brand/RIAN.md`·`brand/facts.md`·`knowledge/house-rules.md` 확인.
- 사장님 말투: `voice-business` / `voice-daily` 중 맞는 것을 Skill 도구로 부른다(고객 안내·예약·가격 글 → business 쪽이 맞는지 각 스킬 설명으로 판단, `house-rules.md`의 "말투 고르기"가 있으면 그것). 불러지지 않으면 초안에 "말투 스킬 없음"이라고 알린다.
- 짧은 지시는 `knowledge/request-defaults.md`로 풀어 읽는다. **채널을 안 말했으면 인스타+스레드.** 네이버는 말했을 때만.
- 묻는 것은 `request-defaults.md` 3장("꼭 물어야 하는 것")에 걸릴 때만, **AskUserQuestion 한 번에 한 질문**, 선택지마다 `preview`에 실제 문구 예시.

## 1. 쓰기 — `work/<YYYY-MM-DD>-<영문>/`
- `instagram.md`: 첫 줄(질문/상황, 40자 안) · 본문 2~4줄(명도·채도·온도 근거) · 저장 유도 한 줄 · 해시태그 3~5개.
- `threads.md`: 글 1개 500자 안(이모지는 바이트로 셈), 주제 태그 1개.
- `naver.md`(요청 시): 제목 3안 · 첫 문장 지역+업종 · 소제목 3~5개 · 예약 안내 · 태그 10개 · `[사진 n: 무엇]` 자리.
- 협찬·수수료 글이면 첫 줄(블로그는 제목 또는 첫 문단)에 광고 표시(`knowledge/ad-disclosure.md`).
- 사실은 facts·house-rules·사장님 말에 있는 것만. 없으면 `[확인 필요]` — 지어내지 않는다.
- `node tools/brand-check.mjs work/<작업>/*.md` → 오류 0 될 때까지 고친다.

## 2. 그림 (인스타는 필수, 스레드는 선택)
`work/<작업>/cards.json`을 쓰고 `node tools/card.mjs work/<작업>/cards.json` → `images/card-N.jpg`(1080×1350 JPEG) + `images/sheet.png`.
- 3~5장. 첫 장 `"style":"mist"`, 나머지 `"raw"`. Tourmaline(`accent`)은 마지막 장 예약 안내 한 곳만. 카드 글자는 원고와 같은 문장.
- 사장님이 사진을 주면 그 사진을 쓴다(필터·보정 금지, 얼굴은 동의받은 것만).

## 3. 검수 한 번
`reviewer` 서브에이전트에 작업 폴더를 준다. `고칠 것`이면 고치고 brand-check 를 다시 돌린 뒤 **한 번 더만** 부른다. 그래도 남으면 그대로 사장님께 보여 주며 남은 점을 적는다.

## 4. 초안 보여 주기 (승인 전에는 아무것도 올리지 않는다)
- `SendUserFile`로 `images/sheet.png`(한눈에 보기)를 보낸다(display: render).
- 답장에 채널별 글 전문을 **그대로** 보여 준다(복사해 쓸 수 있게 코드블록 없이 인용 형식). 맨 끝에: "올릴까요? '올려' / 고칠 점을 말씀해 주세요. 예약하려면 '내일 오전 10시에 올려'."
- 인스타·스레드 계정 연결 상태를 같이 알린다(아래 5-0).

## 5. "올려" — 사장님이 이 초안을 보고 승인했을 때만
### 5-0. 계정 확인
- 리안 가게 인스타: **@rian.color_makeup** (platformAccountId `29138448142481400`, 2026-11-25 연결). 이 계정에만 올린다. 목록에 다른 인스타 계정이 보이면 올리지 말고 사장님께 확인한다.
- vidIQ 요금제상 인스타 계정은 1개만 연결된다.
`mcp__vidIQ__vidiq_social_account_list` → 인스타그램·스레드에 `canPublish: true`인 계정이 있어야 한다.
- 없으면: "인스타(또는 스레드) 연결이 필요합니다"라고 말하고 사장님이 원하면 `vidiq_social_account_connect`(platform INSTAGRAM / THREADS, oauth). 받은 연결 링크·화면을 보여 주고 사장님이 끝낼 때까지 기다린 뒤 다시 확인. **연결 링크를 대신 열지 않는다.**
- vidIQ 도구가 이 세션에 없으면: 5-3(손으로 올리기)으로 간다.
### 5-1. 그림 올리기 → 초안 만들기
- 그림마다: `vidiq_upload_image`(image 없이) → 받은 uploadUrl 로 `curl -sS -X PUT --data-binary @work/<작업>/images/card-N.jpg "<uploadUrl>"` → 같은 도구에 transferId → imageId. 한 장당 한 번만(실패하면 사장님께 알리고 다시).
  - 업로드 주소가 이 환경 네트워크에서 막히면: 사장님께 그림을 첨부해 달라고 하거나 `vidiq_file_upload`로 고르게 한다.
- `vidiq_social_post_draft_create`: destinations = 인스타(text=instagram.md 의 캡션, media=카드들), 스레드(text=threads.md, topicTag, 그림은 선택). 예약이면 publishAt(Asia/Seoul, +09:00).
- 결과에 거절(refused) 이유가 있으면 `vidiq_social_post_draft_update`로 고친다(새 초안 만들지 않음).
### 5-2. 마지막 확인 → 게시
- 바뀐 것이 있으면 다시 보여 주고 승인을 받는다. 승인 후 `vidiq_social_post_publish`(그 revision). 
- `vidiq_social_post_status`로 결과 확인 → 게시물 주소를 알린다. `work/<작업>/posted.md`에 채널·시각·주소를 적는다.
### 5-3. 손으로 올리기 (연결 전·네이버)
- 인스타·스레드: 글 전문 + `SendUserFile`로 card-1…N.jpg(display: attach)를 보내 휴대폰에 저장하게 한다.
- 네이버 블로그: 자동 게시 불가(네이버 글쓰기 API 종료). 제목 → 본문(사진 자리마다 "여기에 card-N") → 태그 순서로 보여 주고 그림을 보낸다.
- 사장님이 "올렸어"라고 하면 `posted.md`에 '손으로 올림'으로 적는다.

## 6. 끝
`git add work/<작업> && git commit -m "글: <주제>"` 후 이 브랜치에 push(기록 보관). 커밋 메시지에 고객 정보·계좌번호를 넣지 않는다.

## 지킬 것
- 사장님의 "올려"(또는 같은 뜻) 없이 `vidiq_social_post_publish`를 부르지 않는다. 처음 요청("써서 올려줘")은 승인으로 치지 않는다 — 초안을 본 뒤의 답만 승인이다.
- 한 번 올린 글은 여기서 지울 수 없다고 미리 말한다(지우기는 앱에서).
- 계좌번호는 어디에도 쓰지 않는다.
