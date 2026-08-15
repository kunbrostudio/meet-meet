# MEET MEET Step 6-M10-A-R4 Report

작성 시각: 2026-08-12 12:30 KST

## 변경 파일

- `src/pages/LandingPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M10A_R4_REPORT.md`

## 이전 Tooltip이 보이지 않았던 원인

- R3 tooltip은 `landing-control-bar` 내부 또는 CREATE 버튼 주변 DOM에 묶인 absolute element였다.
- 하단 toolbar는 arcade frame을 위해 `clip-path`와 자체 stacking context를 사용한다.
- 이 구조에서는 button 위로 떠야 하는 tooltip이 parent frame에 잘리거나 실제 화면에서 거의 보이지 않을 수 있었다.

## 최종 Tooltip 렌더링 구조

- `CREATE ROOM` 버튼 클릭 이벤트의 `event.currentTarget.getBoundingClientRect()`로 버튼 위치를 계산한다.
- 계산한 좌표를 `cameraGateTooltipPosition` state에 저장한다.
- tooltip은 `nav`/toolbar 내부가 아니라 `LandingControlBar` fragment의 별도 sibling으로 렌더링한다.
- CSS는 `position: fixed`를 사용해 toolbar의 `clip-path`/overflow 영향에서 벗어나도록 했다.

## Position / Overflow / Z-index 처리 방식

- 기준 위치:
  - `left`: CREATE ROOM 버튼 중심 기준으로 tooltip width 300px을 viewport 안에 clamp
  - `top`: CREATE ROOM 버튼 상단에서 12px 위
  - tooltip 자체는 `transform: translateY(-100%)`로 버튼 위에 배치
- viewport 보호:
  - width: `min(300px, calc(100vw - 28px))`
  - 좌우 margin clamp 적용
- z-index:
  - `.landing-camera-gate-notice { z-index: 80; }`
- pointer:
  - CSS custom property `--tooltip-arrow-left`로 triangle tail이 CREATE ROOM 버튼 중심을 향하게 했다.

## CAMERA/AUDIO Pulse 컬러 수정

- CAMERA pulse는 기존 magenta 계열 강조를 유지했다.
- AUDIO pulse는 cyan/green처럼 보이던 강조를 제거하고 magenta/pink 계열로 통일했다.
- 두 버튼 모두 gate feedback 때 같은 포인트 컬러 계열로 보이며, CAMERA가 더 강한 pulse, AUDIO가 보조 pulse 역할을 한다.

## Desktop/Mobile 테스트 결과

코드 기준 확인:

- Camera OFF -> CREATE ROOM:
  - modal open 없음
  - camera/audio 자동 연결 없음
  - fixed tooltip이 CREATE ROOM 버튼 바로 위에 표시
  - CAMERA/AUDIO 모두 pink 계열 pulse 실행
- Camera OFF -> CREATE ROOM 반복:
  - `cameraGateFeedbackToken` 증가로 tooltip과 pulse가 매번 재실행
  - timer는 token dependency로 reset
- Camera ON -> CREATE ROOM:
  - tooltip position/message clear
  - Create Room Modal open
- Mobile 375x667 / 390x844:
  - tooltip width가 viewport 기준으로 제한됨
  - fixed positioning으로 footer toolbar clipping을 피함
  - pointer-events none으로 버튼 tap을 막지 않음

## 검증

- `npm run lint`
  - 통과
  - 기존 `src/pages/MeetingRoomPage.tsx`의 `react-hooks/exhaustive-deps` warning 1개는 유지됨
- `npm run build`
  - 통과
  - Vite chunk size warning은 build failure가 아님
