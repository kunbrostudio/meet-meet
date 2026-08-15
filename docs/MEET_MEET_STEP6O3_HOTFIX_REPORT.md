# MEET MEET Step 6-O3 Hotfix Report

## Changed Files

- `src/pages/MeetingRoomPage.tsx`
- `docs/MEET_MEET_STEP6O3_HOTFIX_REPORT.md`

## Countdown Reset Root Cause

The match start flow had two start paths:

- Host manual `GAME START`
- Host 10-second auto start

`handleStartGame()` cleared the auto-start timer, but the actual countdown snapshot was applied through a deferred `setTimeout(0)`. That left a short race window where another start path or pending pre-start update could still see the room as `ready` and create a second countdown snapshot with a new `countdownStartedAt`.

That second snapshot is the practical cause of the observed countdown returning to `3` instead of continuing into the match.

## Duplicate Timer / Event Findings

No separate Guest-owned match countdown publisher was added. Guests still follow the Host authoritative `game-state-snapshot`.

The risky overlap was on the Host:

- auto-start timeout
- auto-start display interval
- manual start handler
- deferred countdown snapshot application

## Manual / Auto Start Collision Fix

`MeetingRoomPage.tsx` now uses:

- `matchStartInFlightRef`
- `cancelGameAutoStartTimers(reason)`

When Host manual start or auto start begins:

- the auto-start timeout is cleared
- the auto-start display interval is cleared
- `autoStartRemainingSeconds` is reset
- `matchStartInFlightRef` blocks duplicate start attempts
- the countdown snapshot is applied immediately instead of through `setTimeout(0)`

`onStartGame` is passed as `() => handleStartGame('manual')`, so React click events cannot accidentally become the start source argument.

## Match Start Authoritative Source

The Host remains the only authority for:

- transition from `ready` to `countdown`
- `countdownStartedAt`
- transition from `countdown` to `game-started`
- first round role selection after `game-started`

Guests still apply only the Host snapshot.

## Countdown Reset Prevention

Once `matchStartInFlightRef` is set, repeated start attempts are ignored until the match returns to a pre-game phase (`waiting` or `ready`) for a future match.

Development-only logs were added under the `[match-start]` prefix for:

- auto-start scheduled
- auto-start cancelled
- host manual start
- auto-start fired
- countdown started
- match started
- duplicate start ignored

The logs are gated by `import.meta.env.DEV`.

## Life 0 Kick Root Cause

The elimination cleanup effect in `MeetingRoomPage.tsx` skipped removed targets whose `meetingRole` was `host`.

That came from the previous room/match lifecycle protection, but it conflicted with the current DON'T LAUGH rule:

`Life <= 0` means `ELIMINATED` and actual LiveKit room removal.

## Restored Room Removal Path

The hotfix removes only the client-side host skip guard.

Eliminated participants now use the existing removal path:

1. Host sees `playerState.eliminated === true`.
2. Host schedules one removal timer per eliminated identity.
3. Host publishes a `participant-kicked` meeting control message with `reason: 'eliminated'`.
4. Target local client calls `markParticipantKicked('eliminated')`.
5. Host calls `removeLiveKitParticipant()`.
6. Server `POST /api/livekit/remove-participant` validates the original host identity and `hostControlToken`.
7. Server calls `RoomServiceClient.removeParticipant()`.

This reuses the existing LiveKit/server removal mechanism and does not introduce a new kick system.

## Host Elimination Result

Host elimination is no longer blocked by `targetParticipant.meetingRole === 'host'` in the client cleanup effect.

The existing server removal endpoint does not call `/api/free-beta/rooms/leave`, so this removal path does not close the room through the host-leave code path.

Current limitation: the server still has no explicit host-transfer API/token handoff. If a later flow needs the remaining player to moderate or start another match after the original Host has been removed, a dedicated host-transfer step should be added.

## Guest Elimination Result

Guest elimination continues through the same existing removal path:

- only the eliminated Guest is removed
- Host remains connected
- the one-life-per-attack guard remains unchanged

## Rejoin Result

This hotfix does not change room join policy.

Because match-scoped state is reset after post-game, a removed player who rejoins by room code is expected to enter as a fresh participant for the next match instead of restoring prior `Life 0` or role state.

## Test Procedure

Manual browser test checklist:

1. Normal Chrome Host and Incognito Guest join the same room.
2. Both pass Fair Play and become Ready.
3. Host clicks `GAME START`.
4. Confirm auto-start is cancelled and countdown runs `3 -> 2 -> 1 -> START` once.
5. Confirm Round 1 role selection / attack flow is reached.
6. Repeat without Host clicking `GAME START` and confirm auto-start triggers countdown once.
7. Set or run a Life 1 scenario, trigger Guest laugh, and confirm Guest receives eliminated kick notice and leaves the room.
8. Set or run a Life 1 scenario, trigger Host laugh, and confirm Host receives eliminated kick notice while the LiveKit room is not closed via host leave.
9. Rejoin removed player with the same room code and confirm previous match life/role is not restored.

## Verification

- `npm run lint`: passed
- `npm run build`: passed

Build note: Vite still reports the existing large chunk warning after minification. The build completed successfully.
