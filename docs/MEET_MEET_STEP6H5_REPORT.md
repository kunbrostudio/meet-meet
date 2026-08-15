# MEET MEET Step 6-H5 Report

## Changed Files

- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameChatPanel.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/types/game.ts`
- `src/App.css`

## Game Phase Chat Visibility

`GameBoard` now decides chat visibility from the authoritative game phase.

Chat timeline and input are visible only during:

- `waiting`
- `ready`
- `fair-play-check`

Chat timeline and input are hidden during focused gameplay phases:

- `countdown`
- `game-started`
- `role-reveal`
- `attack-ready`
- `attack-active`
- `attack-ended`
- `round-result`
- `round-ended`
- `game-over`

## Active Game Timeline Hide

The timeline is not hidden with opacity. `GameChatPanel` is not rendered while gameplay is active, so it does not occupy layout space.

Timeline data still accumulates in `MeetingRoomPage` through `gameTimelineEvents`; only the UI is hidden.

## Chat Input Hide

Because `GameChatPanel` owns both the timeline list and composer, hiding the panel also removes:

- attack history cards
- chat history
- text input
- send button
- connection feedback text

## Game Stage Layout Expansion

`GameBoard` adds `is-gameplay-focused` when chat is hidden. CSS lets `.game-board-ready-panel` flex into the available board area, so countdown, attack, result, transition, and game-over states get the freed space.

The outer board and room layout were not redesigned.

## Game Over UI

`game-over` now remains a focused board state because the timeline is hidden for that phase. The winner/result panel is visually separated from attack history and chat.

## Unified Attack Card

`GameChatPanel` now groups timeline view models by `attackId`.

Events are still stored separately:

- `attack`
- `attack-result`
- `elimination`
- `system`

The renderer groups matching `attack` and `attack-result` events into one card with:

- attacker name
- attack image
- result heading
- defender result rows
- `ELIMINATED` marker when applicable

## attackId Grouping

Grouping is not based on timestamp proximity. It uses the explicit `attackId` field already generated for attack timeline events.

Existing timeline data that has separate `ATTACK` and `ATTACK_RESULT` events remains compatible because grouping happens at render/select time.

## Desktop / Mobile Checks

Code-level checks:

- Waiting phases still render `GameChatPanel`.
- Gameplay phases do not render `GameChatPanel`.
- The same phase policy applies on desktop and mobile because it lives in `GameBoard`, not viewport-specific CSS.
- Participant rail, bottom controls, Game/Players mode, and LiveKit media flow were not changed.

Manual browser checks still recommended for:

- attack image sizing inside unified cards
- focused stage height on 375x667 and 390x844
- 2-player attack/result/next attacker visual flow

## Validation

- `npm run lint`: passed
- `npm run build`: passed

Build completed with the existing Vite chunk-size warning only.
