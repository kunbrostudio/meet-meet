# MEET MEET Step 5 Report

작성일: 2026-07-19

## 1. 작업 목표

회의형 화상 화면을 MEET MEET 전용 화상 게임방 레이아웃으로 전환하고, 중앙 `GAME BOARD`의 대기 상태 골격을 구축했다. 이번 단계에서는 게임 시작, 카운트다운, 공격, 목숨, 판정, 탈락, 관전, 결과, 재대결, 게임 상태 LiveKit 동기화는 구현하지 않았다.

## 2. 생성 및 수정한 파일

생성:

- `src/components/game-room/MeetMeetRoomLayout.tsx`
- `src/components/game-room/ParticipantColumn.tsx`
- `src/components/game-room/ParticipantGameCard.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `src/components/game-room/GameChatPanel.tsx`
- `src/components/game-room/GameBoardEmptyState.tsx`
- `docs/MEET_MEET_STEP5_REPORT.md`

수정:

- `src/pages/MeetingRoomPage.tsx`
- `src/App.css`

## 3. 게임방 레이아웃 구조

`src/pages/MeetingRoomPage.tsx`에서 기존 `VideoGrid` + 우측 `ConversationPanel` 렌더링을 제거하고, 새 `MeetMeetRoomLayout`을 연결했다.

Desktop 구조:

- 왼쪽: `ParticipantColumn`
- 중앙: `GameBoard`
- 오른쪽: `ParticipantColumn`

Tablet/Mobile 구조:

- `GameBoard`를 우선 표시한다.
- 참가자 카드는 보드 아래로 재배치한다.
- 모바일 portrait에서는 참가자 카드를 1열로 배치해 가로 스크롤을 피한다.
- 모바일 landscape에서는 좌/중앙/우 구조를 유지하되 폭을 줄여 한 화면에 들어오도록 했다.

상단 `meeting-header`와 하단 `ControlBar`는 유지했다.

## 4. 참가자 분배 방식

`src/components/game-room/MeetMeetRoomLayout.tsx`에 `splitParticipantsForGameRoom()`을 추가했다.

분배 규칙:

- 1명: 왼쪽 1명, 오른쪽 0명
- 2명: 왼쪽 1명, 오른쪽 1명
- 3명: 왼쪽 1명, 오른쪽 2명
- 4명: 왼쪽 2명, 오른쪽 2명

최대 4명까지만 레이아웃에 사용한다. 빈 자리에는 가짜 참가자 영상을 만들지 않고, 오른쪽 열이 비었을 때만 단순한 `친구를 기다리는 중` 슬롯을 표시할 수 있도록 했다.

## 5. GAME BOARD 구성

`src/components/game-room/GameBoard.tsx`에 확장 가능한 phase 타입을 추가했다.

```ts
export type GameBoardPhase =
  | 'waiting'
  | 'countdown'
  | 'game'
