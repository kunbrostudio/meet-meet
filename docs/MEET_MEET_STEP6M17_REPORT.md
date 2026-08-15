# MEET MEET Step 6-M17 Report

## Scope

Step 6-M17 adds a user-controlled view switch in the Game Room:

- `GAME BOARD` view remains the default play surface.
- `PLAYERS` view shows a larger participant video gallery.
- The bottom Participants control toggles between those two views.

No room, LiveKit, chat transport, Ready, countdown, attack, fair play, life, elimination, or game-over logic was changed.

## Changed Files

- `src/components/game-room/PlayerGallery.tsx`
- `src/components/game-room/MeetMeetRoomLayout.tsx`
- `src/components/meeting/ControlBar.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M17_REPORT.md`

## Bottom Control Bar Cleanup

Removed from the visible Game Room control bar:

- Screen Share button
- Presenter / Grid view button

Kept:

- Microphone
- Camera
- Players
- Chat
- More
- Leave

The underlying screen share functions were not deleted; only the low-priority Game Room controls were removed from the bar.

## Players Toggle Architecture

`MeetingRoomPage` continues using the existing `isParticipantsOpen` state, but its meaning is now the active Players view flag.

Flow:

```text
GAME BOARD view
-> Participants/Players button
-> PLAYER GALLERY view
-> Participants/Players button or GAME BOARD button
-> GAME BOARD view
```

`MeetMeetRoomLayout` now receives:

```ts
mainView?: 'game' | 'players'
```

When `mainView="players"`, the left/right participant columns and mobile mini rail are not rendered, and the center shell is dedicated to `PlayerGallery`.

## Desktop Adaptive Gallery

`PlayerGallery` uses CSS Grid and the existing `ParticipantGameCard` component.

Current max participant policy remains unchanged:

```text
maxParticipants = 4
```

Desktop layout:

- 1 player: one large centered card
- 2 players: two balanced columns
- 3 players: two-column responsive grid
- 4 players: 2x2 by default, 4 columns on wider screens

Gallery overflow is internal with `overflow-y: auto`, so the meeting page itself does not grow unexpectedly.

## Mobile Gallery

Mobile portrait Players view uses a 2-column grid:

- 1-4 participants are shown as larger video cards than the mini rail.
- The gallery scrolls internally if content exceeds available height.
- Bottom controls remain accessible.

Small mobile landscape continues using the existing orientation gate policy. No separate landscape gallery was added.

## Mobile Mini Player Rail

In mobile Game Board view, the mini player rail was made more compact than Step 6-M16:

```css
flex-basis: clamp(118px, 34vw, 154px);
width: clamp(118px, 34vw, 154px);
aspect-ratio: 16 / 9;
```

This keeps the player rail as a secondary status strip and gives more vertical priority to the GAME BOARD.

## LiveKit Video Reuse

The Gallery reuses:

- `Participant`
- `Participant.mediaStream`
- `ParticipantGameCard`

It does not create LiveKit tracks, reconnect, resubscribe, or change media state. View switching only changes which React surface renders the existing participant cards.

## Game State Preservation

Switching views does not affect:

- countdown timing
- attack timer
- Ready state
- roles
- lives
- fair play state
- chat state
- LiveKit connection

The Gallery displays a compact game HUD from current props:

```text
ROUND 02 · ATTACK · 00:18
```

The remaining attack time is computed locally from the authoritative `attackEndsAt` value and is display-only.

## Manual Test Checklist

Desktop:

- 1 player: Players button opens a large single card gallery.
- 2 players: Players view shows two balanced video cards.
- 4 players: Players view uses a readable grid and does not clip cards.
- Re-clicking Players returns to GAME BOARD.

Mobile 375x667:

- GAME BOARD view shows a compact horizontal mini rail.
- Multiple participants remain in one swipeable row.
- Players view switches to a 2-column gallery.
- Bottom controls remain reachable.

Game-in-progress:

- Switch Game Board -> Players -> Game Board during countdown or attack.
- Timer and phase continue without reset.
- Camera and mic toggles still update cards.

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
