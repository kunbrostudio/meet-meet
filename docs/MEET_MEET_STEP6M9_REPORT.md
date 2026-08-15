# MEET MEET Step 6-M9 Report

## Scope

Step 6-M9 moves the pre-room device/setup flow into the Main Lobby and bypasses the old `/setup` page.

Preserved systems:

- room create/join API
- LiveKit meeting room
- game state synchronization
- Ready/countdown/attacker/attack/Fair Play/Life/Game Over flows
- Total Players counter
- demo player assets
- mobile app shell

## Existing Setup Functions Found

`src/pages/SetupPage.tsx` previously handled:

- display name input
- participant count selection
- camera/microphone/speaker device selection
- automatic camera/mic permission request on setup entry
- local camera preview
- mic/camera toggles
- room code/link copy
- pre-join face check with `FairPlayDetector`
- final room entry

## Moved To Main Lobby

Moved into `src/pages/LandingPage.tsx`:

- player name input in Create/Join modals
- participant count selection in Create modal
- camera permission request from the CAMERA button
- microphone permission request from the AUDIO button
- central 16:9 camera preview in the Main Media Hub
- intro/camera visual mode switch
- camera/mic/face readiness HUD
- pre-join face check with `FairPlayDetector`
- create room modal confirmation
- join room modal confirmation

## Removed Setup Flow

Removed:

- `src/pages/SetupPage.tsx`
- `SetupPage` import from `src/App.tsx`
- setup page rendering from `src/App.tsx`
- create/join navigation to `/setup`
- reconnect navigation to `/setup`

Kept intentionally:

- `/setup` URL redirect behavior in `src/App.tsx`
  - direct `/setup` access is replaced with `/`
  - this is the only remaining `/setup` reference

## Media Hub Architecture

The Main Intro media area now supports:

```ts
type MainMediaMode = 'intro' | 'camera'
```

Default:

- `intro`

Camera button:

- asks for camera permission only after user click
- stores the video track in shared `localMedia`
- switches the central 16:9 media area to camera preview

Audio button:

- asks for microphone permission only after user click
- adds the audio track to shared `localMedia`
- does not force the media area away from camera preview

## Intro ↔ Camera State

The visual mode is separated from stream lifecycle.

- `INTRO` switches the media area back to the intro visual.
- `CAMERA` returns to camera preview if the camera stream already exists.
- Switching to intro does not stop camera or microphone tracks.

## Camera Stream Preservation

`src/App.tsx` now stops only tracks that are not included in the next `MediaStream`.

This prevents the camera track from being stopped when the microphone track is added later.

## Coachmarks

The bottom control bar now shows a small arcade coachmark:

- before camera ready: `카메라를 연결하세요`
- after camera ready but before mic ready: `마이크를 연결하세요`

The matching CAMERA/AUDIO button gets a subtle pulse. Once the real track is ready, the coachmark disappears.

## Face Check Integration

Landing uses the existing `FairPlayDetector` against the Main Media Hub camera preview.

Policy:

- face check does not run automatically on first page load
- user starts it from Create/Join modal
- camera must be ready first
- if the user is viewing Intro, face check switches the Media Hub to camera preview before starting
- result is stored only in React state
- no fake ready state is created

## Create Modal

Create Room now opens a modal instead of creating a room immediately.

Fields/status:

- room name
- player name
- game: `DON'T LAUGH!` read-only
- players: `2 / 3 / 4`
- life: `3 / 5`
- attack time: `15 / 30 sec`
- camera/mic/face readiness
- face check action
- create room submit

On submit:

- requires camera ready
- requires mic ready
- requires face check ready
- calls existing `createServerRoom`
- navigates directly to `/meeting`

## Join Modal

Join Code modal remains arcade themed and now includes:

- room code
- player name
- camera/mic/face readiness
- face check action
- join room submit

Guests cannot edit host game rules.

On submit:

- validates `MMT-XXXXXX`
- requires camera ready
- requires mic ready
- requires face check ready
- calls existing `joinServerRoomByCode`
- navigates directly to `/meeting`

## Routing Change

`src/App.tsx` now uses:

- `landing` -> `/`
- `meeting` -> `/meeting`

Old `/setup`:

- redirects to `/`
- does not render SetupPage

## Permission Denied UX

Camera/mic permission failures are shown as small inline arcade status messages in modals.

No repeated `alert()` loop was added.

## Desktop And Mobile Notes

Desktop:

- Main Lobby composition remains intact.
- Intro/Games tabs remain intact.
- Media Hub keeps the existing 16:9 frame.

Mobile:

- Main app shell remains intact.
- CAMERA/AUDIO controls stay in the bottom bar.
- Create/Join modals use the existing responsive modal shell.
- Camera preview uses the central media frame.

Manual browser checks are recommended for:

- 375x667
- 390x844

## Setup Removal Check

Search result after change:

- only intentional `/setup` redirect remains in `src/App.tsx`
- `SetupPage` route/render/import was removed

## Verification

Commands run:

- `npm run lint` passed.
  - Existing warning remains in `src/pages/MeetingRoomPage.tsx` for `react-hooks/exhaustive-deps`.
  - No lint errors were reported.
- `npm run build` passed.
  - Vite reported the existing large chunk size warning after minification.

The existing Vite chunk size warning is not a build failure.
