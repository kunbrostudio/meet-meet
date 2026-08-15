# MEET MEET Step 6-O Report

## Changed Files

- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameChatPanel.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6O_REPORT.md`

## Game Phase List Used

The current project uses these `GamePhase` values from `src/types/game.ts`:

- `waiting`
- `ready`
- `auto-start-pending`
- `fair-play-check`
- `countdown`
- `game-started`
- `role-reveal`
- `attack-ready`
- `attack-active`
- `attack-ended`
- `round-result`
- `round-ended`
- `game-over`
- legacy/compatibility phases: `attack-prep`, `attacking`, `turn-result`, `game-result`

## Phase-Based Timeline Visibility

`GameBoard` now shows the timeline/chat panel only for:

- `waiting`
- `ready`

The timeline/chat panel is hidden for active gameplay phases:

- `auto-start-pending`
- `fair-play-check`
- `countdown`
- `game-started`
- `role-reveal`
- `attack-ready`
- `attack-active`
- `attack-ended`
- `round-result`
- `round-ended`
- `game-over`

Timeline data is still accumulated by `MeetingRoomPage`; only the `GameChatPanel` render is hidden during gameplay.

## Chat Input Hide 방식

Chat input remains inside `GameChatPanel`.

Because `GameChatPanel` is no longer rendered outside `waiting` / `ready`, both the timeline list and composer are hidden together during game-focused phases. This avoids changing chat transport or LiveKit sync code.

## Game Stage Expansion

`GameBoard` already had the `is-gameplay-focused` class for phases without chat/timeline. Tightening `shouldShowChatTimeline` makes the existing focused layout apply to Fair Play, countdown, attack, result, transition, and game-over phases.

The existing `.meeting-page .game-board.is-gameplay-focused .game-board-ready-panel` styles give the main game stage the freed space.

## attackId Grouping

`GameChatPanel` keeps the existing `TimelineViewItem` grouping by `attackId`:

- `GameTimelineEvent` type `attack`
- `GameTimelineEvent` type `attack-result`

Events with the same `attackId` render as a single `AttackTimelineCard`.

No timestamp-based matching was added.

## Unified Attack Card

Implemented in:

- `src/components/game-room/GameChatPanel.tsx`
- `AttackTimelineCard`

One card contains:

- attacker name
- `[ATTACK]` label
- timestamp
- attack image
- result title/message
- defender hit state
- `♥ -1`
- `ELIMINATED` when present

Attack images still use `downloadAttackContentBlob`, object URLs, and the existing max-height/object-fit CSS.

## System Result 중복 제거

`GameChatPanel` now derives a set of participants already marked eliminated inside grouped `attack-result` events.

Standalone `elimination` timeline events for those participants are skipped, preventing:

- unified attack result card
- plus duplicate elimination system card

Unrelated non-attack system events can still render normally.

## Game Over UI

`GameBoard` now receives existing authoritative game state fields:

- `activePlayerIdentities`
- `attackSequence`
- `playerStates`

The `game-over` phase renders a dedicated final result panel with:

- `GAME OVER`
- `WINNER`
- winner name
- final lives per active player
- `WINNER` / `ELIMINATED` labels
- total attack count from existing state

Timeline is not rendered under the game-over result.

## Mobile Verification

Code-level verification:

- Mobile uses the same `GameBoard` render policy.
- Hiding `GameChatPanel` during gameplay also removes the chat composer on mobile.
- Existing mobile player rail, bottom control bar, and GAME / PLAYERS mode logic were not changed.

Manual browser viewport verification is still recommended for:

- 375x667
- 390x844

## Desktop Verification

Code-level verification:

- Desktop keeps the existing left participants / center board / right participants layout.
- Focused gameplay phases use the existing `is-gameplay-focused` board expansion styles.
- Participant tile UI was not modified.

Manual two-browser gameplay verification is still recommended.

## Lint / Build

- `npm run lint`: passed
- `npm run build`: passed

Build completed with the existing Vite chunk-size warning only.
