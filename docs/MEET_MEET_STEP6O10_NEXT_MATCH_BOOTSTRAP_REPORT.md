# MEET MEET Step 6-O10 Next Match Bootstrap Report

## Summary

Step 6-O10 fixes the broken flow where a new browser session could join a post-game room, appear in Connected Participants, but never enter the next-match Fair Play and Ready bootstrap.

The room remains active after a match ends. `post-game` is treated as a waiting state for the next match, and the next match roster is derived from the currently connected LiveKit participants.

## Changed Files

- `src/pages/MeetingRoomPage.tsx`
- `scripts/meet-meet-room-lifecycle-check.mjs`
- `docs/MEET_MEET_STEP6O10_NEXT_MATCH_BOOTSTRAP_REPORT.md`

## Root Cause

The regression had two related causes in `MeetingRoomPage.tsx`.

First, the central Fair Play UI and local Fair Play detector depended on `gameState.fairPlay.check.activePlayerIdentities`. After Match 1 ended, a newly joined participant such as Jun could be present in LiveKit participants but not yet present in the authoritative Fair Play snapshot. That made the Game Board keep rendering `0 / 2 READY` without starting Jun's local Fair Play check.

Second, server-origin `game-state-snapshot` messages were guarded by the client's currently expected host identity. During post-game host handoff, a client could still expect the eliminated old host while the server snapshot already contained the successor host. That stale expectation could reject the server snapshot that should have repaired host authority and next-match state.

## Participant Join Flow

The fixed client flow is:

1. New participant joins the existing LiveKit room.
2. `displayedParticipants` updates from the connected LiveKit roster.
3. In pre-game phases including `post-game`, `fairPlayCheckParticipantIdentities` is derived from the current visible roster, not only the previous snapshot roster.
4. The local participant receives a fallback waiting Fair Play status if the authoritative snapshot has not arrived yet.
5. Jun's browser can start local Fair Play immediately.
6. Jun publishes `fair-play-check-status`.
7. The current host aggregates it in `applyFairPlayCheckStatusFromHost`.
8. The host publishes the authoritative `game-state-snapshot`.

## Fair Play Session Scope

`createFairPlayCheckState` continues to preserve previous participant Fair Play status when the same identity remains in the room.

- Kunan remains in the room: previous `passed=true` can be preserved.
- Jun joins as a new participant/session: fallback and host snapshot create `passed=false`, `step='camera'`, `fairPlayRequired=true` behavior.
- Removed participants are filtered out of post-game Fair Play state by `scopePostGameSnapshotToRoster`.

## Ready Match Scope

Ready state remains separate from Fair Play.

The lifecycle check now verifies that when B wins Match 1 and C joins:

- B remains host.
- Match 2 roster is `[B, C]`.
- B keeps Fair Play pass.
- B's Ready resets to false.
- C starts with Fair Play required and not passed.
- All-ready only becomes true after both current participants are ready.

## Host Authority

Server-origin room snapshots are now accepted based on server authority plus room/meeting validation in `shouldAcceptServerRoomSnapshot`, instead of being rejected because the local client still expected the previous host.

Host-authored participant snapshots are still validated against the expected host. Guests still cannot change phase, ready aggregate, attacker, turn order, or match lifecycle directly.

## Logging

Development logs now expose the next-match bootstrap path:

- `[fair-play] required roster`
- `[next-match] bootstrap snapshot publish`
- existing `[post-game]`, `[rejoin]`, `[host-transfer]`, and `[ready]` state logs

These logs make it visible whether stale participants such as the eliminated Ken Choi remain in the next-match roster.

## Test Results

- `npm run lint`: passed
- `node scripts/meet-meet-room-lifecycle-check.mjs`: passed
- `npm run build`: passed

`npm run build` still reports the existing Vite chunk-size warning, but the production build succeeds.

## Manual Test Procedure

1. Create a 2-player room.
2. Join as Host Ken and Guest Kunan.
3. Finish Match 1 so Ken is eliminated and Kunan remains.
4. Confirm Kunan remains in post-game chat and is the current host.
5. Join as Jun from a new browser session using the same room code.
6. Confirm Connected Participants shows Kunan and Jun only.
7. Confirm Jun sees Fair Play Check automatically.
8. Confirm Kunan sees Jun as checking/passed summary.
9. Pass Jun Fair Play.
10. Confirm Ready becomes available for both Kunan and Jun.
11. Ready both participants and confirm `2 / 2 READY`.
12. Start manually or wait for auto start.
13. Confirm Match 2 starts with fresh lives and fresh role selection.

## Remaining Limitations

- This hotfix keeps the existing client-host authoritative game state architecture.
- A future server-side match lifecycle state machine would make next-match bootstrap less dependent on the current host client being alive and data-ready.
