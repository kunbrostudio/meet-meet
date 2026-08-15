# MEET MEET Step 6-M8 Report

## Scope

Step 6-M8 replaces the main lobby demo player placeholder initials with the user-provided pixel character images.

No LiveKit, room, Join Code modal, Total Players, game room, Fair Play, attack, Life, or mobile app shell logic was changed.

## Asset Check

Confirmed files:

- `public/images/demo-players/maya.png`
- `public/images/demo-players/liam.png`
- `public/images/demo-players/zoe.png`
- `public/images/demo-players/noah.png`

The previous `/img/demo-players/` path was not used.

## Character Mapping

- MAYA -> `/images/demo-players/maya.png`
- LIAM -> `/images/demo-players/liam.png`
- ZOE -> `/images/demo-players/zoe.png`
- NOAH -> `/images/demo-players/noah.png`

These are Vite public assets referenced directly from the frontend.

## Implementation

Updated `src/pages/LandingPage.tsx`:

- Added `imageSrc` to the `DemoPlayer` data.
- Replaced the rendered `M / L / Z / N` placeholder avatar markup with an `img`.
- Kept the initial letter as a hidden visual fallback layer.
- Added alt text such as `MAYA demo character`.
- Added image error handling so a failed image load hides the broken image and leaves the initial fallback.

## Image Fit

Updated `src/App.css`:

- `.landing-demo-character img`
  - `width: 100%`
  - `height: 100%`
  - `object-fit: cover`
  - `object-position: center center`

The existing card container keeps the compact 16:9 ratio, preventing layout shift while images load.

No `image-rendering: pixelated` rule was added. The uploaded PNG files are large enough for the current cards, so default browser interpolation is preserved for now.

## HUD Overlay

The existing HUD remains:

- Player name
- Role/status
- Hearts
- Signal/status glyph
- Cyan/magenta arcade frame

A subtle media-area overlay was added with `.landing-demo-character::after` for top/bottom HUD readability. The overlay is light and does not replace or heavily darken the character artwork.

## Desktop Check

Code-level check:

- MAYA, LIAM, ZOE, and NOAH preserve their existing names.
- Left/right desktop placement is unchanged.
- Demo cards remain compact 16:9.
- Roles, hearts, and signal UI remain unchanged.

Manual browser confirmation is recommended.

## Mobile Carousel Check

Code-level check:

- Mobile horizontal carousel remains unchanged.
- Demo cards keep `aspect-ratio: 16 / 9`.
- The same image mapping is used in mobile and desktop because both render through `LandingDemoPlayerCard`.

Manual browser checks are recommended at 375x667 and 390x844.

## Fallback

If an image fails to load:

- The broken image is hidden via `onError`.
- The existing initial letter fallback remains available inside the card.
- The card layout and HUD do not collapse.

## Verification

Commands run:

- `npm run lint` passed.
  - Existing warning remains in `src/pages/MeetingRoomPage.tsx` for `react-hooks/exhaustive-deps`.
  - No lint errors were reported.
- `npm run build` passed.
  - Vite reported the existing large chunk size warning after minification.

The existing Vite chunk size warning is not a build failure.
