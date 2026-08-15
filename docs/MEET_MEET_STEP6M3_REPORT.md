# MEET MEET Step 6-M3 Report

## Scope

Step 6-M3 keeps the Step 6-M / 6-M2 Landing structure and applies a narrower polish pass:

- Press Start 2P font loading and scale adjustment
- compact 16:9 side demo cards
- continuous angular frame treatment using outer/inner polygon layers

No create/join, Pre-Join Face Check, game room, LiveKit, Fair Play, Life, or attack logic was changed.

## Modified Files

- `index.html`
- `src/App.css`
- `docs/MEET_MEET_STEP6M3_REPORT.md`

## Press Start 2P

`index.html` now loads Google Fonts:

- `Press Start 2P`

The Landing CSS defines:

```css
--font-arcade: 'Press Start 2P', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;
```

Applied to:

- `MEET! MEET!`
- `MEET MEET`
- `INTRO / GAMES`
- `LOBBY / FRIENDS READY`
- demo player names and roles
- Life HUD / signal HUD
- bottom controls
- Games tab room titles/status/count/buttons
- join dialog HUD text

## Korean Fallback

The font stack includes Korean-capable system fallbacks:

- `Noto Sans KR`
- `Apple SD Gothic Neo`
- system sans-serif fallbacks

The long Korean lore text intentionally uses the readable sans-serif stack instead of forcing Press Start 2P.

## Typography Scale

Press Start 2P is wider and visually heavier than the previous mono stack, so sizes were reduced:

- main title: `clamp(28px, 3.8vw, 54px)`
- header HUD: 8-13px range
- side card role/name text: 6-10px range
- game row title/status/button: 7-9px range
- bottom controls: 7px with controlled line-height

This avoids overflow in header, board, side cards, game rows, and mobile controls.

## Side Demo Card Height

Desktop side columns no longer force cards to stretch to the full board height.

Changes:

- `.landing-demo-column` uses `grid-template-rows: repeat(2, auto)`
- column content is vertically centered
- `.landing-demo-card` uses `aspect-ratio: 16 / 9`
- card max-height capped at `190px`

This removes the tall empty-space feeling in MAYA / LIAM / ZOE / NOAH cards.

## Side Demo Card 16:9

Cards now read as compact game/video preview cards:

- whole card is 16:9
- HUD name/role is overlaid at top
- Life/signal HUD is overlaid at bottom
- demo visual sits inside the same preview surface

The placeholder letters remain temporary decorative demo visuals, not real participants.

## Previous Border Issue

The previous frame style relied heavily on:

```css
border: 1px solid ...
clip-path: polygon(...)
```

That can make diagonal cut corners look broken because the browser border does not always render cleanly along the clipped diagonal edge.

## New Frame Structure

The new approach uses an outer polygon as the line:

- parent background: cyan/purple/magenta gradient
- parent padding: `2px`
- same polygon clip on parent

Then an inner polygon panel is layered with pseudo-elements:

- `::before` draws the dark inner panel
- the inner polygon is inset by 2px
- children sit above via `z-index: 1`

Applied to:

- header
- main board
- bottom toolbar
- join dialog
- game rows
- side demo cards

## Header Frame

Header now uses one continuous outer frame:

- gradient outer polygon
- dark inner polygon
- internal dividers preserved
- embedded logo/status/profile sections

The header should read as one connected HUD bar instead of separate cards.

## Main Board Frame

Main board now uses:

- gradient outer polygon frame
- dark inner panel
- subtle scanline layer
- tabs above inner board content

The Intro/Games tabs remain connected visually to the board.

## Side Card Frame

All four static demo cards share:

- same medium cut geometry
- gradient outer frame
- dark inner preview panel
- compact 16:9 aspect

Accent colors still differ per demo player through the visual avatar color.

## Bottom Toolbar Frame

The bottom toolbar now shares the same frame language:

- gradient polygon outer frame
- dark inner panel
- Press Start 2P labels
- CREATE ROOM remains the strongest CTA

## Cut Corner Tokens

Landing tokens added:

- `--arcade-cut-sm: 8px`
- `--arcade-cut-md: 12px`
- `--arcade-cut-lg: 18px`

Use:

- large: header, main board, toolbar
- medium: side cards, game rows
- small: tabs/buttons

## Visual Check

Local dev server status:

- `localhost:5174` was already in use by a Node/Vite process.
- `curl -I http://localhost:5174/` returned `HTTP/1.1 200 OK`.

Automated browser screenshot/corner zoom inspection was not available in this execution environment. The frame implementation was changed from clipped CSS border to outer/inner polygon layers specifically to address the 1-2px diagonal corner gap issue. Manual browser zoom checks are still recommended for:

- top-left header corner
- bottom-right header corner
- main board corners
- side demo card corners
- bottom toolbar corners

## Validation

Executed:

- `npm run lint`: passed
- `npm run build`: passed

Existing warning remains:

- `src/pages/MeetingRoomPage.tsx` has one pre-existing `react-hooks/exhaustive-deps` warning.

Build shows the existing Vite chunk-size warning only.

## Known Limits

- Press Start 2P is loaded from Google Fonts at runtime.
- No local webfont asset was committed.
- Browser visual verification should still be performed manually because this session could not capture screenshots.
