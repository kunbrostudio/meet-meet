# MEET MEET Step 6-A Report

## 변경 파일

- `src/types/game.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`
- `src/services/livekitConnectionService.ts` 변경 없음
- `src/components/livekit/LiveKitTestRoom.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/MeetMeetRoomLayout.tsx`
- `src/components/game-room/ParticipantColumn.tsx`
- `src/components/game-room/ParticipantGameCard.tsx`
- `src/App.css`

## Game State 구조

- 기존 `GamePhase` 타입은 유지하고 `waiting`, `ready`, `countdown`을 이번 단계에서 사용한다.
- `GameParticipantStatus`에 `isReady`를 추가했다.
- `GameStateSnapshot`에 `readyParticipantCount`를 추가했다.
- `GameReadyChange` 타입을 추가했다.
  - `type: 'game-ready-change'`
  - `meetingId`
  - `roomCode`
  - `participantIdentity`
  - `isReady`
  - `changedAt`
- `createGameStateSnapshot()`은 현재 참가자 목록 기준으로 ready identity를 필터링해 퇴장한 참가자의 ready 상태를 snapshot에서 제외한다.
- `getLobbyGamePhase()`는 현재 접속자가 2명 이상이고 현재 접속자 전원이 ready일 때 `ready`, 그 외에는 `waiting`을 반환한다.
- `GAME START` 이후에는 host가 `phase: 'countdown'` snapshot을 발행한다. 실제 타이머와 다음 phase 진행은 구현하지 않았다.

## Ready 동기화 방식

- LiveKit Data topic은 기존 `meet-meet-game-state`를 그대로 사용했다.
- 게스트가 Ready 버튼을 누르면 `game-ready-change` 메시지를 publish한다.
- 호스트는 `game-ready-change`만 처리해 host local ready list를 갱신한다.
- 호스트의 ready list 변경은 기존 `game-state-snapshot` 발행 흐름을 통해 모든 참가자에게 동기화된다.
- 게스트는 snapshot 수신 시 `participants[].isReady`를 기준으로 로컬 ready 표시를 갱신한다.
- 참가자 카드에는 `ParticipantGameCard`의 `participant-game-status-slot`에 `READY` badge를 표시한다.

## Host Authority 방식

- `GAME START` 버튼은 실제 host UI에만 표시된다.
- `handleStartGame()`은 `isCurrentUserHost`, `phase === 'ready'`, 최소 2명, 전원 ready 조건을 모두 만족할 때만 `countdown` snapshot을 생성한다.
- 게스트는 `game-ready-change`만 보낼 수 있고 start 전용 메시지 타입은 추가하지 않았다.
- `LiveKitTestRoom`은 Data sender identity를 `onDataMessage`로 전달한다.
- 게스트는 `game-state-snapshot` 수신 시 known host identity와 sender identity가 일치하는 snapshot만 수락한다.
- 호스트는 다른 참가자가 보낸 `game-state-snapshot`을 수락하지 않는다.

## UI 변경

- `GameBoard` waiting 영역에 Ready 상태 표시를 추가했다.
  - 예: `1 / 2 READY`
  - `준비하기` / `준비 완료`
  - host 전용 `GAME START`
- 조건 미충족 시 `GAME START`는 disabled 상태다.
- `countdown` phase에서는 정적 표시만 제공한다.
  - `GAME START`
  - `3`
  - `2`
  - `1`
- Step 5-C의 dark arcade visual theme를 유지하고 작은 Ready control panel과 badge 스타일만 추가했다.

## 테스트 방법

- A. Host 1명 입장
  - Ready count가 `0 / 2 READY` 또는 host ready 후 `1 / 2 READY`로 표시된다.
  - `GAME START`는 disabled 상태여야 한다.
- B. Guest 입장 후 2명
  - 두 참가자 모두 ready false이면 `GAME START` disabled.
- C. Guest Ready
  - guest가 `game-ready-change`를 publish한다.
  - host가 snapshot을 재발행하고 host/guest 화면 모두 ready count와 참가자 READY badge가 반영되어야 한다.
- D. Host Ready
  - 두 명 모두 ready이면 phase가 `ready`가 되고 host의 `GAME START`가 enabled 되어야 한다.
- E. Host GAME START
  - host가 `phase: 'countdown'` snapshot을 발행한다.
  - 두 브라우저 모두 GAME BOARD에 countdown 상태가 반영되어야 한다.
- F. Guest 임의 start 시도
  - start 메시지 타입은 없으며 guest가 보낸 snapshot은 sender identity가 host가 아니면 guest 클라이언트에서 수락되지 않아야 한다.

## 검증 결과

- `npm run lint`: 통과
- `npm run build`: 통과
- Vite가 `LiveKitTestRoom` chunk size warning을 출력했지만 빌드는 성공했다.

## Step 6-A-1 Guest Snapshot Sync Fix

### 실제 원인

