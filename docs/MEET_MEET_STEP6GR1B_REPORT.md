# MEET MEET Step 6-GR1B Report

## Scope

Step 6-GR1B는 기존 Fair Play 감지 기능 위에 두 가지 안전 장치를 추가했다.

- 한 번의 `attackSequence`에서 방어자 1명은 최대 1번만 Life 피해를 받는다.
- 방 내부 `face-check` phase와 LiveKit `fair-play-check-result` 흐름을 제거하고, Setup 단계의 입장 전 Face Check로 이동했다.

영상 프레임, 랜드마크, blendshape 원본 값은 네트워크로 전송하지 않는다. 공격 중에는 감지 결과 이벤트만 기존 LiveKit game-state topic으로 전달된다.

## Changed Files

- `src/App.tsx`
- `src/pages/SetupPage.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/livekit/LiveKitTestRoom.tsx`
- `src/services/fairPlayDetectorService.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`
- `src/services/roomService.ts`
- `src/types/game.ts`
- `src/App.css`

## One-Hit-Per-Attack

`GameStateSnapshot`에 `penalizedParticipantIdentitiesForCurrentAttack` 필드를 추가했다.

Host authoritative 처리 위치:

- `src/pages/MeetingRoomPage.tsx`
- `applyFairPlayEventFromHost`
- `handleLocalFairPlayEvent`
- `startAttackFromHost`

동작:

- 공격 시작 시 `penalizedParticipantIdentitiesForCurrentAttack: []`로 초기화한다.
- Host는 `visible-laugh`, `mouth-occlusion-timeout`, `face-not-visible-timeout` 이벤트를 같은 피해 경로로 처리한다.
- Host가 이미 해당 `attackSequence`에서 피해 처리한 defender identity를 다시 받으면 무시한다.
- Guest도 이미 snapshot에 잠긴 자기 identity가 있으면 추가 이벤트 publish를 멈춘다.
- 다음 라운드 준비로 넘어갈 때 잠금 목록을 다시 빈 배열로 초기화한다.

## Pre-Join Face Check

Face Check를 `SetupPage`로 이동했다.

- `src/pages/SetupPage.tsx`
- `FairPlayDetector.startFaceCheck`
- `화상방 입장` 버튼은 카메라 ON + Face Check PASS 이후에만 활성화된다.
- Host 방 생성 API와 Guest 방 입장 API는 Setup Face Check PASS 이후 `startMeeting`에서 호출된다.
- 새 방 만들기 상태에서는 실제 room code가 생성되기 전이므로 `PASS 후 생성` 상태로 표시하고 초대 복사는 비활성화된다.

API 호출 위치 변경:

- Landing `방 만들기`: 서버 호출 없이 Setup으로 이동
- Landing `코드로 입장`: `normalizeRoomCode`로 형식만 검사한 뒤 Setup으로 이동
- Setup PASS 후 `화상방 입장`: `createServerRoom` 또는 `joinServerRoomByCode` 호출

## Room Internal Face Check Removal

제거한 방 내부 흐름:

- `GamePhase`의 `face-check`
- `GameBoard`의 `phase === 'face-check'` UI
- `MeetingRoomPage`의 Host `face-check` 완료 감시 effect
- LiveKit `fair-play-check-result` decode/수신 허용 경로
- `GameFairPlayCheckResult` 타입

`FairPlayDetector` 내부의 `face-check` mode는 Setup의 로컬 사전 확인을 위해 유지한다.

## Calibration Reuse

`src/services/fairPlayDetectorService.ts`에서 Face Check PASS 시 보정값을 `sessionStorage`에 저장한다.

- key: `meet-meet:fair-play-calibration`
- 저장값: neutral smile score, neutral mouth-open score, smile reference score
- 공격 중 detector는 같은 브라우저 세션의 저장 보정값을 우선 사용한다.

## Debug Controls

Fair Play debug 출력은 기존 조건을 유지한다.

- `VITE_FAIR_PLAY_DEBUG=true`일 때만 `fairPlayDebug`가 `GameBoard`에 전달된다.
- Manual judgement UI는 복구하지 않았다.
- 수동 LIFE 감소 버튼은 추가하지 않았다.

## Validation

실행 결과:

- `npm run lint`: 통과
- `npm run build`: 통과

lint는 기존 `MeetingRoomPage.tsx` hook dependency warning 1개를 표시하지만 error는 없다.

## Manual Test Checklist

- Host: Landing `방 만들기` 클릭 후 서버 방 생성 없이 Setup 진입
- Host: Face Check PASS 전 `화상방 입장` 비활성화
- Host: Face Check PASS 후 `/api/free-beta/rooms` 호출 및 방 생성
- Guest: Landing room code 형식 확인 후 Setup 진입
- Guest: Face Check PASS 후 `/api/free-beta/rooms/join` 호출 및 입장
- 공격 중 같은 defender가 웃음/입 가림/얼굴 없음 이벤트를 여러 번 발생시켜도 같은 `attackSequence`에서 Life가 1만 감소
- 다음 라운드 공격 시작 시 피해 잠금이 초기화되어 새 공격에서 다시 1회 피해 가능

## Known Limits

- Face Check는 로컬 시각 검사용 MVP이며 조명, 카메라 각도, 안경, 마스크 등에 민감할 수 있다.
- Setup에서 PASS 후 방 생성이 일어나므로 Host는 방 생성 전에는 초대 코드를 공유할 수 없다.
- 공격 중 Fair Play 이벤트는 감지 결과만 전송하며, 서버 검증이나 영상 증거 저장은 하지 않는다.

## Next Step Proposal

Step 6-GR2에서는 감지 품질 보정을 다룬다.

- false positive/false negative 로그 없는 로컬 튜닝
- 얼굴 미검출/입 가림 grace time 조정
- 모바일 카메라 성능 점검
- eliminated/spectator 전환 UX 정리
- 다음 라운드 자동 진행 정책 결정
