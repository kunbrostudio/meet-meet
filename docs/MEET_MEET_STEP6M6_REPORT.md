# MEET MEET Step 6-M6 Report

## Scope

Step 6-M6 fixes final mobile lobby collisions and changes the header HUD counter to a server-session-based total player counter.

No LiveKit, room create/join, Pre-Join Face Check, game room, Fair Play, attack, Life, or game state synchronization logic was changed.

## Changed Files

- `server/index.ts`
- `src/services/statsService.ts`
- `src/pages/LandingPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6M6_REPORT.md`

## Mobile MEET MEET One-Line Title

Mobile-only title rules were added under the `max-width: 767px` breakpoint.

- Selector: `.landing-title-block h1`
- Uses `white-space: nowrap`
- Uses reduced responsive scale: `clamp(24px, 7.4vw, 34px)`
- Short-height screens use `clamp(22px, 7vw, 28px)`

Desktop title sizing remains unchanged.

## Slogan/Text Overlap Root Cause

The overlap was not caused by `position: absolute` or z-index layering in the description area.

The actual cause was mobile compression inside the fixed `100dvh` app shell:

- `.landing-intro-panel` used a grid structure with limited available height.
- The 16:9 media preview and the description block were both being compressed inside the board.
- The slogan and auto-scroll text did not have enough independent normal-flow space on short screens.

## Overlap Fix Structure

Mobile Intro layout now uses normal document flow inside the Game Board scroll area.

- `.landing-intro-panel` becomes `display: block` on mobile.
- The order is:
  - title
  - 16:9 video preview
  - slogan
  - description scroll
- `.landing-intro-copy` becomes a vertical flex stack on mobile.
- `.landing-intro-copy strong` is `position: static` and owns its own block.
- `.landing-lore-scroll` is a separate scroll region below the slogan.

No z-index masking was used.

## Video/Description Normal Flow

The video preview keeps `aspect-ratio: 16 / 9`.

Mobile spacing guarantees:

- video block
- margin
- description block

The description is not positioned over the video and does not use negative margin or transform-based overlap.

## iPhone SE Short-Height Handling

For `max-width: 767px` and `max-height: 700px`:

- Shell gaps are reduced.
- Header height is reduced.
- Board padding is reduced.
- Title size is reduced.
- Video/description spacing is reduced.
- Description scroll height is reduced to `72px` to `86px`.
- Demo carousel height is reduced while preserving card ratio.

When content exceeds the available board space, the Game Board internal scroll handles it.

## Total Player Meaning

The header counter now means:

> Total anonymous player sessions seen by the current API server process.

It is displayed as:

- `TOTAL PLAYERS`
- `000001` style padded counter

Loading or API failure displays `------`; no fake number is shown.

## Anonymous Session Duplicate Prevention

The server reuses the existing HttpOnly anonymous session cookie:

- Cookie name: `meet_meet_sid`
- Session source: `getSession()` in `server/index.ts`
- New session: increments `totalAnonymousPlayerSessions` once
- Existing session: does not increment

The client stats service also keeps a module-level request promise to avoid duplicate concurrent stats calls during React development remounts.

## Stats API

Added endpoint:

- `GET /api/stats`

Response:

```json
{
  "totalPlayers": 1,
  "persistence": "memory",
  "resetsOnRestart": true
}
```

Client fetch:

- File: `src/services/statsService.ts`
- Uses `credentials: 'include'`
- Does not use localStorage, random values, or render-time increments.

## Persistence

The counter is memory-only.

This means:

- It survives normal page reloads while the API server process is running.
- It does not permanently persist across server restarts.
- After server restart, the counter starts again from zero for that process.

No file DB, external DB, or new dependency was added in this step.

## Desktop Check

Code-level check:

- Desktop large `MEET MEET` title remains unchanged.
- Desktop intro two-column slogan/description layout remains unchanged.
- Header now shows the total player counter.
- Side cards, Games tab, 16:9 video preview, and bottom controls remain in the existing design system.

Manual browser confirmation is recommended.

## iPhone 12 Pro 390x844 Check

Code-level check:

- `MEET MEET` title is one line.
- Video remains 16:9.
- Slogan and description are stacked.
- Board internal scroll remains available.
- Demo carousel and bottom controls remain in the app shell.

Manual browser confirmation is recommended.

## iPhone SE 375x667 Check

Code-level check:

- `MEET MEET` title is one line with reduced sizing.
- Video and description use normal flow.
- Slogan and description have separate blocks.
- Description can scroll inside the board content.
- Bottom controls remain visible.
- Horizontal overflow is not intended.

Manual browser confirmation is strongly recommended on this viewport.

## Player Counter Test Plan

Recommended manual test:

- Browser A first visit: total increases once.
- Browser A reload: total does not increase.
- Browser A Intro/Games tab switching: total does not increase.
- Incognito Browser B first visit: total increases once.
- Browser B reload: total does not increase.
- API server restart: memory-only total resets.

## Verification

Commands run:

- `npm run lint` passed.
  - Existing warning remains in `src/pages/MeetingRoomPage.tsx` for `react-hooks/exhaustive-deps`.
  - No lint errors were reported.
- `npm run build` passed.
  - Vite reported the existing large chunk size warning after minification.

The existing Vite chunk size warning is not a build failure.
