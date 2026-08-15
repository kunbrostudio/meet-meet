# MEET MEET Step 6-O4 Critical Hotfix Report

## Changed Files

- `src/types/game.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`
- `src/services/livekitConnectionService.ts`
- `server/index.ts`
- `src/pages/MeetingRoomPage.tsx`
- `docs/MEET_MEET_STEP6O4_CRITICAL_HOTFIX_REPORT.md`

## Auto Start Reset Root Cause

The previous 10-second auto start was based on a local effect-local `startedAt = Date.now()`.

When ALL READY remained true but React dependencies changed from ready sync, Fair Play sync, LiveKit participant updates, or snapshot refreshes, the auto-start effect was allowed to rebuild its local timer. Each rebuild produced a fresh local `startedAt`, so the UI countdown could return to `10` instead of reaching `0`.

## Existing Timer / Effect Structure

Before this hotfix, auto start used:

- a Host-only `setTimeout` to call `handleStartGame()`
- a local `setInterval` to update `autoStartRemainingSeconds`
- effect dependencies including `canStartGame` and `handleStartGame`

The actual 3-second match countdown still uses Host authoritative `countdownStartedAt`.

## Deadline Based Change

`GameStateSnapshot` now includes:

- `autoStartAt?: string`

When ALL READY enters `ready` and no deadline exists, Host publishes one authoritative snapshot with:

- `phase: 'ready'`
- `autoStartAt = Date.now() + 10_000`

If a later render/snapshot refresh sees the same ready state with `autoStartAt` already set, it preserves the existing schedule and logs:

- `[auto-start] existing schedule preserved`

Clients display remaining seconds from:

`ceil((Date.parse(autoStartAt) - Date.now()) / 1000)`

The displayed number is no longer the authoritative state.

## Authoritative Auto Start Owner

Only the current Room Host triggers auto start when:

- `phase === 'ready'`
- `autoStartAt` exists
- `Date.now() >= autoStartAt`
- current snapshot still matches that same `autoStartAt`

Guests only render the synced deadline and follow the Host snapshot.

## Manual Start Result

Manual `GAME START` still calls `handleStartGame('manual')`.

The handler:

- clears the auto-start timeout/interval
- resets the local auto-start UI value
- uses `matchStartInFlightRef` to ignore duplicates
- immediately publishes `phase: 'countdown'`

Expected result: manual start cancels the 10-second deadline and enters the `3 -> 2 -> 1 -> START` match countdown once.

## Auto Start Result

When the deadline is reached, Host calls `handleStartGame('auto')` once.

Expected result: the 10-second countdown reaches `0`, then Host publishes the normal match countdown snapshot once.

## Host Succession Existing Behavior

Before this hotfix, server room state had a single `hostParticipantIdentity` and a host token hash. If the original Host was removed from LiveKit, remaining Guests could see game results but could not become the authoritative room controller.

## Join Order Implementation

Server `FreeBetaParticipant` already had stable `joinedAt`.

The hotfix uses `joinedAt` as the MVP join-order source:

- lowest `joinedAt`
- excluding the removed/leaving Host
- becomes successor

The room now also stores the current raw `hostControlToken` in memory so the successor can continue room operations in the current development session.

## Host Removal Before Succession

For `/api/livekit/remove-participant`, if the target is the current Host and other participants remain:

1. Server selects successor by `joinedAt`.
2. Server changes room registry host identity/session/token to successor.
3. Server responds with `hostChanged`.
4. Actual LiveKit removal of the old Host is delayed briefly.
5. Old Host client publishes `host-changed` over room-control.
6. Clients update HOST badge and local Host authority before old Host disappears.

## Host Changed Client Sync

Added room-control message:

- `type: 'host-changed'`

Payload includes:

- previous Host identity
- new Host identity
- new Host display name
- new Host control token
- reason
- changed timestamp

Clients apply `roomHostParticipantIdentity` as a role override, so HOST badge and host-only authority move even if existing LiveKit metadata still says `participant`.

Only the client whose identity matches the new Host stores `newHostControlToken`.

## 1:1 Host Elimination Result

Code path expectation:

1. Host Life becomes `0`.
2. Host is marked `ELIMINATED`.
3. Server selects the remaining Guest as successor.
4. Guest receives `host-changed` and becomes Room Host.
5. Old Host is removed from LiveKit.
6. Remaining Guest can publish post-game reset as Host.

## Game Over To Post Game Result

The existing Game Over timer remains Host-authoritative.

The critical fix is that after Host elimination, the remaining Guest can become Host before/around the Game Over window, allowing the existing post-game transition effect to run and publish a reset snapshot back to `waiting`.

Post-game still preserves:

- room code
- connected participants
- chat
- timeline/history

Match transient state is cleared by the existing post-game reset snapshot.

## New Player Join Result

Server join policy remains open for an active room with capacity.

If the original Host rejoins after removal, they are inserted as a normal participant with a new `joinedAt`, so they do not automatically regain Host authority.

## Second Match Result

After post-game reset:

- ready identities are cleared
- Fair Play state is cleared
- previous player states/lives/roles are cleared
- Room Host is the successor

The same room can proceed through Fair Play, Ready, auto/manual start, and the next match.

## Multi-player Succession Result

For A/B/C/D with A as Host:

- if A is removed,
- server sorts remaining participants by `joinedAt`,
- B becomes Host regardless of lives or score.

Life values are not used for succession.

## Verification

- `npm run lint`: passed
- `npm run build`: passed

Build note: Vite still reports the existing large chunk warning after minification. The build completed successfully.

## Manual 2-Browser Test Status

This CLI environment cannot directly operate Normal Chrome + Incognito Chrome with camera/LiveKit interaction.

Required manual verification remains:

1. Host + Guest enter the same room.
2. Both pass Fair Play and Ready.
3. Confirm auto start counts down from `10` without resetting.
4. Confirm `3 -> 2 -> 1 -> START` runs once.
5. Eliminate Host in a Life 1 match.
6. Confirm Guest becomes Host and sees post-game chat/lobby recovery.
7. Join a new player to the same room.
8. Confirm a second match can start with the same room code.

