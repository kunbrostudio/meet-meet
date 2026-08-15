# MEET MEET Step 6-M9-R2 Report

작성 시각: 2026-08-12 09:40 KST

## 변경 파일

- `src/pages/LandingPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M9R2_REPORT.md`

## Device Active State

- `LandingPage.tsx`의 `cameraReady`, `micReady`는 기존처럼 실제 `MediaStreamTrack` 상태를 기준으로 유지했다.
  - `hasReadyVideo(localMedia.stream)`
  - `hasReadyAudio(localMedia.stream)`
- `LandingControlBar`의 CAMERA/AUDIO 버튼은 각각 위 값이 true일 때만 `is-ready` 클래스를 받는다.
- `src/App.css`에서 `.landing-control-bar button.is-ready`를 magenta/pink active surface로 변경했다.
  - inactive hover: cyan 계열의 약한 밝기 증가
  - active: magenta/pink fill, white text/icon, subtle glow
  - active hover: magenta glow와 밝기만 소폭 증가
- CAMERA와 AUDIO는 서로 다른 `cameraReady`, `micReady` 값을 사용하므로 독립적으로 표시된다.

## Bottom Bar Cleanup

- 하단 `BROWSE GAMES` 버튼과 관련 prop인 `onBrowseGames`를 제거했다.
- 최종 하단 버튼 구조:
  - `CAMERA`
  - `AUDIO`
  - `JOIN CODE`
  - `CREATE ROOM`
- `.landing-control-bar`의 grid를 `repeat(4, minmax(0, 1fr))`로 변경해 desktop/mobile 모두 4개 버튼이 빈 공간 없이 같은 row를 나눠 갖도록 했다.
- audio coachmark 위치도 4분할 기준에 맞춰 `left: 25%`로 보정했다.

## Create Room Modal Scroll Structure

- Create Room Modal만 전용 구조로 분리했다.
  - `.landing-modal-header`: CREATE ROOM eyebrow, title, close button
  - `.landing-modal-scroll-body`: room/player/game/rule/device status fields
  - `.landing-modal-footer`: FACE CHECK, status/error message, CREATE ROOM CTA
- `.landing-join-panel form.landing-create-form`을 flex column으로 구성하고, scroll body에 `min-height: 0`, `overflow-y: auto`, `overscroll-behavior: contain`을 적용했다.
- footer는 `flex: 0 0 auto`와 opaque dark navy background, top border를 사용해 mobile에서 버튼이 내용과 겹치지 않도록 했다.
- mobile에서 modal은 `max-height: calc(100dvh - 24px)`, `width: min(100%, calc(100vw - 24px))`를 사용한다.
- mobile 내부 padding은 header/body/footer 각각 20px 전후로 유지했다.
- form input/select는 create form 안에서 `width: 100%`, `box-sizing: border-box`로 보정했다.
- modal open 중 background scroll을 막기 위해 `isCreateOpen || isJoinOpen`일 때 `document.body.style.overflow = 'hidden'`을 적용하고 cleanup에서 복원한다.

## 유지한 기능

- Intro/Games tab 구조 유지
- Media Hub 및 Camera ON/OFF 흐름 유지
- Audio 연결 흐름 유지
- Face Check 로직 유지
- Create Room / Join Code modal 기능 유지
- Setup 제거 흐름 유지
- LiveKit, room/session, game state, Ready/countdown/attacker selection 관련 코드 변경 없음

## 검증

- `npm run lint`
  - 통과
  - 기존 `src/pages/MeetingRoomPage.tsx`의 `react-hooks/exhaustive-deps` warning 1개는 유지됨
- `npm run build`
  - 통과
  - Vite chunk size warning은 build failure가 아님

## 수동 확인 필요

- 실제 브라우저에서 CAMERA OFF/ON 시 하단 CAMERA 버튼이 dark/cyan에서 magenta active로 즉시 전환되는지 확인
- 실제 브라우저에서 MIC OFF/ON 시 하단 AUDIO 버튼이 독립적으로 active 표시되는지 확인
- 375x667에서 Create Room Modal의 body scroll, Face Check, Create Room CTA 접근 확인
- 390x844에서 동일 modal overflow 확인
- desktop에서 Create Room Modal과 Join Code Modal의 기존 frame/X alignment 회귀 확인
