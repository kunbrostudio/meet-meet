# MEET MEET Step 6-O8 Next Match Host Verify Report

## Scope

Step 6-O8 verifies and tightens the post-game room lifecycle after the O7 hotfix:

- Winner host visibility
- Host authority after old Host elimination
- Next match clean restart state
- Duplicate `GAME RESULT` timeline prevention

## Host State After Ken Elimination

Code path:

- `server/index.ts`
- `transferRoomHost(room, removedParticipantIdentity, "host_eliminated")`
- `/api/livekit/remove-participant`

When Ken Choi is the current Host and is removed, the server selects the earliest `joinedAt` remaining participant as successor. In the 2-player Ken/Kunan case, the expected server state is:

- `hostParticipantIdentity = Kunan identity`
- Kunan participant `meetingRole = "host"`
- Ken removed from the room participant registry
- Room remains open
- phase is normalized to `post-game`

Added development diagnostics:

- `[room-state] { host, phase, participants }`
- emitted on create, join, token issue, and match-end post-game

## Host Transfer Success

Host transfer remains server-authoritative.

Expected Kunan authority after transfer:

- `isHost === true`
- `HOST` participant tile badge
- `GAME START` authority when ready conditions are met
- Auto Start authority
- Room lifecycle authority

Client side, `displayedParticipants` applies `roomHostParticipantIdentity` as the role override, so the `ParticipantGameCard` HOST badge follows the server host identity rather than the original room creator.

## Rejoin Host State

On Ken Choi rejoin, server join/token responses include:

- current `hostParticipantIdentity`
- participant list
- server `gameState`
- host control token only if that session participant is the current server Host

Expected state:

- Kunan remains Host
- Ken Choi rejoins as normal participant
- Ken does not regain Host merely because Ken created the original room

## Next Match Reset

`post-game` is treated as the next-match preparation state.

Cleaned match-scoped state so it does not leak into the second match:

- previous active players
- turn order
- attacker / defender identities
- role reveal timers
- attack timers
- attack content
- player lives / eliminated flags
- round result
- game over deadlines

Ready state is reset when final match end enters `post-game`.

Added `[next-match]` client dev log with:

- ready count
- host identity
- local identity
- `isHost`
- `canStart`
- phase

## Second Match Start

Expected code-level flow:

1. `post-game` displays chat/ready mode.
2. Rejoined/new participant runs local Fair Play.
3. Both participants Ready.
4. Kunan is server/current Host, so Kunan computes `canStartGame`.
5. `canStartGame` enables manual `GAME START`.
6. Existing Auto Start scheduling can run when phase becomes `ready`.
7. Countdown and Round 1 start through the existing game state sync flow.

Manual browser verification is still required for the full Normal Chrome + Incognito loop.

## Duplicate GAME RESULT Cause

Observed duplicate source:

- Local client can create a `post-game` snapshot immediately after final elimination.
- Server can also publish an authoritative `post-game` snapshot.
- Both snapshots can describe the same winner but have slightly different optional snapshot fields.
- The previous timeline id could differ between those snapshots, producing duplicate `GAME RESULT` cards.

## Duplicate Prevention

Added `processedGameResultSignaturesRef` in `MeetingRoomPage`.

`GAME RESULT` is deduped by a result signature:

- winner identity
- sorted eliminated participant identities

If the same result signature appears again within a short idempotency window, the second result is ignored.

Added development logs:

- `[game-result] published=true`
- `[game-result] duplicate ignored`

Attack log entries are not deduped by this rule; attack image, hit result, life loss, and elimination timeline entries remain intact.

## Verification

Commands run:

- `npm run lint` - passed
- `node scripts/meet-meet-room-lifecycle-check.mjs` - passed
- `npm run build` - passed

Build completed with the existing chunk size warning only.

## Manual Test Checklist

1. Ken Choi creates a 2-player room in Normal Chrome.
2. Kunan joins in Incognito.
3. Life is 1.
4. Kunan wins; Ken is eliminated and kicked.
5. Confirm server log: `[room-state] host=<Kunan identity> phase=post-game`.
6. Confirm Kunan tile shows `HOST`.
7. Confirm Kunan sees `YOU ARE HOST`.
8. Ken rejoins same room code.
9. Confirm Kunan remains Host and Ken is Player.
10. Confirm both users can pass Fair Play, Ready, and start Match 2.
11. Confirm the first match timeline has exactly one `GAME RESULT`.
