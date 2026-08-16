# MEET MEET Step 6-P1 Game Start Regression Hotfix Report

## 1. Actual Cause

The critical transition issue was in the Host-owned game start chain after the countdown completed.

The start flow correctly created a `countdown` snapshot with an authoritative `activePlayerIdentities` roster and `turnOrder`. However, the next Host effect that moves `game-started` into `role-reveal` recomputed the active roster from the current ready participant list instead of reusing the already-started match roster from the snapshot.

If ready/participant state changed or lagged around the transition boundary, the `game-started` effect could see fewer than 2 active players and publish a safe fallback state instead of starting Round 1.

## 2. READY to GAME START Transition Structure

Current phase flow:

- `waiting`
- `ready`
- `countdown`
- `game-started`
- `role-reveal`
- `attack-ready`
- `attack-active`

The Host remains the single authoritative publisher for:

- auto start schedule
- countdown start
- countdown completion
- role reveal start
- attacker/defender assignment

## 3. Countdown 0 Block

Countdown completion itself still transitions to `game-started`.

The block happened immediately after that when `role-reveal` attempted to bootstrap from a recomputed ready roster. The fix now prioritizes:

1. `gameState.activePlayerIdentities`
2. `gameStateRef.current.activePlayerIdentities`
3. ready roster fallback only when no started roster exists

## 4. Manual Start State

Manual `GAME START` in the ready panel still calls `handleStartGame('manual')`.

The handler now logs explicit development-only block reasons:

- non-host
- wrong phase
- insufficient connected participants
- incomplete ready count
- insufficient active roster
- incomplete fair play check
- duplicate in-flight start

No UI structure was changed.

## 5. Visibility Guard Impact

Step 6-P visibility guard was checked and remains scoped to:

- `gameState.phase === 'attack-active'`
- local role is `defender`
- local participant is not eliminated
- local participant has not already taken damage in the current attack

Visibility status is not used as a game start condition.

## 6. Modified Files

- `src/pages/MeetingRoomPage.tsx`
- `docs/MEET_MEET_STEP6P1_GAME_START_REGRESSION_HOTFIX_REPORT.md`

## 7. Host / Guest Sync

The Host publishes the authoritative snapshots over the existing LiveKit game-state snapshot path.

Guests still apply the received snapshots and do not generate roster, turn order, attacker, or defender state locally.

## 8. Auto Start Test

Expected 2-player flow:

1. Host and Guest enter the room.
2. Both complete ready state.
3. Host schedules auto start.
4. Auto start reaches 0.
5. Host publishes `countdown`.
6. Host publishes `game-started`.
7. Host reuses snapshot roster and turn order.
8. Host publishes `role-reveal`.
9. Host proceeds to `attack-ready` and `attack-active`.

## 9. Manual Start Test

Expected 2-player flow:

1. Host and Guest enter the room.
2. Both complete ready state.
3. Host clicks `GAME START`.
4. Host publishes `countdown`.
5. Countdown completion follows the same authoritative roster path.

## 10. Verification

- `npm run lint`: passed
- `npm run build`: passed
