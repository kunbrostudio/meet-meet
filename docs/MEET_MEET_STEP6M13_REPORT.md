# MEET MEET Step 6-M13 Report

## 목적

Game Room header 정렬과 small angular UI의 corner/border clipping을 보정했다. 이번 변경은 UI polish에 한정했고 room entry, Ready sync, Game Start 조건, Chat, LiveKit, attack/laugh/life/game-over 로직은 변경하지 않았다.

## 변경 파일

- `src/App.css`
- `docs/MEET_MEET_STEP6M13_REPORT.md`

## 헤더 구조 수정 사항

- Game Room header의 DOM 순서는 유지했다.
- CSS에서 room title이 남은 공간을 모두 차지하던 값을 줄여 room code가 방 제목 바로 옆에 붙도록 정리했다.
- room code 뒤쪽은 `margin-right: auto`로 분리해 participant count와 connection status가 오른쪽 HUD 그룹처럼 보이게 했다.
- mobile에서는 max-width와 margin을 줄여 과도한 overflow가 생기지 않도록 했다.

## Room Code 위치 이동

- 기존 위치 문제는 `meeting-header-main > strong`이 `flex: 1 1 auto`로 남은 공간을 차지해 `MMT-...` 버튼이 멀리 밀리는 구조에서 발생했다.
- `meeting-header-main > strong`을 `flex: 0 1 auto`로 조정하고 room code wrapper를 제목 바로 다음에 붙였다.

## 제거한 수평 라인

- 헤더 중앙의 불필요한 가로 라인은 `.meeting-page .meeting-header::after`에서 생성되고 있었다.
- Step 6-M13 override에서 해당 pseudo-element를 `display: none` 처리했다.

## Corner / Border Clipping 보정 방식

- 작은 chip, badge, button류에 직접 border + clip-path가 적용되면서 cut corner 근처 선이 끊겨 보일 수 있었다.
- Step 6-M13에서는 pseudo-element mask outline 방식을 추가해 neon outline이 요소 내부에서 연속적으로 보이도록 보정했다.
- `mask-composite` 미지원 환경에서는 기존 box-shadow/inset 기반 outline으로 fallback되도록 했다.
- Game Board header, ready panel, chat input, chat bubble, upload/status panel에는 inset outline을 추가해 frame edge가 더 안정적으로 보이게 했다.

## 공통 Angular Frame 정리 여부

- 별도 component나 새 utility 파일은 만들지 않았다.
- 현재 polish 범위에서는 `src/App.css`의 Step 6-M13 override에서 공통 selector 그룹으로 chip/button/badge corner 처리를 묶어 중복을 줄였다.

## 테스트 결과

- Header: 중앙 수평 라인 제거, room code가 room title 옆에 위치하도록 CSS 조정.
- Header chips: room code, participant count, connection status, time, LIVE badge에 corner outline 보정 적용.
- Game Board: header, ready/action row, buttons, chat bubbles, input wrapper, send button에 corner outline 보정 적용.
- Side panels: participant card와 waiting slot은 기존 M12의 outer frame + inner surface 구조를 유지.

## lint/build 결과

- `npm run lint`: 통과. 기존 `src/pages/MeetingRoomPage.tsx:4252`의 `react-hooks/exhaustive-deps` warning 1건이 남아 있으나 error는 없음.
- `npm run build`: 통과. 기존 Vite chunk-size warning만 발생했고 build failure는 아님.
