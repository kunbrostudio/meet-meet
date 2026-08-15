# MEET MEET Step 6-M10-A-R2 Report

작성 시각: 2026-08-12 12:03 KST

## 변경 파일

- `src/pages/LandingPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M10A_R2_REPORT.md`

## Create Room Gate Feedback 목적

- 기존 정책은 유지했다.
  - Camera OFF 상태에서 `CREATE ROOM` 클릭 시 Create Room Modal은 열리지 않는다.
  - `CREATE ROOM` 클릭은 camera/microphone을 자동으로 켜지 않는다.
  - `getUserMedia`는 명시적인 `CAMERA`/`AUDIO` 버튼 클릭에서만 실행된다.
- 이번 작업은 gate가 걸렸을 때 사용자가 원인을 즉시 이해하도록 피드백만 강화했다.

## Tooltip / Speech-Bubble 안내 방식

- `LandingControlBar` 내부에 `landing-camera-gate-notice`를 추가했다.
- 안내 메시지는 하단 toolbar 안에서 `CREATE ROOM` 버튼 근처 위쪽에 뜬다.
- 표시 문구:
  - `카메라를 먼저 연결해 주세요.`
  - `연결 후 방 만들기가 가능해요.`
- 안내는 3초 후 자동으로 사라진다.
- Camera가 연결되면 렌더링 기준으로 안내가 즉시 숨겨지고, 다음 `CREATE ROOM` 클릭 시 정상 modal open 흐름으로 이동한다.

## Camera/Audio Pulse 재실행 처리 방식

- `cameraGateFeedbackToken` state를 추가했다.
- Camera OFF 상태에서 `CREATE ROOM`을 클릭할 때마다 token을 증가시킨다.
- CAMERA/AUDIO 버튼과 안내 말풍선에 token 기반 `key`를 부여해 같은 메시지가 이미 떠 있어도 매 클릭마다 remount되고 animation이 다시 실행된다.
- 강조 강도:
  - CAMERA: `landingCameraGatePulse`, magenta glow + scale pulse 3회
  - AUDIO: `landingAudioGatePulse`, 더 약한 cyan glow pulse 2회
- CAMERA 버튼은 기존 coachmark animation과 겹칠 수 있어 `.is-gated.is-coached`가 gate pulse를 우선하도록 CSS를 보정했다.

## Desktop/Mobile 테스트 결과

코드 기준 확인:

- Camera OFF -> `CREATE ROOM` 클릭:
  - modal open 없음
  - camera 자동 연결 없음
  - 안내 말풍선 표시
  - CAMERA/AUDIO pulse class 적용
- Camera OFF -> `CREATE ROOM` 연속 클릭:
  - token 증가로 message/button animation 재실행
  - timeout은 token dependency로 갱신됨
- Camera ON -> `CREATE ROOM` 클릭:
  - gate message hidden
  - Create Room Modal open
  - pulse class 미적용
- Mobile:
  - 안내는 toolbar의 absolute positioned speech-bubble로, toolbar 자체를 가리지 않고 위쪽에 표시되도록 구성
  - width는 `min(282px, calc(100% - 8px))`로 제한해 좁은 화면 overflow를 피함

## 검증

- `npm run lint`
  - 통과
  - 기존 `src/pages/MeetingRoomPage.tsx`의 `react-hooks/exhaustive-deps` warning 1개는 유지됨
- `npm run build`
  - 통과
  - Vite chunk size warning은 build failure가 아님
