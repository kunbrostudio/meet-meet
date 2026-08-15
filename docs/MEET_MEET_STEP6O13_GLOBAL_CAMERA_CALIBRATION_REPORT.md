# MEET MEET Step 6-O13 Global Camera Calibration Report

## Summary

Step 6-O13 changes Fair Play from a match-level gate into a browser camera-session level `GAME READY CHECK`.

Users now run calibration after manually clicking the Landing `CAMERA` button. Once the browser camera session is calibrated, rooms and matches no longer run `FAIR PLAY CHECK` before Ready.

## Changed Files

- `src/pages/LandingPage.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/services/fairPlayDetectorService.ts`
- `src/App.css`
- `docs/MEET_MEET_STEP6O13_GLOBAL_CAMERA_CALIBRATION_REPORT.md`

## Product Flow

New flow:

1. User opens the main lobby.
2. User manually clicks `CAMERA`.
3. Camera permission is requested only from that click.
4. Camera preview appears.
5. `GAME READY CHECK` runs on the preview video.
6. Full check verifies `CAMERA -> FACE -> MOUTH -> SMILE`.
7. The browser session stores calibrated device metadata in `sessionStorage`.
8. Create Room / Join Code are unlocked after calibration passes.
9. Meeting Room starts from chat/waiting/Ready without match-level Fair Play.

## Full Check

The full check uses the existing `FairPlayDetector.startFaceCheck({ mode: 'full' })` path.

Stages:

- `CAMERA`: live camera track and video frame are available.
- `FACE`: face is visible.
- `MOUTH`: user opens mouth.
- `SMILE`: user smiles.
- `passed`: `GAME READY ✓`

## Quick Check

If the same browser session has already completed a full calibration for the same camera device, reconnecting the same camera runs quick mode:

- `CAMERA`
- `FACE`

Mouth/smile calibration values are kept from the previous full check.

Device matching uses `MediaStreamTrack.getSettings().deviceId`.

## Session Persistence

Stored in `sessionStorage`:

- `deviceId`
- `fullCalibrationPassed`
- `calibratedAt`

Not stored:

- `MediaStream`
- camera connected state
- permission state

Page refresh does not auto-enable camera. The user must click `CAMERA` again.

## Landing UI

The camera preview now shows a compact arcade overlay:

- `GAME READY CHECK`
- stage chips for `CAMERA`, `FACE`, `MOUTH`, `SMILE`
- quick mode only shows `CAMERA`, `FACE`
- passed state shows `GAME READY ✓`

The device HUD and create/join modals also show `GAME READY`.

## Create / Join Gate

Create Room now requires:

- camera connected
- `GAME READY CHECK` passed

Join Code now requires:

- camera connected
- `GAME READY CHECK` passed
- audio connected, preserving the existing audio policy

Blocked messages:

- Camera off: `왼쪽 CAMERA 버튼을 눌러 카메라를 연결하세요.`
- Camera on but calibration incomplete: `GAME READY CHECK를 먼저 완료해주세요.`

No automatic camera or audio connection was added.

## Meeting Room Changes

Match-level Fair Play gating was removed from the Room flow.

Meeting Room no longer uses pre-game Fair Play to:

- block Ready
- block Game Start
- show `FAIR PLAY CHECK`
- show remote `CHECKING...`
- initialize next-match Fair Play state

Ready remains match-scoped. Game start is based on connected participants and Ready count.

Active match laugh detection remains separate and still uses the existing detector during gameplay.

## Detector Changes

`FairPlayDetector.startFaceCheck()` now supports:

- `mode: 'full'`
- `mode: 'quick'`

Quick mode completes after camera/face verification and skips mouth/smile prompts.

## Development Logs

Landing calibration emits:

- `[calibration] { mode, device }`
- `[calibration-stage] { camera: 'pass' }`
- `[calibration-stage] { step: ... }`
- `[calibration] { status: 'passed' }`

Meeting Room pre-game Fair Play logs should no longer appear for match preparation.

## Verification

- `npm run lint`: passed
- `npm run build`: passed
- `node scripts/meet-meet-room-lifecycle-check.mjs`: passed

The Vite chunk-size warning remains, but the build succeeds.

## Manual Tests

Recommended manual checks:

1. Fresh browser: click `CAMERA`, complete full `CAMERA -> FACE -> MOUTH -> SMILE`.
2. Before completion: confirm Create Room / Join Code are blocked.
3. After completion: confirm Create Room opens.
4. With Join Code: confirm camera + calibration + audio are required.
5. Enter a room: confirm `FAIR PLAY CHECK` does not appear in Game Board.
6. Ready both participants and start Match 1.
7. End Match 1 and prepare Match 2: confirm Ready flow appears without Fair Play.
8. Camera OFF then ON with same device: confirm quick `CAMERA -> FACE` check.
9. Change camera device if available: confirm full check is required again.

## Remaining Notes

Face presence monitoring after calibration is not fully implemented in this step. The core lifecycle change is complete: calibration is no longer part of the room/match loop.
