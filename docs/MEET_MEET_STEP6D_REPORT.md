# MEET MEET Step 6-D Report

## 변경 파일

- `src/types/game.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`
- `src/components/livekit/LiveKitTestRoom.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `src/components/game-room/MeetMeetRoomLayout.tsx`
- `src/components/game-room/ParticipantColumn.tsx`
- `src/components/game-room/ParticipantGameCard.tsx`
- `src/App.css`

## 추가된 Phase와 State 필드

- `GamePhase`
  - `attack-active`
  - `attack-ended`
- `GameStateSnapshot`
  - `attackStartedAt?: string`
  - `attackDurationMs?: number`
  - `attackEndsAt?: string`
  - `attackSequence?: number`
- 기본 공격 시간은 `GAME_ATTACK_DURATION_MS = 30000`으로 관리한다.

## 공격 시작 요청 메시지 구조

- LiveKit Data topic은 기존 `meet-meet-game-state`를 재사용한다.
- 새 메시지 타입:
  - `type: 'attack-start-request'`
  - `meetingId`
  - `roomCode`
  - `roundNumber`
  - `attackSequence?`
  - `requestedAt`
- 요청 payload에는 공격자 identity나 phase를 싣지 않는다.
- 실제 요청자는 `LiveKitDataBridge`가 전달하는 LiveKit sender identity로 확인한다.

## Host의 요청 검증 방식

Host만 `attack-start-request`를 처리한다.

검증 조건:

- 현재 phase가 `attack-ready`
- 실제 sender identity가 `attackerIdentity`와 일치
- payload의 `roundNumber`가 현재 snapshot의 `roundNumber`와 일치
- sender가 `activePlayerIdentities`에 포함
- `attackStartedAt`이 아직 없음
- 동일 round/sequence/sender request를 이미 처리하지 않음

검증 성공 시 Host만 authoritative snapshot을 생성한다.

- `phase: 'attack-active'`
- `attackStartedAt`: Host 현재 절대 시각
- `attackDurationMs: 30000`
- `attackEndsAt`: `attackStartedAt + 30000ms`
- `attackSequence`: 이전 sequence + 1

## attackStartedAt / attackEndsAt 동기화 방식

- 공격자는 버튼을 눌러도 로컬 phase를 직접 바꾸지 않는다.
- Guest 공격자는 `attack-start-request`를 Host에게 publish한다.
- Host가 공격자인 경우에도 같은 검증 함수로 Host local state에서만 시작한다.
- Host가 만든 `game-state-snapshot`이 모든 참가자에게 전파된다.
- Guest는 Host sender identity guard를 통과한 snapshot만 적용한다.

## 남은 시간 계산 방식

- `GameBoard`는 `attackEndsAt`을 `Date.parse()`로 절대 시각으로 변환한다.
- 각 클라이언트는 `remainingMs = attackEndsAt - Date.now()`로 남은 시간을 계산한다.
- 표시:
  - `00:30`
  - `00:29`
  - ...
  - `00:00`
- 화면 갱신에는 `requestAnimationFrame`을 사용하지만, 타이머 기준은 Host snapshot의 `attackEndsAt`이다.
- 늦게 snapshot을 받은 클라이언트는 30초부터 시작하지 않고 현재 남은 시간으로 합류한다.

## 중복 시작 및 중복 종료 방지

- 공격 시작 버튼은 `attack-ready`이고 local identity가 `attackerIdentity`와 같을 때만 활성화된다.
- Host 검증은 `phase`, `attackerIdentity`, `roundNumber`, `activePlayerIdentities`, `attackStartedAt`을 모두 확인한다.
- `processedAttackStartRequestsRef`가 동일 round/sequence/sender 요청 중복 처리를 막는다.
- Host의 공격 종료는 `attackCompletionTimerRef` 하나로 관리한다.
- timer dependency 변경과 unmount 시 기존 timeout을 clear한다.
- 종료 timeout callback은 실행 직전 `phase`, `attackSequence`, `attackEndsAt`이 같은지 재확인한다.
- Guest는 로컬 0초 도달만으로 `attack-ended`로 phase를 변경하지 않는다.

## 참가자 이탈 처리

- 기존 Step 6-C의 active roster 조정 흐름을 확장했다.
- 방어자가 나가면 현재 공격자는 유지하고 `defenderIdentities`만 현재 참가자 기준으로 정리한다.
- attack-active 중 공격자가 나가면 Host가 현재 공격을 안전하게 중단하고 다음 유효 참가자를 공격자로 지정한 뒤 `attack-ready`로 되돌린다.
- active player가 2명 미만이면 `waiting`으로 안전하게 되돌린다.
- 이 단계에서는 재접속 복원, spectator, 다음 라운드 진행은 구현하지 않았다.

## UI

- `attack-ready`
  - 공격자에게만 `공격 시작` 버튼 표시
  - 방어자에게는 대기 안내만 표시
- `attack-active`
  - 남은 공격 시간
  - 진행률 바
  - 현재 라운드
  - 공격자 이름
  - 공격 콘텐츠 placeholder
- `attack-ended`
  - `공격이 종료되었습니다.`
  - `다음 단계에서 결과를 판정합니다.`
- 참가자 카드
  - 공격자: `ATTACKER`, 공격 중에는 `ACTIVE ATTACK`
  - 방어자: `DEFENDER`, 공격 중에는 `버티는 중`
- webcam video에는 opacity, gradient, filter를 추가하지 않았다.

## 2인 수동 테스트 절차

1. Host와 Guest가 같은 방에 입장한다.
2. 두 참가자가 Ready 후 Host가 `GAME START`를 누른다.
3. countdown과 role reveal 종료 후 `attack-ready`에 진입한다.
4. 공격자 화면에만 `공격 시작` 버튼이 표시되는지 확인한다.
5. 방어자 화면에는 버튼이 보이지 않고 대기 안내만 표시되는지 확인한다.
6. 공격자가 `공격 시작`을 누른다.
7. Host가 요청을 검증하고 두 화면 모두 `attack-active`로 전환되는지 확인한다.
8. 두 화면 모두 `00:30` 근처에서 시작해 같은 남은 시간을 표시하는지 확인한다.
9. 늦게 snapshot을 받은 화면이 30초부터 다시 시작하지 않고 현재 남은 시간으로 합류하는지 확인한다.
10. 공격 시작 버튼을 여러 번 눌러도 phase와 timer가 중복 실행되지 않는지 확인한다.
11. 시간이 끝나면 Host가 `attack-ended` snapshot을 publish하고 두 화면 모두 종료 화면을 표시하는지 확인한다.
12. Guest가 임의 `attack-start-request`를 보내도 sender identity가 공격자가 아니면 시작되지 않는지 확인한다.

## 검증 결과

- `npm run lint`: 통과
- `npm run build`: 통과
- Vite가 `LiveKitTestRoom` chunk size warning을 출력했지만 빌드는 성공했다.

## 다음 Step 권장 작업

1. Step 6-E: `attack-ended` 이후 판정 phase skeleton 추가.
2. Step 6-F: 공격 콘텐츠 placeholder를 실제 카메라/이미지 공격 준비 UI와 연결.
3. Step 6-G: life/score 없이 결과 공개와 다음 라운드 전환 구조 추가.
