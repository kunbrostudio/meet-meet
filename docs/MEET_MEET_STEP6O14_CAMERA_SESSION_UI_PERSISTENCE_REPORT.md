# MEET MEET Step 6-O14 Camera Session UI Persistence Report

## Summary

Step 6-O14 keeps the Step 6-O13 global `GAME READY CHECK` policy and improves two areas:

1. The large Game Ready panel was moved off the camera preview and into the existing intro/description area.
2. App route changes, room leave, and eliminated/kicked returns no longer stop the user's camera stream.

## Changed Files

- `src/App.tsx`
- `src/pages/LandingPage.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6O14_CAMERA_SESSION_UI_PERSISTENCE_REPORT.md`

## Game Ready Panel Layout

Before:

- `GAME READY CHECK` was rendered as a large overlay inside `landing-hero-visual`.
- It could cover the user's face in the camera preview, especially on mobile.

After:

- Camera preview only keeps compact status badges such as `CAMERA READY`, `MIC OFF`, and `GAME READY ✓`.
- The full `GAME READY CHECK` panel now replaces the existing lower intro description area when the camera is on.
- When the camera is off, the original intro description remains.

State-based layout:

- Camera off: Intro video + original MEET MEET description.
- Camera on and checking: Camera preview + lower `GAME READY CHECK` panel.
- Camera on and passed: Camera preview + lower `GAME READY ✓` panel.

## PC Layout

The camera preview is no longer blocked by the check panel. The panel sits in the existing lower information area inside `LandingIntroPanel`.

## Mobile Layout

The panel now flows below the preview instead of covering it. The mobile CSS keeps the panel compact and full-width inside the existing content column.

## Previous Camera Ownership

The App already held `localMedia.stream` above both Landing and Meeting pages, but route cleanup still stopped it:

- `navigate('landing')` called `clearLocalMedia()`.
- `popstate` to Landing called `clearLocalMedia()`.
- `MeetingRoomPage` leave cleanup called `stopMediaStream(localParticipant.mediaStream)`.

Those paths treated room lifecycle as camera lifecycle.

## New App-Level Camera Session Policy

The App-level `localMedia.stream` is preserved across internal route changes.

Room lifecycle cleanup still disconnects LiveKit and room listeners, but it does not stop the source camera track unless the user explicitly turns the camera off.

Development diagnostics:

- `[camera-session] route-change preserved`
- `[room-camera] unpublished-preserve-local-track`
- `[camera-session] created`
- `[camera-session] user-stop`

## track.stop() Policy

Allowed:

- User clicks Landing `CAMERA` while camera is on.
- Device replacement paths stop replaced tracks.
- Browser/tab/site teardown handled by the browser.

Removed from route/room cleanup:

- Main navigation after leave/kick.
- `MeetingRoomPage` leave finalization.

## Kick / Leave Persistence

After a user is eliminated or leaves a room:

1. LiveKit room disconnects.
2. App navigates back to Landing.
3. Local camera stream remains live.
4. Landing restores camera preview.
5. If the same device was calibrated in the session, `GAME READY ✓` is restored without quick check.

## Explicit OFF

If the user clicks `CAMERA` off:

- video tracks are stopped.
- camera preview returns to intro state.
- create/join gates block as before.
- next explicit camera ON follows Step 6-O13 full/quick check policy.

## Calibration Persistence

Landing remount restores calibration from `sessionStorage` when:

- a live local camera stream still exists
- the live camera deviceId matches the stored calibrated deviceId

This avoids recalibration after room leave/kick when the camera was never turned off.

## Verification

- `npm run lint`: passed
- `npm run build`: passed
- `node scripts/meet-meet-room-lifecycle-check.mjs`: passed

The Vite chunk-size warning remains, but the build succeeds.

## Manual Test Checklist

1. Fresh main page with camera off: intro video and original description are visible.
2. Camera on: preview remains clean, Game Ready panel appears below.
3. Complete full check: lower panel shows `GAME READY ✓`.
4. Enter room, leave normally: main returns with camera preview and `GAME READY ✓`.
5. Enter room, get eliminated/kicked: main returns with camera preview and `GAME READY ✓`.
6. Click camera off: track stops, intro state returns, create/join are blocked.
