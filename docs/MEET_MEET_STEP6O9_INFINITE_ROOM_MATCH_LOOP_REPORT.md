# MEET MEET Step 6-O9 Infinite Room Match Loop Report

## Scope

Step 6-O9 fixes the stale participant problem seen after Match 1:

- Ken Choi Host is eliminated and kicked.
- Kunan remains in the room.
- Jun joins later.
- Fair Play UI incorrectly showed stale `Ken Choi CHECKING...`.

The target is an infinite room loop:

`MATCH -> POST_GAME -> participant changes -> fresh next match -> POST_GAME -> ...`

## Actual Cause

The stale Ken Choi entry came from match-scoped state being reused during post-game preparation.

Specifically:

- Previous `fairPlay.check.activePlayerIdentities` could survive into `post-game`.
- Previous `activePlayerIdentities`, `playerStates`, attacker/defender state, and ready state could remain in snapshots long enough to influence the next preparation.
- `handleStartGame` could prefer an existing `currentGameState.activePlayerIdentities` when starting a new match.

That violated the invariant:

`MATCH ROSTER ⊆ CURRENT CONNECTED ROOM PARTICIPANTS`

## Room Participants vs Match Participants

Room participants are the current LiveKit/room connected participants:

- Kunan
- Jun

Match participants are created fresh when a match starts:

- derived from current connected participants
- filtered by current match ready identities
- never cloned from previous match state

## New Match Roster Source

`handleStartGame(...)` now always creates the match roster from:

- `displayedParticipants`
- `participantCount`
- current `activeReadyParticipantIdentities`

It no longer reuses previous `currentGameState.activePlayerIdentities`.

## Fresh Match State

When a new match starts:

- new `turnOrder` is created from the fresh roster
- new `playerStates` are created from the fresh roster
- previous life/eliminated state is not reused
- previous attacker/defender state is not reused

This allows:

- Match 1: Ken / Kunan
- Match 2: Kunan / Jun
- Match 3: Kunan / Maya

without carrying old match identities forward.

## Fair Play Session Scope

Fair Play UI is now scoped to current connected participants.

Changes:

- `fairPlayCheckParticipants` filters out identities that are not in current `displayedParticipants`.
- Post-game snapshots scope `fairPlay.check` to the alive/current roster.
- Server post-game snapshots are normalized on receipt with `scopePostGameSnapshotToRoster(...)`, preserving pass state only for identities still present in the room snapshot.

Result:

- Ken Choi cannot appear in Fair Play UI after he is removed from the room.
- Kunan can keep existing pass state when identity is still connected.
- Jun appears as a new waiting/checking participant.

## Ready Match Scope

Ready is reset on final match end:

- final laugh-detection post-game path resets ready identities
- final round-transition post-game path resets ready identities

Ready is still filtered by current connected participants, so removed participants cannot remain ready.

## Host Succession

Server host succession remains the source of truth:

- current host is `FreeBetaRoom.hostParticipantIdentity`
- host transfer chooses the earliest `joinedAt` connected participant
- Kunan remains Host after Ken is eliminated
- Jun joining later does not recalculate or steal Host

The `HOST` badge follows `roomHostParticipantIdentity` on the client.

## Match 2 Roster

Expected Match 2 roster after Ken elimination and Jun join:

- Kunan
- Jun

Ken Choi is excluded because he is no longer in current connected room participants.

## Infinite Cycle

The updated cycle is:

1. Match ends.
2. Room stays alive when at least one participant remains.
3. `post-game` shows chat/ready mode.
4. New/current participants create a fresh preparation roster.
5. Fair Play is scoped to current connected identities.
6. Ready is collected for the new match.
7. Host starts the next match.
8. Fresh turn order, role, and life state are generated.

No match count limit was added.

## Diagnostics

Existing/new dev logs relevant to O9:

- `[room-state] host=... phase=... participants=...`
- `[next-match] ready=... host=... canStart=...`
- `[game-result] published=true`
- `[game-result] duplicate ignored`
- match start log now includes the fresh `roster`.

## Verification

Commands run:

- `npm run lint` - passed
- `node scripts/meet-meet-room-lifecycle-check.mjs` - passed
- `npm run build` - passed

Build completed with the existing chunk size warning only.

## Manual Test Checklist

1. Ken Choi Host and Kunan Guest play Match 1 with Life 1.
2. Ken is eliminated and kicked.
3. Confirm Kunan remains and has `HOST`.
4. Jun joins.
5. Confirm connected participants are Kunan and Jun.
6. Confirm Fair Play UI does not show Ken Choi.
7. Confirm Jun local Fair Play runs.
8. Confirm Kunan and Jun can both Ready.
9. Confirm Kunan can start Match 2 or Auto Start triggers.
10. Confirm Match 2 reaches countdown and Round 1 with roster `[Kunan, Jun]`.
