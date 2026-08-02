# MEET MEET Step 6-B Report

## 변경 파일

- `src/types/game.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `src/App.css`

## Countdown 상태 구조

- 기존 `GameStateSnapshot` 구조를 확장했다.
- `GamePhase`에 `game-started`를 추가했다.
- `GameStateSnapshot`에 다음 optional 필드를 추가했다.
  - `countdownStartedAt?: string`
  - `countdownDurationMs?: number`
- `createGameStateSnapshot()`은 기존 ready/participant snapshot 생성 흐름을 유지하면서 countdown 필드를 함께 담을 수 있게 확장했다.
- `livekitChatService.ts`의 snapshot validator와 phase validator가 새 필드를 인식하도록 수정했다.

## Host 기준 시각 동기화 방식

- Host가 `GAME START`를 누르면 `handleStartGame()`이 authoritative snapshot을 생성한다.
- 이 snapshot에는 다음 값이 포함된다.
  - `phase: 'countdown'`
  - `countdownStartedAt: new Date().toISOString()`
  - `countdownDurationMs: 3000`
- Host는 기존 `meet-meet-game-state` topic의 `game-state-snapshot`으로 이 상태를 publish한다.
- Guest는 snapshot을 수신할 뿐 `countdownStartedAt`을 생성하거나 수정하지 않는다.
- Guest snapshot 수신은 기존 Step 6-A-1의 host sender identity guard를 그대로 통과한 Host snapshot에 대해서만 허용된다.

## 클라이언트 표시 숫자 계산 방식

- `GameBoard`는 `countdownStartedAt`을 `Date.parse()`로 절대 시각 millisecond 값으로 변환한다.
- 각 화면은 `Date.now() - countdownStartedAt`으로 elapsed time을 계산한다.
- 표시 규칙:
  - `elapsed < 1000ms`: `3`
  - `elapsed < 2000ms`: `2`
  - `elapsed < 3000ms`: `1`
  - `elapsed >= countdownDurationMs`: `GAME START!`
- 표시 갱신에는 `requestAnimationFrame`을 사용하지만, 기준 시각은 항상 Host snapshot의 `countdownStartedAt`이다.
- 늦게 snapshot을 받은 참가자는 3부터 다시 시작하지 않고 현재 elapsed time에 맞는 숫자로 합류한다.

## 중복 Timer 방지 방식

- `GAME START` 버튼은 `phase === 'ready'`, 최소 2명, 전원 ready 조건일 때만 활성화된다.
- `handleStartGame()`도 동일 조건을 다시 검사해 countdown 중 재시작을 막는다.
- Host의 countdown 종료 감지는 `countdownCompletionTimerRef` 하나로 관리한다.
- countdown 관련 dependency가 바뀌면 기존 timeout을 clear하고 새 종료 시점 기준으로 다시 예약한다.
- 컴포넌트 unmount cleanup에서 `countdownCompletionTimerRef`를 clear한다.
- Host timeout callback은 실행 직전에도 현재 `gameStateRef.current.phase`와 `countdownStartedAt`이 기존 countdown과 같은지 확인한다.

## Countdown 종료 처리

- countdown 종료 후 phase 변경은 Host만 수행한다.
- Host가 `countdownStartedAt + countdownDurationMs` 도달을 감지하면 `phase: 'game-started'` snapshot을 한 번 생성해 publish한다.
- Guest는 로컬 elapsed time만으로 phase를 변경하지 않는다.
- `game-started` phase에서는 GAME BOARD에 다음 placeholder를 표시한다.
  - `게임 준비 완료`
  - `다음 단계에서 첫 공격자를 정합니다.`

## 2인 수동 테스트 절차

1. Host 브라우저에서 방을 생성하고 meeting에 입장한다.
2. Guest 브라우저 또는 시크릿 창에서 같은 `MMT-XXXXXX` 코드로 입장한다.
3. Host와 Guest가 모두 `준비하기`를 눌러 두 화면 모두 `2 / 2 READY`인지 확인한다.
4. Host 화면에서만 `GAME START`가 활성화되는지 확인한다.
5. Host가 `GAME START`를 누른다.
6. 두 화면 모두 거의 동시에 `3` 하나만 크게 표시하는지 확인한다.
7. 두 화면 모두 `3 -> 2 -> 1 -> GAME START!` 순서로 하나씩 표시하는지 확인한다.
8. Guest가 snapshot을 늦게 받는 상황에서도 Host의 현재 숫자와 같은 숫자로 합류하는지 확인한다.
9. countdown 종료 후 두 화면 모두 `game-started` phase와 placeholder 문구를 표시하는지 확인한다.
10. `GAME START`를 여러 번 눌러도 countdown이 중복 실행되지 않는지 확인한다.
11. Guest가 임의 snapshot을 보내더라도 Host sender identity가 아니면 적용되지 않는지 확인한다.
12. countdown 중 참가자가 퇴장해도 앱이 crash 없이 유지되는지 확인한다.

## 검증 결과

- `npm run lint`: 통과
- `npm run build`: 통과
- Vite가 `LiveKitTestRoom` chunk size warning을 출력했지만 빌드는 성공했다.

## 다음 Step 권장 작업

1. Step 6-C: `game-started` 이후 첫 공격자 선정과 `attack-prep` 진입을 Host authoritative snapshot으로 구현한다.
2. Step 6-D: 공격자/대상자 표시를 `ParticipantGameStatus` 확장 영역에 연결한다.
3. Step 6-E: life/score 없이 카메라 공격 placeholder 상태만 먼저 연결한다.
