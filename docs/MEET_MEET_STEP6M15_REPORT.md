# MEET MEET Step 6-M15 Report

## Scope

Step 6-M15 updates only the Game Room mobile presentation:

- Mobile portrait now prioritizes GAME BOARD first, then a horizontal participant rail.
- Mobile landscape now shows a visual orientation gate asking the user to rotate to portrait.
- Desktop and tablet Game Room layout rules remain unchanged.
- LiveKit, chat, room/session, Ready, countdown, attack, fair play, life, and game over logic were not changed.

## Changed Files

- `src/components/game-room/MeetMeetRoomLayout.tsx`
- `src/components/game-room/ParticipantColumn.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M15_REPORT.md`

## Current Mobile Analysis

Before this step, the Game Room used the same left / board / right layout family on small screens. That made portrait phones spend too much vertical space stacking separate left and right participant columns, while mobile landscape squeezed the full Game Room into a short viewport.

The safe correction was to keep the existing desktop participant distribution intact and add a mobile-only participant rail that reuses the existing `ParticipantGameCard` rendering.

## Mobile Portrait Structure

Mobile portrait now uses this order:

1. Compact Game Room header
2. GAME BOARD
3. Horizontal participant rail
4. Existing fixed bottom control bar

The portrait rules are limited to:

```css
@media (max-width: 620px) and (orientation: portrait)
```

The header is compacted to prioritize:

- MEET MEET logo mark
- Room code
- Participant count
- LIVE badge

Lower-priority header text such as room title, connection label, and clock is hidden only in this mobile portrait mode.

## Participant Rail

`MeetMeetRoomLayout` now renders a mobile-only `.mobile-player-rail` using the same `ParticipantColumn` and `ParticipantGameCard` components.

`ParticipantColumn` now accepts `side="mobile"` so the mobile rail can have its own accessible label without changing card behavior.

Rail behavior:

- Horizontal `flex` row
- `overflow-x: auto`
- `scroll-snap-type: x proximity`
- Hidden scrollbar
- No fake participant videos
- Existing participant HUD remains available: name, HOST, role, READY, life, mic, eliminated/fair play status

Participant cards in the rail keep 16:9:

```css
aspect-ratio: 16 / 9;
flex-basis: clamp(260px, 78vw, 326px);
```

This keeps one card dominant on 375px and 390px portrait widths while leaving a slight cue that more participants can be scrolled horizontally.

## GAME BOARD Height Strategy

In mobile portrait, the page is constrained to `100dvh` and the room layout uses a flex column with `min-height: 0` throughout the board and chat containers.

The GAME BOARD gets the remaining vertical space after the compact header, participant rail, and bottom safe-area control padding. Existing chat list overflow remains inside the board, so the page itself avoids excessive vertical scrolling.

## Bottom Controls

The existing `ControlBar` and control behavior were preserved.

Mobile portrait only adjusts available width and bottom safe-area placement:

- `max-width: calc(100vw - 20px)`
- bottom safe-area maintained through existing `.meeting-controls-wrap`

## Landscape Orientation Gate

`MeetingRoomPage` now renders `.mobile-orientation-gate`, a fixed visual overlay.

The overlay is enabled only for small landscape screens:

```css
@media (max-width: 900px) and (max-height: 500px) and (orientation: landscape)
```

The gate:

- Does not disconnect LiveKit
- Does not navigate
- Does not reload
- Does not change game state
- Does not block React state updates behind the overlay

The message is:

```text
세로 화면으로 돌려주세요
MEET MEET 게임룸은 세로 화면에 최적화되어 있어요.
```

Tablet landscape is intentionally not targeted by this gate.

## Verification

Commands run:

```bash
npm run lint
npm run build
```

Results:

- `npm run lint`: passed with 1 existing warning in `src/pages/MeetingRoomPage.tsx` about unnecessary hook dependencies.
- `npm run build`: passed.
- Vite still reports the existing chunk-size warning after production build.

## Manual Test Checklist

Recommended browser checks:

- 375x667 portrait: GAME BOARD visible first, participant cards in horizontal rail, bottom controls accessible.
- 390x844 portrait: GAME BOARD and chat remain usable, rail scrolls horizontally.
- 667x375 landscape: orientation gate appears and underlying meeting state remains connected.
- Desktop: existing left / GAME BOARD / right layout remains unchanged.
- Tablet portrait/landscape: no forced mobile landscape blocker unless viewport matches the small-phone media query.

## Next Step Suggestion

Step 6-M16 should use device testing or Playwright screenshots to tune exact mobile heights for active attack, round result, and game-over states inside the portrait GAME BOARD.
