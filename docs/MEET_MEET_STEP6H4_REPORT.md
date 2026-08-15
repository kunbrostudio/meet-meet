# MEET MEET Step 6-H4 Report

## Changed Files

- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameChatPanel.tsx`
- `src/services/livekitChatService.ts`
- `src/types/game.ts`
- `server/index.ts`
- `src/App.css`

## Turn Rotation Root Cause

The Guest-fixed attacker bug was caused by double-advancing the turn.

The Host already calculated the next attacker during the `attack-ended -> round-ended` transition. After that, the existing `round-ended` auto handoff called `handleStartNextRound()`, which calculated the next attacker again before entering `attack-ready`.

In a 2-player room this produced:

1. Guest attacks.
2. `attack-ended -> round-ended` advances to Host.
3. `round-ended -> attack-ready` advances again to Guest.
4. Guest appears fixed as attacker.

Host was not excluded from the turn roster. The roster uses stable `participantIdentity`, not display name or `meetingRole`.

## Turn Rotation Fix

- `handleStartNextRound()` now treats `round-ended` as an already-advanced transition state.
- `round-ended -> attack-ready` keeps the attacker already stored in the Host authoritative snapshot.
- `round-result -> attack-ready` can still calculate the next attacker for the older/manual result path.
- `getNextAttackerIdentity()` remains identity-based and skips eliminated players via `playerStates`.

Expected 2-player sequence:

`A -> B -> A -> B -> A -> B`

Expected 4-player sequence:

`A -> B -> C -> D -> A`, with eliminated players skipped.

## Elimination Removal

- When a player reaches `lives: 0`, the Host authoritative game state marks that player as `eliminated`.
- All clients receive the elimination snapshot first, so the eliminated player sees the result state.
- After about 2 seconds, the Host calls the existing server-side `removeLiveKitParticipant()` path.
- The LiveKit control message now supports `reason: 'eliminated'`.
- Removed players see an eliminated/kicked state and return through the existing removal flow.

## Host Elimination Policy

Host and Guest remain separate from game roles. Host can be attacker, defender, and eliminated.

Current architecture still stores room management authority on the original Host through `hostControlToken` and LiveKit `roomAdmin`. This step separates game elimination from manual Host leave, but it does not implement full management authority succession after Host elimination. That should be handled in a later Host handoff step if longer post-Host-elimination games are required.

## Unified Game Room Timeline

Added a room-session timeline in `GameChatPanel` that merges:

- `chat`
- `attack`
- `attack-result`
- `elimination`
- `system`

The timeline is sorted by timestamp in ascending order. Existing chat sending and LiveKit chat transport were not changed.

Attack events are generated from Host snapshots when an attack becomes active. Attack result events are generated when the attack ends. Elimination events are generated from `playerStates`.

## Attack Asset Lifetime

The server no longer deletes the same uploader's previous attack image on new upload. Attack images remain available for the room lifetime so older timeline attack cards can still load thumbnails.

Existing cleanup remains:

- room end cleanup
- room expiry cleanup
- startup stale temp directory cleanup

## Tooltip Portal Fix

Root cause: the room code copy tooltip was rendered inside the header clipping/stacking context, so z-index alone could not prevent clipping.

Fix:

- The tooltip is now rendered with a React Portal to `document.body`.
- It is anchored to the room code button using `getBoundingClientRect()`.
- Position updates on scroll and resize while visible.
- Existing tooltip visual styling is reused.

## Manual Test Plan

1. Start a 2-player room with Host A and Guest B.
2. Force or observe B attacking first.
3. End the attack by laugh detection.
4. Confirm next `attack-ready` attacker is A, not B again.
5. Repeat for at least 6 attacks and confirm alternation.
6. Start a Life 1 room and make a defender lose one life.
7. Confirm `ELIMINATED` is visible before removal.
8. Confirm the eliminated participant is removed from LiveKit and returns through the removal flow.
9. Send chat messages before and after attacks.
10. Confirm chat, attack image, attack result, and elimination events appear in one chronological timeline.
11. Run multiple attacks and scroll upward to confirm previous attack thumbnails still load.
12. Click room code and confirm the copy tooltip is not clipped by the header.

## Validation

- `npm run lint`: passed
- `npm run build`: passed

Build completed with the existing Vite chunk-size warning only.
