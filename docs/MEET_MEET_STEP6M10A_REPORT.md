# MEET MEET Step 6-M10-A Report

작성 시각: 2026-08-12 10:31 KST

## 변경 파일

- `src/pages/LandingPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M10A_REPORT.md`

## 기존 Create Room Flow

- 기존 하단 `CREATE ROOM` 버튼은 카메라 상태와 무관하게 `setIsCreateOpen(true)`로 Create Room Modal을 즉시 열었다.
- Create Modal의 최종 submit은 `ensureReadyToEnter()`를 사용해 camera, microphone, Face Check를 모두 요구했다.
- Create Modal 안에는 `FACE CHECK` 상태, `FACE CHECK` 버튼, Face Check 진행/실패 메시지가 함께 표시됐다.

## Camera Gate 구조

- 하단 `CREATE ROOM` 버튼은 이제 `openCreateRoom`을 실행한다.
- 실제 camera source of truth는 기존과 동일하게 `hasReadyVideo(localMedia.stream)` 기반의 `cameraReady`다.
- camera가 이미 active이면 permission을 다시 요청하지 않고 modal을 즉시 연다.
- camera가 off이면:
  - `CONNECTING` pending state로 버튼 중복 클릭을 막는다.
  - `먼저 카메라를 연결할게요.` 안내를 표시한다.
  - camera start 성공 시 media view를 `camera`로 전환하고 modal을 자동으로 연다.
  - camera start 실패 시 modal을 열지 않고 `카메라 연결이 필요합니다. 다시 시도해 주세요.` 안내를 표시한다.

## 기존 Camera Start Logic 재사용

- 기존 `toggleCamera` 안에 있던 camera start 로직을 `startCamera`로 분리했다.
- `toggleCamera`는 camera가 on이면 기존처럼 `stopCamera`, off이면 `startCamera`를 호출한다.
- `openCreateRoom`도 동일한 `startCamera`를 사용하므로 getUserMedia 로직을 중복 생성하지 않았다.

## Permission Denied 처리

- `startCamera` 실패 시 기존 `getDeviceErrorStatus` 흐름을 유지한다.
- permission denied, device not found, 기타 error에 따라 기존 `mediaError` 메시지가 설정된다.
- Create Room gate는 실패 시 room modal을 열지 않고, room API도 호출하지 않는다.
- `window.alert()`는 사용하지 않았다.

## Camera Stream과 Main Media Mode 분리

- Camera Gate 판단 기준은 중앙 Media Hub가 intro인지 camera인지가 아니라 실제 video track live 상태다.
- camera가 이미 on이고 intro view를 보고 있어도 modal은 바로 열린다.
- camera가 off였고 Create Room 클릭으로 연결에 성공한 경우에는 `mediaMode = 'camera'`로 전환한다.

## Face Check 제거 범위

- Create Room Modal에서 제거한 항목:
  - `FACE READY / CHECK` device status
  - `FACE CHECK` 버튼
  - Face Check 진행 메시지
  - Face Check helper/error message
- Create submit에서는 더 이상 Face Check 통과 여부를 요구하지 않는다.
- Fair Play, face detection, laugh detection 관련 서비스와 game room 기능은 삭제하거나 변경하지 않았다.
- Join Code Modal의 기존 Face Check UI는 이번 Step의 주 대상이 아니므로 대규모 변경하지 않았다.

## Mic이 Create Gate가 아닌 이유

- 이번 Step 요구에 따라 Create Room의 필수 조건은 camera만 남겼다.
- `Camera ON / Mic OFF` 상태에서도 Create Room Modal을 열 수 있고, 최종 room 생성도 가능하다.
- microphone 검증은 이후 Pre-Game Fair Play Calibration 단계에서 다룰 수 있도록 남겨뒀다.

## Desktop 테스트

코드 기준 확인:

- Camera OFF -> CREATE ROOM -> `startCamera()` 성공 시 modal 자동 open
- Camera ON -> CREATE ROOM -> getUserMedia 재호출 없이 modal open
- Camera permission 실패 -> modal open 안 됨, room API 호출 안 됨
- Create Modal X close -> camera를 자동으로 끄지 않음
- Create Modal에는 CAMERA/MIC 상태와 CREATE ROOM CTA만 유지

## Mobile 테스트

수동 확인 권장:

- 375x667: Camera OFF -> CREATE ROOM -> permission -> modal open
- 390x844: Create Modal header/body/footer scroll 구조 유지
- Face Check 제거 후에도 `PLAYERS`, `LIFE`, `ATTACK TIME`, device status, `CREATE ROOM` CTA 접근 가능
- horizontal overflow 없음

## 검증

- `npm run lint`
  - 통과
  - 기존 `src/pages/MeetingRoomPage.tsx`의 `react-hooks/exhaustive-deps` warning 1개는 유지됨
- `npm run build`
  - 통과
  - Vite chunk size warning은 build failure가 아님

## 다음 Step

- GAME START 이후 Pre-Game Fair Play Calibration 흐름에서 face, mouth visibility, neutral expression, smile calibration을 실제 게임 시작 전에 동기화하는 구조를 설계한다.
