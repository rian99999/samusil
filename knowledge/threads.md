# 스레드 (Threads)
최종 확인: 2026-11-17 · 다음 확인: 2026-12-17

- 글 하나 **500자**까지. 이모지는 UTF-8 바이트 수만큼 센다(한 개가 여러 자로 계산될 수 있음). [공식(요약) · Meta 개발자 문서 Threads Posts · 2026-11-17]
- 긴 글은 **텍스트 첨부**로 최대 10,000자. 글자만 있는 게시물에서만 되고(투표와 함께 안 됨), 링크 하나를 넣을 수 있다. [공식(요약) · Meta 개발자 문서 Text Attachments · 2026-11-17]
- **주제 태그는 게시물당 1개**(1~50자). 여러 개를 써도 첫 번째 유효한 태그만 쓰인다. 마침표·&는 못 쓴다. [공식(요약) · Meta 개발자 문서 Threads Posts · 2026-11-17]
- 서로 다른 링크가 **5개를 넘으면** 게시가 실패한다(2025-12-22부터). [공식(요약) · Meta 개발자 문서 · 2026-11-17]

- API 게시는 24시간에 250개. 그림은 공개 주소에서 Meta 가 가져가고, 게시 전 평균 30초 기다리기를 권한다. [공식(요약) · Meta 개발자 문서 Threads API · 2026-11-17]
- 타래(앞 글에 이어 달기)를 API 로 하는 방법은 문서에서 확인하지 못했다. 그래서 자동 게시는 글 1개만 한다. [미확인]

## 우리 작업에 적용
- 단독 글은 500자 안(RIAN 기준 더 짧게), 타래는 글마다 500자 안.
- 주제 태그는 1개만 제안한다.
- 협찬·수수료 글이면 첫 글 첫 줄에 광고 표시 → `knowledge/ad-disclosure.md`.

## 출처
- https://developers.facebook.com/documentation/threads/posts
- https://developers.facebook.com/documentation/threads/create-posts/text-attachments.md
