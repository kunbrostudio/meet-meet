# MEET MEET Step 6-P6 Persistent App Camera Session Report

## 목적

Room leave, elimination kick, Meeting route 종료 이후에도 사용자가 직접
CAMERA OFF를 누르지 않았다면 App-level camera session을 유지하도록 수정했다.

## 변경 파일

- `src/App.tsx`
- `src/pages/LandingPage.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/livekit/LiveKitTestRoom.tsx`
- `docs/MEET_MEET_STEP6P6_PERSISTENT_APP_CAMERA_SESSION_REPORT.md`

## 기존 Camera Lifecycle Owner

기존 구조에서 `App.tsx`가 `localMedia.stream`을 보유하고 있었고,
LandingPage와 MeetingRoomPage는 `onLocalMediaChange`를 통해 같은 stream을
공유했다.

하지만 LiveKit Room disconnect는 SDK 기본값상 local track을 stop할 수 있는
구조였다. LiveKit client 기본 옵션은 `stopLocalTrackOnUnpublish: true`이고,
`room.disconnect()` 역시 기본 인자로 local track stop을 수행할 수 있다.

## Room Leave 시 Camera가 꺼질 수 있던 실제 원인

Room의 camera track은 App stream의 `MediaStreamTrack`을 그대로 publish한다.
따라서 Room disconnect/unpublish가 기본 stop 정책으로 실행되면 Room-owned
resource cleanup이 App-owned camera track까지 종료할 수 있었다.

## `track.stop()` 호출 위치

유지된 명시적 stop 위치:

- `src/pages/LandingPage.tsx`
  - 사용자가 CAMERA OFF를 직접 누른 경우 video track stop
  - 사용자가 AUDIO OFF를 직접 누른 경우 audio track stop
  - 새 device stream으로 교체할 때 같은 kind의 기존 track stop
- `src/App.tsx`
  - `localMedia.stream`이 실제로 다른 stream으로 교체될 때 next stream에
    포함되지 않은 기존 track stop

Room leave/kick 경로에서는 App camera track을 stop하지 않도록 LiveKit
disconnect 방식을 변경했다.

## App-Level Camera Ownership 구조

- `App.tsx`가 App camera session owner로 남는다.
- `localMediaRef`를 추가해 async `ended` 이벤트에서도 최신 media state를
  확인한다.
- camera track이 실제로 ended 되었고 현재 App state에서도 여전히 camera가
  enabled라면 `[app-camera] track ended unexpectedly` 로그를 남기고
  camera state를 OFF로 무효화한다.

## LiveKit Publish / Unpublish 처리

- `LiveKitRoom`에 `options={{ stopLocalTrackOnUnpublish: false }}`를 전달한다.
- media controller의 `disconnect`가 `room.disconnect(false)`를 호출하도록
  변경했다.
- 기존 `LiveKitLocalMediaPublisher`는 App stream track을 재사용해 publish한다.
- camera publish 시 개발 환경에서 `[app-camera] reused for room` 로그를 남긴다.

## Room Cleanup과 Camera Cleanup 분리

Room cleanup:

- LiveKit disconnect
- data/controller ref 초기화
- screen share cleanup
- room state cleanup

App camera cleanup:

- 사용자가 Main에서 CAMERA OFF를 직접 누른 경우
- browser permission revoke, device disconnect 등으로 track `ended` 발생

Room leave와 elimination kick은 camera cleanup을 수행하지 않는다.

## Preview Reattach 방식

LandingPage의 기존 preview effect가 `localMedia.stream`을 `video.srcObject`에
다시 attach한다. App-level stream이 유지되므로 Main 복귀 후 새 getUserMedia
호출 없이 preview가 재연결된다.

## GAME READY 유지 방식

Camera track이 live 상태로 유지되면 LandingPage의 existing calibration restore
경로가 동일 device/track 기준으로 GAME READY 상태를 유지한다. 실제 track이 ended
되면 App에서 camera OFF로 전환되므로 기존 GAME READY를 무조건 신뢰하지 않는다.

## Duplicate Stream 방지

- Room 입장 시 LiveKit 자동 camera/audio capture는 계속 비활성화되어 있다.
- `LiveKitLocalMediaPublisher`는 `localMediaStream`의 기존 track을 publish한다.
- publish state는 동일 source/track id 중복 publish를 막는다.
- disconnect는 App track을 stop하지 않으므로 Main -> Room -> Main 반복 중
  불필요한 새 camera capture 생성을 줄인다.

## 진단 로그

개발 환경에서 다음 로그를 사용한다.

- `[app-camera] session created`
- `[app-camera] reused for room`
- `[app-camera] room disconnected, session preserved`
- `[app-camera] route-change preserved`
- `[app-camera] explicitly stopped by user`
- `[app-camera] track ended unexpectedly`

## 테스트 항목

터미널 환경에서는 실제 camera indicator / browser permission dialog를 수동으로
확인할 수 없으므로 아래는 수동 검증 필요 항목이다.

- 정상 Leave: Main camera ON -> Room -> Leave -> Main preview 즉시 복구
- Elimination: LIFE 0 kick -> Main -> camera ON 유지
- Rejoin: kick/leave 이후 재입장 시 camera permission dialog 없음
- 반복: Main -> Room -> Leave 반복 후 duplicate camera capture 없음
- Manual Camera OFF: 사용자가 CAMERA OFF를 누를 때만 실제 video track stop
- 수 초 대기: Room leave/kick 이후 stale cleanup으로 camera가 꺼지지 않음

## 검증

- `npm run lint`: pass
- `npm run build`: pass
