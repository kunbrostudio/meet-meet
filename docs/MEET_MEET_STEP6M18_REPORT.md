# MEET MEET Step 6-M18 Report

## Scope

Step 6-M18 corrects the view architecture introduced in Step 6-M17 and adds a Host-authoritative room-capacity auto-start flow.

The two top-level Meeting Room views are now:

- `GAME MODE`: existing game room layout with GAME BOARD.
- `PLAYERS MODE`: full player gallery with no GAME BOARD frame or chat input.

## Changed Files

- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `src/components/game-room/MeetMeetRoomLayout.tsx`
- `src/components/game-room/PlayerGallery.tsx`
- `src/components/meeting/ControlBar.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/types/game.ts`
- `src/App.css`
- `docs/MEET_MEET_STEP6M18_REPORT.md`

## Nested Gallery Fix

The previous Step 6-M17 structure rendered `PlayerGallery` through the `board` slot of `MeetMeetRoomLayout`.

That has been corrected.

Current structure:

```text
video-area
├─ GAME MODE: MeetMeetRoomLayout
│  ├─ left participant column
│  ├─ GAME BOARD
│  └─ right participant column
└─ PLAYERS MODE: players-mode-root
   └─ PlayerGallery
```

`PlayerGallery` is no longer rendered inside the GAME BOARD slot or as a variant of `MeetMeetRoomLayout`.

## Control Bar

Visible Game Room controls are now:

```text
MIC
CAMERA
GAME MODE
PLAYERS
MORE
LEAVE
```

Removed from the visible control bar:

- Chat button
- Screen Share button
- Presenter/Grid button

The text chat feature remains inside `GameBoard`:

- chat messages
- chat input
- send logic
- LiveKit chat transport

## View State

`isParticipantsOpen` currently acts as the Players Mode flag.

- `false`: GAME MODE active
- `true`: PLAYERS MODE active

The two buttons are mutually exclusive:

- GAME MODE active when Players Mode is off
- PLAYERS active when Players Mode is on

Switching views does not reset game state, chat messages, timers, media state, or LiveKit connection.

## Players Gallery

`PlayerGallery` reuses:

- `Participant`
- `Participant.mediaStream`
- `ParticipantGameCard`

It does not create a new LiveKit room, subscribe to new tracks, or reconnect media.

Desktop layout:

- 1 participant: single large centered card
- 2 participants: two columns
- 3-4 participants: readable grid, 2x2 by default
- very wide 4-player desktop can use 4 columns

Mobile portrait layout:

- PLAYERS MODE uses a 2-column gallery.
- Gallery scrolls internally when needed.
- Bottom controls remain accessible.

Mobile GAME MODE still keeps the compact mini player rail.

## Auto Start Flow

Added `auto-start-pending` to `GamePhase`.

Host-authoritative flow:

```text
waiting / ready
-> room capacity reached
-> auto-start-pending
-> countdown
-> game-started
```

When room capacity is reached:

- Host creates an authoritative `auto-start-pending` snapshot.
- Snapshot includes `countdownStartedAt` and `countdownDurationMs`.
- Clients display `ROOM FULL` and countdown text.

After auto-start pending ends:

- Host creates the existing `countdown` snapshot.
- Existing synchronized countdown completion continues to `game-started`.
- Existing role/turn flow remains responsible for the next phases.

## Auto Start Cancellation

If a participant leaves during `auto-start-pending` and connected participant count drops below room capacity:

- Host clears the pending timer.
- Host publishes a `waiting` snapshot.
- A later room-full condition starts a new pending countdown.

No Guest can generate or advance the auto-start state.

## Ready / Game Start Compatibility

The existing manual Ready/Game Start path was not removed.

Auto start only triggers when:

- current phase is `waiting` or `ready`
- connected participant count reaches configured room capacity
- capacity is at least 2
- current client is the Host

Manual Host Game Start still uses the existing `ready -> countdown` path.

## Verification

Commands run:

```bash
npm run lint
npm run build
```

Results:

- `npm run lint`: passed with 1 existing `react-hooks/exhaustive-deps` warning in `src/pages/MeetingRoomPage.tsx`.
- `npm run build`: passed.
- Existing Vite chunk-size warning remains and is not a build failure.

## Manual Test Checklist

Recommended checks:

- Desktop: GAME MODE active on entry.
- Desktop: PLAYERS hides GAME BOARD and shows only full gallery.
- Desktop: GAME MODE restores left/GAME BOARD/right layout.
- Mobile 375x667: GAME MODE shows compact mini rail.
- Mobile 375x667: PLAYERS shows 2-column Gallery with no GAME BOARD.
- Toggle repeatedly: no LiveKit reconnect, no state reset.
- 2-person room: second participant triggers `ROOM FULL -> countdown`.
- During `auto-start-pending`, participant leaving cancels back to waiting.
