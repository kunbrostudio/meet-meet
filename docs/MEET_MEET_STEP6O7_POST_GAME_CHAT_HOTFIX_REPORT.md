# MEET MEET Step 6-O7 Post Game Chat Hotfix Report

## Purpose

The confirmed UX is:

`GAMEPLAY -> MATCH END -> POST_GAME CHAT`

After a winner is decided, Game Board must not remain on `공격 종료` or the last attack image as the main stage.

## Why It Stopped On The Last Attack Result

Before this hotfix, final elimination could still move through:

- `attack-ended`
- `game-over`
- delayed `post-game`

That made the last attack result screen and attack image eligible to stay as the Game Board main content. In the Host-eliminated case, the old Host browser could also disappear before the delayed transition completed.

## Phase Relationship

- `attack-ended`: regular attack result, used only when the match continues.
- `game-over`: no longer used as a durable UI render phase for new match-end flow.
- `post-game`: immediate room/chat mode after winner confirmation.

Final elimination now normalizes directly to `post-game`.

## 4-Second Post Game Delay

The 4-second client constant was removed from `MeetingRoomPage`.

Server-side `startServerGameOver(...)` now writes `phase = "post-game"` immediately and publishes the server snapshot. Existing deadline helpers remain only as legacy fallback for any stale in-memory `game-over` room state.

## Game Board Chat Rendering

`GameBoard` already treats `post-game` as pregame room content:

- Chat Timeline
- Chat Input
- Ready controls
- System/game timeline cards

The header maps `post-game` to `대기 중`, so `공격 종료` no longer remains in the header after match end.

## Game Result Timeline

Added `GameTimelineEvent` type:

- `game-result`

`MeetingRoomPage` appends a single `GAME RESULT` timeline card when `phase === "post-game"` and one winner identity is present.

The last attack image is not rendered as main content in post-game. It remains in the Unified Attack Log through the existing attack timeline card.

## Role Badge Reset

Participant role badges are now passed to player cards only during gameplay role phases:

- `role-reveal`
- `attack-ready`
- `attack-active`
- `attack-ended`
- `round-result`
- `round-ended`

In `post-game`, `ATTACKER` / `DEFENDER` badges are hidden. `HOST` remains because it is room authority, not match role.

## Host Succession

The O6 server-host succession path remains intact:

- server selects successor by `joinedAt`
- server persists `hostParticipantIdentity`
- server publishes `host-changed`
- new Host can receive the private host control token
- rejoin responses include current server Host and `post-game` snapshot

## Verification

Commands run:

- `npm run lint` - passed
- `node scripts/meet-meet-room-lifecycle-check.mjs` - passed
- `npm run build` - passed

Manual browser verification still required:

1. Normal Chrome Host and Incognito Guest join a 2-player room.
2. Set Life to 1.
3. Guest attacks.
4. Host laughs and is eliminated.
5. Guest sees Game Board return immediately to Chat Timeline.
6. Guest tile shows `HOST`.
7. Last attack image is visible only inside Unified Attack Log.
8. `GAME RESULT` timeline card shows winner.
9. Old Host rejoins and sees Chat / Ready mode as a participant.
