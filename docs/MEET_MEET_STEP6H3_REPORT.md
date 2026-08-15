# MEET MEET Step 6-H3 Report

## Purpose

Step 6-H3 fixes the attack resolution path after laugh damage and changes the pre-game Fair Play flow from a room-wide phase into per-player local checks on room entry.

## Changed Files

- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/types/game.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`

## Attack Resolution

- `GameStateSnapshot.attackEndReason` now records why an attack ended:
  - `all-defenders-hit`
  - `timeout`
- `applyFairPlayEventFromHost` keeps one-life-per-attack as a defender identity set with `penalizedParticipantIdentitiesForCurrentAttack`.
- When a defender laugh event is accepted, the Host compares the updated hit set against the current active defenders.
- If all active defenders have been hit, the Host clears the attack timeout and publishes an `attack-ended` snapshot immediately.
- If the attack timer reaches `attackEndsAt` first, the Host publishes an `attack-ended` snapshot with `attackEndReason: 'timeout'`.
- Guest clients only display the authoritative Host snapshot; they do not locally end the attack.

## Multi-Defender Success Rule

The active defender list is calculated from `defenderIdentities` minus eliminated players. The attack ends early only when every active defender for that attack appears in `penalizedParticipantIdentitiesForCurrentAttack`.

This supports:

- 1:1: the single defender laughing ends the attack immediately.
- 3-4 players: the attack continues until all active defenders are hit or the timer ends.

## Turn Handoff

- The existing Host-owned `attack-ended -> round-ended -> attack-ready` transition path is preserved.
- `getAlivePlayerIdentities` and `getNextAttackerIdentity` continue to skip eliminated players.
- Attack content, attack timer fields, and per-attack hit state are cleared before the next attack preparation state.
- Duplicate attack ending is avoided by checking the current phase, attack sequence, and `attackEndsAt` before timeout resolution, and by clearing the timeout when early completion happens.

## Fair Play On Join

- Fair Play Check is no longer started by the old `auto-start-pending -> fair-play-check` room-full timer path.
- Each participant can run the local Fair Play detector during pre-game phases:
  - `waiting`
  - `ready`
  - legacy `auto-start-pending`
  - legacy `fair-play-check`
- The Host maintains `fairPlay.check` for the currently visible participant roster.
- Camera OFF before game start publishes a camera-required status and invalidates pass state.
- A participant who already passed and still has a live camera does not restart the local face check loop.
- Countdown starts only when the room is full and all active participants have passed Fair Play.

## UI

- `GameBoard` now shows the Fair Play Check panel during normal pre-game waiting/ready states when check participants exist.
- `GameBoard` displays a different attack-ended message for:
  - all defenders hit
  - timer timeout
- No layout redesign or LiveKit media changes were made.

## Validation

- `npm run lint`: passed
- `npm run build`: passed

Build completed with the existing Vite chunk-size warning only.

## Manual Test Procedure

1. Host opens a room with camera enabled.
2. Guest joins with camera enabled.
3. Confirm each client runs its own Fair Play Check after entering the room.
4. Confirm Host Game State shows both participants passed.
5. Confirm countdown starts only after the room is full and all active participants pass.
6. Start an attack in 1:1 and make the defender laugh.
7. Confirm defender loses only one life and attack ends immediately with `all-defenders-hit`.
8. Start another attack and do not trigger laugh.
9. Confirm attack ends at timer zero with `timeout`.
10. Confirm next attacker is the next alive participant in `turnOrder`.

## Remaining Limits / Next Step

- No win animation or detailed attack result summary was added.
- No spectator or reconnect restoration policy was changed.
- The next step should add a clearer round result presentation and then harden reconnect behavior for mid-round attack state.
