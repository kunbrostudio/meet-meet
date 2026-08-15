# MEET MEET Step 6-M9-R3 Report

작성 시각: 2026-08-12 09:57 KST

## 변경 파일

- `src/pages/LandingPage.tsx`
- `docs/MEET_MEET_STEP6M9R3_REPORT.md`

## 기존 Audio ON-only 원인

- `LandingPage.tsx`의 `connectAudio` 함수가 `micReady`일 때 즉시 `return`했다.
- 따라서 AUDIO OFF -> ON은 가능했지만, AUDIO ON -> OFF에서 실제 `MediaStreamTrack.stop()`을 호출하는 경로가 없었다.

## Mic ON/OFF 구현

- 기존 `connectAudio` 함수에 OFF 분기를 추가했다.
- `micReady === true`일 때:
  - `localMedia.stream?.getAudioTracks().forEach(track => track.stop())`
  - 기존 video track은 `new MediaStream(videoTracks)`로 보존
  - `microphoneEnabled: false`
  - `micStatus: 'idle'`
- `micReady === false`일 때:
  - 기존 `requestDeviceStream('audio')`와 `mergeMediaStreams(..., 'audio')` 흐름 유지
  - 새 audio track을 local media stream에 병합
  - `microphoneEnabled: true`
  - `micStatus: 'ready'`

## 실제 MediaStreamTrack Cleanup

- MIC OFF는 boolean만 바꾸지 않고 실제 audio track을 stop한다.
- 전체 stream이나 video track은 stop하지 않는다.
- Camera ON 상태에서 MIC OFF를 해도 camera preview stream은 유지된다.

## Camera/Mic 독립 상태

- CAMERA active source of truth: `hasReadyVideo(localMedia.stream)`
- MIC active source of truth: `hasReadyAudio(localMedia.stream)`
- AUDIO를 켤 때도 `cameraEnabled`는 실제 `cameraReady` 값을 반영하도록 했다.
- 사용자가 직접 MIC OFF를 누른 뒤에는 `manualMicOff`로 audio coachmark가 즉시 반복 표시되지 않게 했다.

## Web Audio Cleanup 여부

- Main Lobby의 microphone 연결 흐름에서는 `AudioContext`, `MediaStreamAudioSourceNode`, `AnalyserNode`, RAF loop를 생성하지 않는다.
- 따라서 이번 Step에서 추가로 정리할 analyser/Web Audio resource는 없었다.
- 별도 laugh detection service는 game room 쪽 서비스이며, 이번 Main Lobby AUDIO toggle 범위에서는 변경하지 않았다.

## Create/Join Modal 상태 동기화

- Create Room Modal과 Join Code Modal의 MIC 상태 표시는 기존처럼 `micReady`를 source of truth로 사용한다.
- Main에서 AUDIO ON이면 `MIC READY`, AUDIO OFF이면 `MIC OFF`로 즉시 반영된다.
- modal 전용 가짜 mic state는 만들지 않았다.

## Repeated Toggle Test

코드 기준 확인:

- MIC OFF -> AUDIO 클릭 -> `requestDeviceStream('audio')`로 새 audio track 획득
- MIC ON -> AUDIO 클릭 -> 기존 audio track stop 후 video track만 보존
- MIC ON/OFF 반복 시 `mergeMediaStreams`가 기존 audio track을 교체하고 이전 audio track을 stop한다.

## Desktop/Mobile Test

수동 확인 권장:

- Desktop: AUDIO OFF -> ON -> OFF 반복
- Desktop: CAMERA ON + MIC ON -> AUDIO OFF 시 camera preview 유지
- 375x667: AUDIO button active/inactive 전환 확인
- 390x844: Create/Join Modal에서 MIC READY/OFF 즉시 반영 확인

## 검증

- `npm run lint`
  - 통과
  - 기존 `src/pages/MeetingRoomPage.tsx`의 `react-hooks/exhaustive-deps` warning 1개는 유지됨
- `npm run build`
  - 통과
  - Vite chunk size warning은 build failure가 아님
