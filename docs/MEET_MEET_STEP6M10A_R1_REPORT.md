# MEET MEET Step 6-M10-A-R1 Report

작성 시각: 2026-08-12 11:52 KST

## 변경 파일

- `src/pages/LandingPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M10A_R1_REPORT.md`

## 잘못된 Auto Camera Flow

- 이전 Step 6-M10-A에서는 하단 `CREATE ROOM` 클릭 시 camera가 off이면 `openCreateRoom -> startCamera()`가 실행됐다.
- 이 흐름은 `CREATE ROOM` 클릭만으로 `getUserMedia({ video })` permission request를 발생시키고, camera 성공 후 Create Modal을 자동으로 열었다.
- MEET MEET의 장치 동의 원칙상 camera/microphone은 사용자가 직접 `CAMERA`/`AUDIO` 버튼을 눌렀을 때만 활성화되어야 하므로 이 자동 연결 흐름을 제거했다.

## 제거한 Auto getUserMedia 호출

- `openCreateRoom`에서 `startCamera()` 호출을 제거했다.
- `startCamera()`는 여전히 존재하지만, 호출 경로는 명시적인 `CAMERA` 버튼의 `toggleCamera()` 내부로 제한했다.
- `CREATE ROOM`, `JOIN CODE`, `JOIN ROOM`, modal open 흐름에서는 camera/mic permission request를 발생시키지 않는다.

## Manual Camera Consent 원칙

- `CAMERA` 버튼:
  - camera off -> 사용자가 직접 클릭 -> browser permission -> camera stream 생성
  - camera on -> 사용자가 직접 클릭 -> video track stop
- `AUDIO` 버튼:
  - mic off -> 사용자가 직접 클릭 -> browser permission -> audio track 생성
  - mic on -> 사용자가 직접 클릭 -> audio track stop
- Create/Join 관련 버튼은 장치 상태를 검사만 하고 자동으로 장치를 켜지 않는다.

## Create Room Camera Gate

- Camera ON:
  - `CREATE ROOM` 클릭 시 Create Modal을 즉시 연다.
  - permission dialog를 다시 띄우지 않는다.
- Camera OFF:
  - Create Modal을 열지 않는다.
  - room API를 호출하지 않는다.
  - camera를 자동으로 켜지 않는다.
  - `게임방을 만들려면 카메라를 먼저 연결해 주세요.` 안내만 표시한다.
- gate 안내가 표시되는 동안 하단 `CAMERA` 버튼에 짧은 pulse 강조를 적용했다.

## Join Room Camera Gate

- `JOIN CODE` modal 자체는 camera off 상태에서도 열 수 있다.
- 최종 `JOIN ROOM` submit 시 실제 live video track 기준으로 camera를 검사한다.
- Camera OFF이면:
  - join을 차단한다.
  - camera를 자동으로 켜지 않는다.
  - `게임방에 참여하려면 카메라를 연결해 주세요.` 안내를 표시한다.
- Camera ON / Mic OFF 상태에서는 join을 진행할 수 있다.

## Camera/Mic 사용자 제어 정책

- Camera 필수 대상:
  - Create Room modal open
  - Join Room submit
- Microphone은 이번 단계에서 Create/Join gate가 아니다.
- Face/Mouth/Smile 검사는 pre-room lobby/modal에서 실행하지 않고, 이후 game start 직전 calibration 단계로 이동할 예정이다.

## Face Check 제거 범위

- Landing/Create/Join의 pre-room Face Check 실행 진입점을 제거했다.
- `Create Room Modal`에는 Face badge, Face Check button, Face helper가 없다.
- `Join Code Modal`에서도 Face badge/button을 제거해 실제 room 참여 전 검사가 camera gate로만 동작하게 했다.
- Game room의 Fair Play, laugh detection, life/game over 로직은 변경하지 않았다.

## Desktop/Mobile 테스트

수동 확인 권장:

- Desktop: Camera OFF -> CREATE ROOM -> permission dialog 없음, modal 없음, camera 안내 표시
- Desktop: 안내 후 CAMERA 직접 클릭 -> camera on, preview 표시, modal 자동 open 안 됨
- Desktop: Camera ON -> CREATE ROOM -> modal 즉시 open
- Desktop: Camera ON -> Camera OFF -> CREATE ROOM -> 다시 camera gate
- Desktop: Camera ON / Mic OFF -> Create Room 및 Join Room 가능
- Mobile 375x667 / 390x844: Camera OFF -> CREATE ROOM -> modal 없음, bottom CAMERA 버튼 근처 안내/강조 확인

## 검증

- `npm run lint`
  - 통과
  - 기존 `src/pages/MeetingRoomPage.tsx`의 `react-hooks/exhaustive-deps` warning 1개는 유지됨
- `npm run build`
  - 통과
  - Vite chunk size warning은 build failure가 아님
