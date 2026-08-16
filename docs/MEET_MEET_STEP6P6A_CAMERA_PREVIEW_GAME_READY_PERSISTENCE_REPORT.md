# MEET MEET Step 6-P6A Camera Preview + Game Ready Persistence Report

## 목적

Step 6-P6 이후 App-level camera track은 유지되지만 Main 복귀 시 live preview가
demo placeholder로 돌아가고 GAME READY CHECK가 WAIT으로 초기화되는 문제를
수정했다.

## 변경 파일

- `src/App.tsx`
- `src/pages/LandingPage.tsx`
- `src/types/meeting.ts`
- `src/types/index.ts`
- `docs/MEET_MEET_STEP6P6A_CAMERA_PREVIEW_GAME_READY_PERSISTENCE_REPORT.md`

## Preview가 사라진 실제 원인

Camera track은 `App.tsx`의 `localMedia.stream`에 남아 있었지만,
`LandingPage`가 Room 이동 중 unmount되면서 local state인 `mediaMode`가 다시
`intro`로 초기화되었다. 그 결과 Main 복귀 직후 live camera video element가
렌더되지 않고 intro/demo placeholder 조건을 탔다.

## Main video `srcObject` 재attach 방식

LandingPage는 mount 시 `localMedia.stream`에 live video track이 있으면 초기
`mediaMode`를 `camera`로 설정한다. 이후 video element와 live stream이 모두
존재하면:

- `video.srcObject !== localMedia.stream`일 때 기존 App stream을 다시 attach
- `video.play()`를 안전하게 호출
- 개발 환경에서 `[app-camera] main preview attach` 로그 출력

새 getUserMedia 호출 없이 기존 stream만 재사용한다.

## Game Ready가 reset된 실제 원인

GAME READY 상태는 `LandingPage` local `calibration` state에만 있었다.
Room으로 이동하면 LandingPage가 unmount되고, Main 복귀 시
`initialCalibrationState`로 재생성되어 CAMERA / FACE / MOUTH / SMILE이 모두
WAIT으로 돌아갔다.

## Game Ready Snapshot 저장 위치

`GameReadySnapshot` 타입을 추가하고 `App.tsx`에 app-level state로 저장한다.
LandingPage에서 Game Ready Check가 통과하면 `onGameReadySnapshotChange`로
snapshot을 App에 올린다.

## `verifiedTrackId` 방식

Snapshot은 다음 값을 가진다.

- `cameraPassed`
- `facePassed`
- `mouthPassed`
- `smilePassed`
- `ready`
- `verifiedTrackId`
- `verifiedDeviceId`
- `verifiedAt`

LandingPage는 현재 live video track의 `id`가 `verifiedTrackId`와 같을 때만
snapshot을 calibration PASS 상태로 복원한다.

## Snapshot Invalidation 조건

Snapshot은 아래 경우에만 clear한다.

- 사용자가 CAMERA OFF를 직접 누름
- App camera track이 실제 `ended` 됨
- App media update에서 verified video track이 새 stream에 포함되지 않음
- 현재 stream에 ready video track이 없음

Room leave, kick, elimination, route transition은 invalidation 조건이 아니다.

## Detector Lifecycle과 Snapshot 분리

Room cleanup이나 Landing unmount로 detector instance가 종료되어도, 이미 성공한
Game Ready snapshot은 App-level state에 남는다. 동일 live track이면 Main 복귀 후
detector를 즉시 재시작하지 않고 PASS 상태를 복원한다.

## 테스트 항목

터미널 환경에서는 실제 camera preview / device indicator를 수동 확인할 수
없으므로 아래 항목은 브라우저 수동 검증이 필요하다.

- 정상 Leave: GAME READY 후 Room leave -> Main preview 즉시 복구
- Elimination: LIFE 0 kick -> Main preview + 4개 PASS 유지
- 반복 입퇴장: Main -> Room -> Leave 반복 후 same track preview 유지
- Mobile: 375x667 / 390x844에서 preview + GAME READY PASS 복구
- Intro -> Games -> Intro 전환 후 live preview와 Ready 상태 유지
- CAMERA OFF 직접 클릭 시 snapshot clear 및 새 CAMERA ON 후 재검사

## 검증

- `npm run lint`: pass
- `npm run build`: pass