- `LiveKitDataBridge`는 `RoomEvent.DataReceived`에서 받은 `participant?.identity`를 `onMessage(message, senderParticipantIdentity)`로 전달하도록 되어 있었다.
- 하지만 같은 파일의 상위 래퍼인 `handleDataMessage()`가 `message` 한 개 인자만 받아 `onDataMessageRef.current(message)`로 호출하고 있었다.
- 그 결과 `MeetingRoomPage.receiveLiveKitDataMessage()`의 `senderParticipantIdentity`는 Guest 화면에서 항상 `undefined`였다.
- Guest는 host authority를 유지하기 위해 `game-state-snapshot` 수신 시 `senderParticipantIdentity === expectedHostIdentity`를 검사하므로, 실제 Host가 보낸 snapshot도 guard에서 차단됐다.
- 그래서 참가자 카드 일부 READY 표시는 LiveKit participant/로컬 state 경로로 보였지만, 중앙 `GameBoard`의 authoritative `gameState`는 최신 snapshot으로 갱신되지 않았다.

### 문제가 있던 파일/함수

- `src/components/livekit/LiveKitTestRoom.tsx`
  - `handleDataMessage()`
  - `LiveKitDataBridge`
- `src/pages/MeetingRoomPage.tsx`
  - `receiveLiveKitDataMessage()`의 host snapshot sender guard

### 수정 전 송수신 흐름

1. Guest가 `game-ready-change`를 publish한다.
2. Host가 `game-ready-change`를 수신하고 ready list를 갱신한다.
3. Host가 `game-state-snapshot`을 `meet-meet-game-state` topic으로 publish한다.
4. Guest의 `LiveKitDataBridge`가 snapshot과 LiveKit sender identity를 받는다.
5. `handleDataMessage(message)` 래퍼에서 sender identity가 버려진다.
6. `MeetingRoomPage.receiveLiveKitDataMessage(message, undefined)`가 호출된다.
7. Guest의 host authority guard가 snapshot을 reject한다.
8. Guest `GameBoard`는 이전 `gameState`를 계속 렌더링한다.

### 수정 후 송수신 흐름

1. Host가 `game-state-snapshot`을 `meet-meet-game-state` topic으로 publish한다.
2. Guest의 `LiveKitDataBridge`가 `message`와 `participant?.identity`를 함께 받는다.
3. `handleDataMessage(message, senderParticipantIdentity)`가 두 값을 그대로 `onDataMessageRef.current()`로 전달한다.
4. `MeetingRoomPage.receiveLiveKitDataMessage()`가 known host identity와 sender identity를 비교한다.
5. sender가 실제 Host이면 Guest가 authoritative snapshot을 적용한다.
6. Guest `GameBoard`의 ready count와 `countdown` phase가 Host 화면과 동일하게 갱신된다.

### Host Authority 유지 방식

- Host만 `handleStartGame()`에서 `phase: 'countdown'` snapshot을 생성할 수 있다.
- Guest는 `game-ready-change`만 publish한다.
- Guest가 snapshot을 수신할 때는 known host identity와 LiveKit sender identity가 일치하는 경우만 적용한다.
- 따라서 Guest의 Host snapshot 수신은 허용하면서, Guest가 임의로 보낸 snapshot은 다른 Guest 화면에서 적용되지 않는다.

### 2인 수동 테스트 절차

1. Host 브라우저에서 방을 생성하고 meeting에 입장한다.
2. Guest 브라우저 또는 시크릿 창에서 같은 `MMT-XXXXXX` 코드로 입장한다.
3. 두 화면 모두 `0 / 2 READY`인지 확인한다.
4. Guest가 `준비하기`를 누른다.
5. 두 화면 모두 `1 / 2 READY`로 갱신되는지 확인한다.
6. Host가 `준비하기`를 누른다.
7. 두 화면 모두 `2 / 2 READY`가 되고 Host 화면에만 `GAME START`가 enabled 되는지 확인한다.
8. Host가 `GAME START`를 누른다.
9. 두 화면 모두 `countdown` phase와 `GAME START / 3 2 1` 상태를 표시하는지 확인한다.
10. Guest 퇴장 시 ready count와 READY badge가 현재 참가자 기준으로 정리되는지 확인한다.

### Step 6-A-1 검증 결과

- `npm run lint`: 통과
- `npm run build`: 통과
- Vite가 `LiveKitTestRoom` chunk size warning을 출력했지만 빌드는 성공했다.

## 수동 확인 필요 항목

- 실제 2개 브라우저에서 Guest Ready가 Host 화면에 즉시 반영되는지 확인.
- Host Ready 후 `GAME START` enabled 여부 확인.
- Host가 `GAME START`를 누른 뒤 두 브라우저 모두 `countdown` phase를 표시하는지 확인.
- Guest 퇴장 후 ready count와 참가자 READY badge가 현재 참가자 기준으로 정리되는지 확인.

## 다음 Step 권장 작업

1. Step 6-B: `countdown` 실제 3초 타이머와 host authority 기반 phase progression 구현.
2. Step 6-C: `attack-prep` 진입과 첫 공격자 선정 구조 추가.
3. Step 6-D: `ParticipantGameStatus` 확장 영역에 life, attacker, spectator 상태 타입만 연결.
4. Step 6-E: 카메라 공격과 이미지 공격의 payload 타입 및 placeholder UI 설계.