```

이번 단계에서 실제 렌더링되는 기본 상태는 `waiting`이다.

구성:

- `GameBoardHeader`: 중립 아이콘, `GAME BOARD`, 상태 `대기 중`
- `GameChatPanel`: 기존 채팅 메시지 목록과 입력창 역할
- `GameBoardEmptyState`: 채팅이 없을 때 대기 문구 표시

빈 상태 문구:

- `게임 시작 전 가볍게 대화해 보세요.`
- `친구들이 모두 입장하면 게임이 시작됩니다.`

Game/Chat 전환 탭은 만들지 않았다. Chat 단일 탭 UI도 제거했다.

## 6. 기존 채팅 기능 재사용 방식

기존 LiveKit 채팅 송수신 로직은 그대로 유지했다.

- 송신 함수: `src/pages/MeetingRoomPage.tsx`의 `sendChatMessage()`
- 메시지 상태: `chatMessages`
- 송신 가능 상태: `canSendChatMessage`
- 송신 피드백: `chatSendMessage`
- LiveKit data topic: `meet-meet-chat`
- 변환/발행 구조: `src/services/livekitChatService.ts`

변경점은 표시 위치뿐이다. 기존 우측 `ConversationPanel` 대신 `GameBoard` 내부의 `GameChatPanel`로 props를 전달한다.

## 7. 참가자 카드

`src/components/game-room/ParticipantGameCard.tsx`를 추가했다.

포함 항목:

- 참가자 영상
- 표시 이름
- 본인 표시 `나`
- 호스트 표시 `HOST`
- 마이크 ON/OFF 표시
- 카메라 OFF 대체 화면
- 로컬 카메라 연결 끊김 안내와 설정 복귀 버튼
- speaking/selected 표시

제외 항목:

- 언어 표시
- 번역 상태
- 자막 오버레이
- 회의 전용 배지

향후 `ParticipantGameStatus`를 붙일 수 있도록 `.participant-game-status-slot` 오버레이 영역을 비워 두었다. 목숨, 공격자, 탈락, 관전자, 점수, 웃음 판정은 구현하지 않았다.

## 8. 제거한 회의·언어 UI

초기 게임방 화면에서 다음 UI가 보이지 않도록 했다.

- 오른쪽 독립 채팅 사이드 패널
- `ConversationPanel`의 Chat 단일 탭
- 참가자 카드의 언어 표시
- 참가자 카드의 자막 영역
- 번역/Transcript 전환 UI

관련 legacy 컴포넌트와 서비스 파일은 삭제하지 않았다.

## 9. 반응형 처리

`src/App.css`에 `MEET MEET game room` 섹션을 추가했다.

주요 클래스:

- `.meeting-layout.meet-meet-game-layout-shell`
- `.meet-meet-room-layout`
- `.participant-column`
- `.participant-game-card`
- `.meet-meet-board-shell`
- `.game-board`
- `.game-chat-panel`
- `.game-chat-list`
- `.game-chat-composer`

Desktop:

- `left / board / right` 3열 grid
- 좌우 참가자 카드는 16:9 비율 유지
- 참가자 2명 열은 위아래 균등 배치

Tablet:

- 보드를 첫 번째 영역으로 표시
- 참가자 카드는 보드 아래 2열 또는 1열로 재배치

Mobile:

- 보드를 우선 표시
- 참가자 카드는 아래 1열
- 하단 공통 컨트롤 영역을 침범하지 않도록 padding 유지
- 가로 스크롤이 생기지 않도록 grid 폭을 제한

## 10. 빌드 결과

실행 명령:

```bash
npm run build
```

결과:

```text
✓ built in 189ms
```

Vite chunk size warning은 발생했다.

```text
(!) Some chunks are larger than 500 kB after minification.
```

이는 기존 LiveKit lazy chunk 크기와 관련된 경고이며, 이번 Step 5 변경으로 인한 빌드 실패는 아니다.

추가 확인:

```bash
git diff --check
```

결과: 통과

## 11. 수동 검증 필요 항목

브라우저에서 다음 항목을 확인해야 한다.

- 1인 입장 시 왼쪽 참가자 1명 + 중앙 GAME BOARD 표시
- 2인 입장 시 왼쪽 1명 / 오른쪽 1명 배치
- 3인 입장 시 왼쪽 1명 / 오른쪽 2명 배치
- 4인 입장 시 왼쪽 2명 / 오른쪽 2명 배치
- 카메라 OFF 대체 화면
- GAME BOARD 안에서 채팅 송수신
- 참가자 퇴장 후 좌우 레이아웃 재정렬
- PC 폭에서 좌/중앙/우가 한 화면에 들어오는지
- 태블릿 폭에서 GAME BOARD 우선 배치가 유지되는지
- 모바일 폭에서 가로 스크롤이 생기지 않는지
- 나가기 및 호스트 방 종료 후 LandingPage 복귀

## 12. Step 6 권장 작업

1. `src/components/game-room/` 아래에 `ParticipantGameStatus`를 추가하고 비어 있는 overlay slot에 연결한다.
2. `src/features/game/` 또는 `src/services/gameStateService.ts`에 `GameBoardPhase`보다 상세한 게임 상태 타입을 정의한다.
3. `LOBBY`, `WAITING_FOR_PLAYERS`, `READY`, `COUNTDOWN`, `ATTACK_PREP`, `ATTACKING`, `JUDGING`, `TURN_RESULT`, `ROUND_RESULT`, `GAME_RESULT` 상태 전이 모델을 순수 함수로 먼저 작성한다.
4. LiveKit game topic 예: `meet-meet-game-state`를 추가하되, 기존 `meet-meet-chat`, `meet-meet-room-control`과 분리한다.
5. 호스트만 게임 상태를 시작/전환할 수 있도록 권한 검증 경계를 정한다.
6. 아직 UI를 크게 꾸미기보다 `GameBoard` 내부 콘텐츠가 phase에 따라 바뀌는 구조를 먼저 완성한다.
