# MEET MEET Step 6-P6B Game Ready Snapshot Persistence Report

## 목적

Camera preview persistence는 유지하면서, Room leave / kick / elimination 이후
GAME READY CHECK가 CHECKING 또는 WAIT으로 돌아가는 문제만 수정했다.

## 변경 파일

- `src/pages/LandingPage.tsx`
- `docs/MEET_MEET_STEP6P6B_GAME_READY_SNAPSHOT_PERSISTENCE_REPORT.md`

## Snapshot이 복원되지 않았던 실제 원인

Step 6-P6A에서 App-level `GameReadySnapshot` 구조는 추가되었지만, snapshot 저장
경로가 detector의 `onCheckResult`에 주로 묶여 있었다. 기존 로비에는
`sessionStorage`의 device calibration을 읽어 GAME READY를 빠르게 복원하는 경로가
이미 있었고, 이 경로로 PASS 상태가 만들어질 때 App-level snapshot이 저장되지
않을 수 있었다.

또한 valid snapshot이 있어도 LandingPage의 calibration effect가 먼저 실행되면
detector가 `checking` 상태를 다시 시작할 수 있었다.

## 기존 Ready State 저장 위치

- 기존 UI 상태: `LandingPage` local `calibration` state
- session 편의 저장: `sessionStorage`의 `meet-meet:game-ready-calibration`
- P6A 이후 App-level 저장: `App.tsx`의 `gameReadySnapshot`

이번 hotfix는 App-level `gameReadySnapshot`을 restore/gate/UI의 우선 기준으로
사용하도록 보강했다.

## Snapshot Save 시점

Snapshot은 다음 순간 저장된다.

- detector `onCheckResult`가 최종 PASS를 반환한 순간
- 기존 sessionStorage calibration으로 PASS를 복원한 순간
- local calibration이 이미 PASS이고 current track id와 일치하지만 App snapshot이
  비어 있는 순간

개발 환경 로그:

- `[game-ready] snapshot saved`

## Snapshot Persistent 위치

`GameReadySnapshot`은 App-level state에 저장된다. LandingPage route unmount,
MeetingRoomPage unmount, Room leave, kick, elimination으로 삭제하지 않는다.

## `verifiedTrackId` 기준

Snapshot은 App persistent camera session의 실제 `MediaStreamTrack.id`를
`verifiedTrackId`로 저장한다. LiveKit publication SID나 wrapper track id는
검증 기준으로 사용하지 않는다.

복원 조건:

- camera track exists
- `track.readyState === "live"`
- `track.enabled === true`
- `snapshot.ready === true`
- `snapshot.verifiedTrackId === currentTrack.id`

## Main Hydrate 방식

LandingPage는 valid snapshot이 있으면 `visibleCalibration`을 snapshot에서 만든
PASS state로 계산한다. UI와 Create/Join gate는 local calibration이 아니라
`visibleCalibration`을 읽는다.

따라서 snapshot 복원 직후:

- CAMERA PASS
- FACE PASS
- MOUTH PASS
- SMILE PASS
- GAME READY ✓
- JOIN CODE / CREATE ROOM 가능

상태가 즉시 반영된다.

## Ready Reset 코드 수정 내용

Valid snapshot이 있는 동안 calibration detector effect는 early return하여
CHECKING 상태를 다시 시작하지 않는다. Camera OFF, track ended, track 교체처럼
명확한 invalidation 조건에서만 snapshot을 clear한다.

## Detector Lifecycle과 Ready Snapshot 분리

Room runtime detector disposal은 Main Game Ready snapshot을 삭제하지 않는다.
Main의 Game Ready snapshot은 App camera track identity에 귀속되고, Room detector
lifecycle과 별도로 유지된다.

## 테스트 항목

브라우저 수동 확인 필요:

- Leave 테스트: GAME READY 후 Room leave -> Main에서 4 PASS 유지
- Kick 테스트: elimination kick -> Main에서 GAME READY 유지
- 반복 테스트: Room 입퇴장 3회 이상 후에도 snapshot 유지
- Mobile 테스트: 375x667에서 Room -> Main 후 CHECKING/WAIT 재발 없음
- Camera OFF 테스트: 직접 CAMERA OFF 시 snapshot clear, 재 ON 시 재검사

## 검증

- `npm run lint`: pass
- `npm run build`: pass
