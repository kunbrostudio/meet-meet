# MEET MEET Step 6-M9-R1 Report

## Scope

Step 6-M9-R1 changes only the Main Lobby CAMERA button behavior so it acts as a real camera ON/OFF toggle.

No room create/join, Audio, Intro/Games, LiveKit, Fair Play, attack, Life, or Game Over logic was changed.

## Camera ON/OFF State

The bottom CAMERA button now controls actual device state:

- Camera OFF -> click -> request camera permission and start video track
- Camera ON -> click -> stop video track and return the Main Media Hub to Intro

`cameraReady` remains derived from the actual live/enabled `MediaStreamTrack`.

## MediaStream Track Cleanup

Added `stopCamera()` in `src/pages/LandingPage.tsx`.

On camera OFF:

- stops only `getVideoTracks()`
- clears `cameraVideoRef.current.srcObject`
- removes video tracks from shared `localMedia`
- preserves existing audio tracks
- sets `cameraEnabled: false`
- keeps `microphoneEnabled` based on actual mic readiness

This is not a visual hide-only change. The browser camera track is actually stopped.

## Device State And View State Separation

The implementation keeps these separate:

- device state: live video track / `cameraReady`
- view state: `mediaMode` as `intro` or `camera`

`INTRO` still changes only the visible media view. It does not stop camera or mic tracks.

## Mic Stream Preservation

Camera OFF creates a new stream from the existing audio tracks if mic is active.

This supports:

- Camera ON + Mic ON
- Camera OFF
- Mic remains ON

## Face State Reset

Camera OFF calls the shared face reset helper:

- clears face check state
- clears face check errors
- sets face check running false
- closes the active `FairPlayDetector`

The HUD returns to `FACE WAIT/CHECK` instead of leaving a stale ready state.

## Manual OFF Coachmark

Added `manualCameraOff` state.

If the user intentionally turns the camera off, the camera coachmark does not immediately reappear. Re-clicking CAMERA starts a fresh `getUserMedia` request and re-enables preview.

## Active State

The bottom control bar ready state now uses a cyan arcade active treatment with subtle inset glow.

## Repeated Toggle Test Plan

Recommended manual test:

- Fresh Main -> CAMERA -> permission -> camera preview
- CAMERA again -> video track stops -> Intro returns
- CAMERA again -> camera preview returns
- Repeat ON/OFF several times
- Camera OFF while mic is ON -> mic remains ready
- Camera ON -> INTRO -> camera stays alive -> CAMERA media switch returns preview
- Camera OFF -> face ready state resets

## Desktop And Mobile

The same toggle logic is used on desktop and mobile.

Mobile app shell and bottom toolbar geometry were not changed.

## Verification

Commands run:

- `npm run lint` passed.
  - Existing warning remains in `src/pages/MeetingRoomPage.tsx` for `react-hooks/exhaustive-deps`.
  - No lint errors were reported.
- `npm run build` passed.
  - Vite reported the existing large chunk size warning after minification.

The existing Vite chunk size warning is not a build failure.
