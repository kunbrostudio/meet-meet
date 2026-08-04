# MEET MEET Step 6-C Report

## 변경 파일

- `src/types/game.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `src/components/game-room/MeetMeetRoomLayout.tsx`
- `src/components/game-room/ParticipantColumn.tsx`
- `src/components/game-room/ParticipantGameCard.tsx`
- `src/App.css`

## Game State 추가 필드

- `GamePhase`
  - `role-reveal`
  - `attack-ready`
- `GameStateSnapshot`
  - `roundNumber?: number`
  - `activePlayerIdentities?: string[]`
  - `turnOrder?: string[]`
  - `currentTurnIndex?: number`
  - `attackerIdentity?: string`
  - `defenderIdentities?: string[]`
  - `roleRevealStartedAt?: string`
  - `roleRevealDurationMs?: number`

## Active Player Roster 기준

- Host가 `game-started` phase를 받은 직후 active player roster를 확정한다.
- `displayedParticipants.slice(0, participantCount)`의 실제 연결 참가자를 기준으로 한다.
- Ready를 완료한 identity가 2명 이상이면 ready 참가자를 우선 active roster로 사용한다.
- ready 기준이 부족하면 현재 연결 참가자 identity를 사용한다.
- 중복 identity는 `Set`으로 제거하고 최대 4명까지만 사용한다.

## Turn Order 생성 방식

- `createTurnOrder()`가 Host에서만 Fisher-Yates 방식으로 active player identities를 섞는다.
- 생성된 `turnOrder`는 authoritative snapshot에 저장된다.
- 첫 공격자는 `turnOrder[0]`이고 `currentTurnIndex`는 `0`이다.
- 이번 단계에서는 다음 라운드 진행은 구현하지 않았지만, 이후 라운드에서 `currentTurnIndex`를 증가시켜 순차 공격이 가능하도록 구조를 남겼다.

## Host Authority 방식

- Host만 다음 작업을 수행한다.
  - active roster 확정
  - turnOrder 생성
  - attacker/defender 결정
  - `role-reveal` 시작 snapshot publish
  - role reveal 종료 후 `attack-ready` snapshot publish
- Guest는 기존 Host sender identity guard를 통과한 `game-state-snapshot`만 적용한다.
- Guest가 로컬 participant 배열로 공격자나 turnOrder를 재계산하지 않는다.

## 공격자/방어자 계산 방식

- `attackerIdentity = turnOrder[currentTurnIndex]`
- `defenderIdentities = activePlayerIdentities.filter(identity => identity !== attackerIdentity)`
- 2~4명 구조에서 공격자는 항상 1명이고, 나머지 active players 전원이 defender가 된다.
- `GameBoard`는 snapshot의 `attackerIdentity`와 local identity를 비교해 공격자/방어자용 안내 문구를 표시한다.
- 참가자 카드는 snapshot role 값을 기준으로 `ATTACKER` 또는 `DEFENDER` badge를 표시한다.

## 중복 랜덤 선택 방지 방식

- turnOrder 생성 effect는 Host에서 `phase === 'game-started'`이고 `attackerIdentity`가 아직 없을 때만 실행된다.
- 생성 직후 local `gameStateRef`와 React state를 `role-reveal`로 바꿔 React Strict Mode에서도 같은 `game-started` snapshot으로 재생성되지 않게 했다.
- snapshot key에는 role fields를 포함해 동일 snapshot 재수신/재발행으로 공격자가 바뀌지 않도록 했다.
- `roleRevealCompletionTimerRef`는 하나만 유지하고 dependency 변경/unmount 시 clear한다.

## 참가자 이탈 처리

- Host의 일반 snapshot 재생성 경로에서 `role-reveal`/`attack-ready` 중 active roster를 현재 연결 참가자 기준으로 조정한다.
- 방어자가 나가면 `defenderIdentities`에서 제거되고 현재 공격자는 유지된다.
- 공격자가 나가면 남아 있는 `turnOrder`의 다음 참가자를 공격자로 지정한다.
- active player가 2명 미만이면 `phase: waiting`으로 안전하게 되돌린다.
- 복잡한 재접속 복원이나 spectator 처리는 이번 단계에서 구현하지 않았다.

## UI

- `role-reveal`
  - `이번 공격자는`
  - 공격자 이름
  - 공격자/방어자별 안내 문구
- `attack-ready`
  - 공격자: `공격 콘텐츠를 준비하세요.`
  - 방어자: `웃지 말고 버티세요.`
- 기존 Step 5-C dark arcade theme를 유지했다.
- webcam video에는 overlay/filter를 추가하지 않고, badge와 card border만 role accent로 사용했다.

## 2인 수동 테스트 절차

1. Host와 Guest가 같은 방에 입장한다.
2. 두 참가자가 Ready 후 Host가 `GAME START`를 누른다.
3. countdown 종료 후 두 화면 모두 같은 `attackerIdentity`, `turnOrder`, `roundNumber: 1`을 받는지 확인한다.
4. 공격자 1명, 방어자 1명이 표시되는지 확인한다.
5. Host가 공격자로 선택될 수도 있고 Guest가 공격자로 선택될 수도 있는지 여러 번 확인한다.
6. role reveal 종료 후 두 화면 모두 `attack-ready` phase가 되는지 확인한다.
7. Guest가 임의 snapshot을 보내도 Host sender identity guard 때문에 역할/phase가 변경되지 않는지 확인한다.

## 3~4인 수동 테스트 절차

1. Host와 Guest 2~3명이 같은 방에 입장한다.
2. 모든 참가자가 Ready 후 Host가 `GAME START`를 누른다.
3. countdown 종료 후 공격자 1명만 표시되는지 확인한다.
4. 공격자를 제외한 나머지 전원이 defender로 표시되는지 확인한다.
5. 모든 화면의 `turnOrder`, `attackerIdentity`, `defenderIdentities`, `roundNumber`가 동일한지 확인한다.
6. role reveal 중 방어자가 퇴장해도 앱이 crash하지 않고 defender 목록이 정리되는지 확인한다.
7. role reveal 중 공격자가 퇴장하면 Host가 남은 참가자 중 다음 turnOrder 참가자를 공격자로 지정하는지 확인한다.

## 검증 결과

- `npm run lint`: 통과
- `npm run build`: 통과
- Vite가 `LiveKitTestRoom` chunk size warning을 출력했지만 빌드는 성공했다.

## 다음 Step 권장 작업

1. Step 6-D: `attack-ready` 이후 `attack-prep` 또는 `attacking` 진입과 공격 준비 시간 동기화.
2. Step 6-E: 공격자용 카메라/이미지 공격 placeholder UI 연결.
3. Step 6-F: life/score 없이 판정 phase skeleton 추가.
