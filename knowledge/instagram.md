# 인스타그램
최종 확인: 2026-11-17 · 다음 확인: 2026-12-17

## 해시태그
- 게시물·릴스에 **해시태그 최대 5개**. 인스타그램 공식 @creators 계정이 2025-12-18 스레드에 "Starting today, Instagram will allow up to 5 hashtags in a reel or post"라고 발표했다. 적은 수의 맞춤 태그가 성과와 사용 경험에 낫다는 설명. [공식(요약) · threads.com/@creators 게시물 · 2026-11-17]
- 인스타 도움말 일부 페이지는 아직 예전 30개 기준이 남아 있다 → 우리는 **5개 이하**로 쓴다(RIAN.md 의 3~5개와 같다). [공식(요약) · help.instagram.com · 2026-11-17]

## API 게시 조건 (자동 게시)
- 그림은 **JPEG만** 된다(MPO·JPS 같은 확장 JPEG 안 됨). Meta 가 그림을 인터넷 주소에서 직접 가져간다. [공식(요약) · Meta 개발자 문서 Content Publishing · 2026-11-17]
- 캡션 최대 2,200자. 여러 장(캐러셀)은 최대 10장, 낱장에는 캡션이 붙지 않는다. [공식(요약) · Meta 개발자 문서 IG User Media · 2026-11-17]
- API 게시는 24시간에 50개(문서 한 곳은 100개). [공식(요약) · Meta 개발자 문서 · 2026-11-17]

## 릴스
- 촬영·편집은 최대 20분까지. 하지만 **3분 넘는 릴스는 팔로워가 아닌 사람에게 추천되지 않는다.** → 홍보용 릴스는 3분 이하(우리 기본 15~30초). [공식(요약) · help.instagram.com "Record a reel", creators.instagram.com FAQ · 2026-11-17]

## 피드 그림 비율
- 프로필 그리드가 정사각형에서 세로 3:4로 바뀌었고 3:4(1080×1440) 업로드를 받는다는 자료가 많다. 날짜는 자료마다 다르다. [보도 · 업계 가이드 다수 · 2026-11-17]
- 3:4 게시물은 광고(홍보하기)에 못 쓴다는 업계 자료가 있다. [미확인]
→ 그래서 그림 크기는 `knowledge/design-specs.md`의 기본값을 따른다.

## 광고 표시
- 협찬·수수료가 있으면 광고 표시(첫 줄 근처) → `knowledge/ad-disclosure.md`. 인스타 '유료 파트너십' 라벨의 최신 규칙은 원문을 열지 못했다. [미확인]

## 출처
- @creators 발표: https://www.threads.com/@creators/post/DSalXGPCWM4/new-hashtag-guidance-starting-today-instagram-will-allow-up-to-hashtags-in-a
- 해시태그 도움말: https://help.instagram.com/351460621611097
- Meta 게시 문서: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- 릴스 녹화: https://help.instagram.com/2720958398006062/ · 크리에이터 FAQ: https://creators.instagram.com/faq
- 3:4 그리드(업계): https://www.inro.social/blog/instagram-post-size
