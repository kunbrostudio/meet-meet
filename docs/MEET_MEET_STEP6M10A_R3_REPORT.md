# MEET MEET Step 6-M10-A-R3 Report

작성 시각: 2026-08-12 12:17 KST

## 변경 파일

- `src/pages/LandingPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M10A_R3_REPORT.md`

## 기존 문제 요약

- R2의 camera gate 안내는 `landing-control-bar` 안에 별도 자식으로 렌더링됐다.
- absolute positioning을 쓰고 있었지만 구조상 toolbar grid 내부에 메시지가 끼어든 형태라 CREATE ROOM 버튼에 anchor된 tooltip처럼 보이지 않았다.
- 사용자에게 원인은 전달됐지만, 버튼 사이에 박스가 들어간 듯한 어색한 시각 표현이 있었다.

## Tooltip Redesign 방식

- `CREATE ROOM` 버튼을 `.landing-create-slot` wrapper로 감쌌다.
- 안내 메시지는 `.landing-create-slot` 내부의 floating tooltip인 `.landing-camera-gate-notice`로 이동했다.
- tooltip은 toolbar layout flow에 참여하지 않는 `position: absolute` 요소로 렌더링된다.
- bubble background는 CTA 계열 pink gradient를 사용했다.
- 작은 pointer triangle을 `::after`로 추가해 CREATE ROOM 버튼을 가리키는 말풍선처럼 보이게 했다.
- 메시지 문구:
  - `왼쪽 CAMERA 버튼을 눌러 카메라를 연결하세요.`
  - `연결 후 방 만들기가 가능해요.`

## Anchor 위치 기준

- 기준 anchor: `.landing-create-slot`
- 배치:
  - `right: 0`
  - `bottom: calc(100% + 12px)`
- bubble은 CREATE ROOM 버튼 바로 위에 떠 있고, 버튼 자체를 가리지 않는다.
- width는 `min(300px, calc(100vw - 28px))`로 제한해 mobile viewport에서도 화면 밖으로 나가지 않도록 했다.

## Pulse 재실행 처리 방식

- R2에서 추가한 `cameraGateFeedbackToken` 방식을 유지했다.
- Camera OFF 상태에서 CREATE ROOM을 누를 때마다 token이 증가한다.
- CAMERA 버튼, AUDIO 버튼, tooltip에 token 기반 `key`를 적용해 매 클릭마다 animation이 다시 실행된다.
- CAMERA는 강한 magenta pulse, AUDIO는 보조 cyan pulse를 유지했다.

## Desktop/Mobile 테스트 결과

코드 기준 확인:

- Camera OFF -> CREATE ROOM:
  - modal open 없음
  - camera 자동 연결 없음
  - CREATE ROOM 버튼 위 floating bubble 표시
  - CAMERA/AUDIO pulse 실행
- Camera OFF -> CREATE ROOM 반복 클릭:
  - token 증가로 tooltip과 pulse가 매번 재실행
  - 기존 timer가 cleanup되고 다시 3초 표시
- Camera ON -> CREATE ROOM:
  - tooltip 없음
  - Create Room Modal 정상 open
- Mobile 375x667 / 390x844:
  - tooltip width가 viewport 기준으로 제한됨
  - toolbar grid를 밀지 않음
  - bubble은 pointer-events none으로 버튼 탭을 막지 않음

## 검증

- `npm run lint`
  - 통과
  - 기존 `src/pages/MeetingRoomPage.tsx`의 `react-hooks/exhaustive-deps` warning 1개는 유지됨
- `npm run build`
  - 통과
  - Vite chunk size warning은 build failure가 아님
