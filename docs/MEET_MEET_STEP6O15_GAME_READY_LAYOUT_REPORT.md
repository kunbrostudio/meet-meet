# MEET MEET Step 6-O15 Game Ready Layout Report

## Purpose

Step 6-O15 keeps the Step 6-O14 camera session, calibration, Create Room, and Join Code behavior intact while improving the Main screen Game Ready Check panel and the page height structure.

## Modified Files

- `src/pages/LandingPage.tsx`
- `src/App.css`
- `src/components/common/Icon.tsx`
- `docs/MEET_MEET_STEP6O15_GAME_READY_LAYOUT_REPORT.md`

## Desktop Game Ready Panel

- Reworked the camera-on Game Ready panel into a wider, primary content block inside the existing description area.
- Moved the check status items above the explanatory message so users see readiness first.
- Always renders the four status items:
  - `CAMERA`
  - `FACE`
  - `MOUTH`
  - `SMILE`
- Each item now shows an icon, label, and text status:
  - `PASS`
  - `CHECKING`
  - `WAIT`
- Completion state displays `GAME READY ✓` and keeps the copy:
  - `게임을 시작할 준비가 되었어요.`
  - `이제 방을 만들거나 게임방에 참여할 수 있습니다.`

## Mobile Game Ready Panel

- The panel remains below the camera preview, not over it.
- Status items use a readable 2x2 grid on narrow screens.
- Check status still appears before the guidance text.
- The panel uses compact spacing on mobile to avoid horizontal overflow.

## Status Icons

- `CAMERA`: `camera`
- `FACE`: `users`
- `MOUTH`: `message`
- `SMILE`: newly added `smile` line icon in the existing common `Icon` component.

No new icon library or package was added.

## Main Layout Height Structure

- Added `landing-scroll-region` between the header and bottom action bar.
- `landing-shell` now uses the intended three-region structure:
  - header
  - internal scroll content
  - bottom action bar
- The page shell is bounded to `100dvh` with `min-height: 0` and `overflow: hidden`.

## Bottom Action Bar

- The bottom action bar remains in the final shell row instead of being pushed below long content.
- No crude fixed overlay was added.
- The central content scrolls internally when vertical space is limited.

## Internal Scroll

- Desktop/tablet/mobile central content uses `landing-scroll-region` for vertical overflow.
- Mobile keeps the existing character carousel horizontal swipe behavior.
- Header and bottom controls remain outside the internal scroll area.

## Regression Scope

- Camera session persistence logic was not changed.
- Calibration, full check, quick check, device detection, Create Room gating, Join Code gating, room logic, and meeting room logic were not changed.

## Verification

- `npm run lint`: passed
- `npm run build`: passed

Build completed with the existing Vite chunk size warning only.

## Manual Checks Needed

- Desktop 1440px visual check for the wider Game Ready panel.
- Small laptop height check to confirm the bottom action bar stays visible.
- iPhone SE 375x667 visual check for the 2x2 status grid and internal scroll.
- iPhone 12/13 style 390x844 visual check for camera preview, Game Ready panel, carousel, and bottom action bar balance.
