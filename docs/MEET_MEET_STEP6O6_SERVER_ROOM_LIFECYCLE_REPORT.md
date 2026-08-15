# MEET MEET Step 6-O6 Server Room Lifecycle Report

## Scope

Step 6-O6 fixes the failed O5 Normal Chrome + Incognito lifecycle by moving host succession and post-game transition authority to the Express room registry and LiveKit server-side data publish path.

## Changed Files

- `server/index.ts`
- `src/App.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `src/components/game-room/PlayerGallery.tsx`
- `src/components/livekit/LiveKitTestRoom.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/services/livekitChatService.ts`
- `src/services/livekitConnectionService.ts`
- `src/services/roomService.ts`
- `src/types/game.ts`
- `src/types/meeting.ts`
- `scripts/meet-meet-room-lifecycle-check.mjs`

## O5 Audit Answers

A. `hostParticipantIdentity` exists in server Room state in `FreeBetaRoom.hostParticipantIdentity`. O5 also mirrored it into client React state, but server state is now treated as authoritative.

B. Before this fix, `GAME_OVER -> POST_GAME` was executed by a `MeetingRoomPage` host-side React timer in the `game-over` effect.

C. When the old Host was eliminated and kicked, that browser could disappear before executing the post-game transition. That left the winner Guest stuck on `attack-ended` or stale game-over lifecycle.

D. O5 persisted the new host into `room.hostParticipantIdentity`, but server-side LiveKit `host-changed` publish was missing. Clients depended on the old Host browser to publish the event.

E. Join and token responses now include `hostParticipantIdentity`, current participant list, and `gameState`, so rejoining participants receive the current server Host and room phase.

## Server Authoritative Lifecycle

- Added `FreeBetaRoom.matchState` with `phase`, `matchId`, `revision`, `gameOverAt`, `postGameAt`, and `winnerParticipantIdentity`.
- Added room-specific `postGameTimers`.
- Added deadline reconciliation through `reconcileRoomLifecycle(room)`.
- Added `createServerGameStateSnapshot(room)` and included it in create, join, token, and remove responses.
- Added LiveKit server-side data publish through `RoomServiceClient.sendData`.

## Host Transfer

`transferRoomHost(...)` now remains the only server-side host succession path. The server logs:

- `[room-host] transfer requested`
- `[room-host] previousHost=<identity>`
- `[room-host] successor=<identity>`
- `[room-host] room host persisted=<identity>`
- `[room-host] host-changed published`
- `[room-host] previous host removed`

When the removed participant is the current Host, the server:

1. Selects the earliest `joinedAt` successor.
2. Persists `room.hostParticipantIdentity`.
3. Generates a new host control token.
4. Publishes public `host-changed` to the room.
5. Publishes private `host-changed` with `newHostControlToken` only to the successor identity.
6. Removes the previous host from the room registry.
7. Starts server `GAME_OVER` when only one participant remains.

## Post-Game Transition

On server `GAME_OVER`, the room stores:

- `phase = "game-over"`
- `gameOverAt = Date.now()`
- `postGameAt = gameOverAt + 4000`

The server schedules one timer per room/match. The timer callback revalidates:

- room still exists
- same `matchId`
- current phase is still `game-over`

Then it transitions to:

- `phase = "post-game"`
- new `matchId`
- incremented revision

If a dev server restart loses the in-memory timer, `reconcileRoomLifecycle(room)` normalizes expired `game-over` state on room join/token access.

## Client Handling

- Added `post-game` to `GamePhase`.
- `GameBoard` treats `post-game` as pregame chat/ready mode.
- `MeetingRoomPage` no longer performs client-side `GAME_OVER -> POST_GAME` publish. It waits for server authoritative snapshots.
- Server `game-over` / `post-game` snapshots can override high local client revisions when they match the same room.
- `LiveKitTestRoom` now allows `host-changed` on the room-control topic. This was a direct receiver gap.
- Token responses can apply server `hostParticipantIdentity`, `hostControlToken`, and `gameState` immediately after connection.

## Room Rejoin

Server create/join/token responses now include:

- `roomCode`
- `hostParticipantIdentity`
- participant list ordered by `joinedAt`
- current `gameState`
- current participant role
- host control token only when the current session participant is the server Host

The original room creator does not regain Host role on rejoin unless the server room state says so.

## Verification

Commands run:

- `npm run lint` - passed
- `node scripts/meet-meet-room-lifecycle-check.mjs` - passed
- `npm run build` - passed
- `npm run lint` - passed again after final patches

Browser manual verification still required:

1. Normal Chrome creates a 2-player room.
2. Incognito joins.
3. Host reaches Life 0 and is eliminated.
4. Server transfers host to Guest before kicking old Host.
5. Guest tile shows `HOST`.
6. Guest receives `game-over`, then server `post-game` after about 4 seconds.
7. Board returns to chat/ready mode.
8. Old Host rejoins with the same room code and remains a normal participant.

## Remaining Limits

- Room/match state is still in-memory, so server restart loses active rooms.
- The new lifecycle script validates the core transition rules but is not a real LiveKit browser integration test.
- Attack history/chat persistence still follows the existing local/runtime behavior.

## Next Step

Step 6-O7 should add a small automated server integration harness around room create, join, host removal, server publish fallback, rejoin, and token response validation.
