# MEET MEET Step 6-M10-A-R5 Report

작성 시각: 2026-08-12 14:00 KST

## 변경 파일

- `src/App.css`
- `docs/MEET_MEET_STEP6M10A_R5_REPORT.md`

## Tooltip Tail 문제 원인

- 기존 tooltip tail은 `::after`에 14px 회전 사각형을 붙이는 방식이었다.
- 이 방식은 말풍선 body의 layered navy/glow surface와 tail 배경/테두리가 따로 보일 수 있고, 회전된 정사각형의 면이 그대로 드러나 tail만 별도 박스처럼 보이는 문제가 있었다.

## Tail 구현 방식

- 수정 전:
  - `::after`
  - 14px rotated square
  - 별도 background, right/bottom border
- 수정 후:
  - `::before`: cyan border 역할의 outer triangle
  - `::after`: navy fill 역할의 inner triangle
  - `border-left/right: transparent`, `border-top` 기반 triangle

## Body/Tail 색상 및 Border 일치 처리

- tooltip body에 CSS 변수 추가:
  - `--gate-tooltip-surface: rgba(3, 9, 24, 0.98)`
  - `--gate-tooltip-border: rgba(34, 230, 242, 0.56)`
- body background의 base layer와 tail fill이 같은 `--gate-tooltip-surface`를 사용한다.
- body border와 tail outer triangle이 같은 `--gate-tooltip-border` 계열을 사용한다.
- rotated square를 제거해 tail 뒤의 불필요한 사각형 흔적을 없앴다.

## Desktop/Mobile 확인 결과

코드 기준 확인:

- Camera OFF -> CREATE ROOM:
  - tooltip body와 tail이 같은 navy/cyan tone으로 연결됨
  - tail square artifact 없음
- 반복 클릭:
  - 기존 token 기반 재노출/animation 구조 유지
- Desktop/Mobile:
  - fixed tooltip 위치, 크기, pointer direction 변경 없음
  - tail만 triangle 방식으로 교체되어 layout 영향 없음

## 검증

- `npm run lint`
  - 통과
  - 기존 `src/pages/MeetingRoomPage.tsx`의 `react-hooks/exhaustive-deps` warning 1개는 유지됨
- `npm run build`
  - 통과
  - Vite chunk size warning은 build failure가 아님
