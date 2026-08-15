# MEET MEET Step 6-M10-A-R6 Report

작성 시각: 2026-08-12 14:24 KST

## 변경 파일

- `src/pages/LandingPage.tsx`
- `docs/MEET_MEET_STEP6M10A_R6_REPORT.md`

## JOIN CODE Guard 정책 적용 내용

- `JOIN CODE` 버튼은 이제 camera와 audio가 모두 준비된 경우에만 Join Code Modal을 연다.
- camera 또는 audio 중 하나라도 준비되지 않으면:
  - Join Code Modal을 열지 않는다.
  - camera/audio를 자동 연결하지 않는다.
  - JOIN CODE 버튼 위 fixed speech bubble tooltip을 표시한다.
  - CAMERA/AUDIO 버튼에 pink 계열 pulse 강조를 실행한다.

## Camera/Audio 준비 조건

- camera 준비 기준:
  - 기존 `hasReadyVideo(localMedia.stream)` 유지
  - 실제 live/enabled video track 기준
- audio 준비 기준:
  - 기존 `hasReadyAudio(localMedia.stream)` 유지
  - 실제 live/enabled audio track 기준
- Create Room:
  - camera만 gate
  - audio off여도 Create Room 가능
- Join Code:
  - camera + audio 모두 gate
  - 둘 중 하나라도 off이면 Join Code Modal open 차단

## Tooltip 재사용 / 분리 구조

- 기존 Create Room gate tooltip state를 확장해 JOIN CODE도 같은 floating tooltip 구조를 재사용한다.
- 추가된 state:
  - `cameraGateDetail`
  - `cameraGateRequiresAudio`
- `cameraGateRequiresAudio`가 true인 JOIN gate에서는 camera와 mic가 모두 준비되어야 tooltip이 숨겨진다.
- Create Room gate에서는 기존처럼 camera만 준비되면 tooltip이 숨겨진다.
- tooltip 위치는 클릭한 버튼의 DOMRect 기준으로 계산하므로 CREATE ROOM/JOIN CODE 각각 자기 버튼 위에 표시된다.

## Highlight Animation 적용 방식

- `cameraGateFeedbackToken`을 기존처럼 유지했다.
- gate 클릭마다 token이 증가해 CAMERA/AUDIO 버튼 key가 바뀌고 pulse animation이 재실행된다.
- CAMERA/AUDIO 모두 pink 계열 pulse를 사용한다.
- AUDIO의 green/cyan처럼 따로 노는 강조색은 R4에서 정리된 pink 계열을 유지했다.

## Desktop/Mobile 테스트 결과

코드 기준 확인:

- Camera OFF / Audio OFF -> JOIN CODE:
  - modal open 없음
  - tooltip 표시
  - CAMERA/AUDIO pulse
  - 자동 연결 없음
- Camera ON / Audio OFF -> JOIN CODE:
  - modal open 없음
  - tooltip 표시
  - CAMERA/AUDIO pulse
- Camera OFF / Audio ON -> JOIN CODE:
  - modal open 없음
  - tooltip 표시
  - CAMERA/AUDIO pulse
- Camera ON / Audio ON -> JOIN CODE:
  - Join Code Modal open
- 반복 클릭:
  - token 증가로 tooltip과 pulse가 매번 재실행
- Mobile:
  - 기존 fixed tooltip positioning과 viewport clamp 구조를 그대로 사용하므로 footer clipping을 피한다.

## 검증

- `npm run lint`
  - 통과
  - 기존 `src/pages/MeetingRoomPage.tsx`의 `react-hooks/exhaustive-deps` warning 1개는 유지됨
- `npm run build`
  - 통과
  - Vite chunk size warning은 build failure가 아님
