# MEET MEET Step 6-P3 Visibility Guard Calibration Report

## 1. Existing Visibility Guard State

The in-game Visibility Guard is implemented through the existing `FairPlayDetector` lifecycle and only runs during an active attack for the local defender.

Activation scope:

- `gameState.phase === 'attack-active'`
- local role is `defender`
- local participant is not eliminated
- local participant has not already taken damage for the current attack

It does not run during waiting, ready, countdown, post-game, chat mode, attacker turns, or after local damage lock.

## 2. Landmark / Detector Used

The guard reuses the existing browser-local MediaPipe detectors in `src/services/fairPlayDetectorService.ts`:

- `FaceLandmarker`
- `HandLandmarker`

No new AI model or server-side video processing was added.

## 3. FACE_LOST Criteria

Face visibility uses time-based smoothing:

- short drops are ignored
- after about `400ms`, unstable tracking can become `FACE_UNSTABLE`
- after about `1200ms`, sustained missing face tracking becomes `FACE_LOST`

Warning copy:

- `KEEP YOUR FACE VISIBLE`

## 4. MOUTH_UNCLEAR Criteria

Mouth/lower-face reliability uses the existing mouth-region and hand landmark proximity check.

The code does not claim cheating or definite hand-mouth occlusion. It only reports that the mouth/lower-face region is not reliable enough.

Threshold:

- after about `800ms`, sustained mouth-region unreliability becomes `MOUTH_UNCLEAR`

Warning copy:

- `KEEP YOUR MOUTH VISIBLE`

## 5. CAMERA_OFF Criteria

Step 6-P3 adds explicit local defender handling for camera-off during `attack-active`.

If the local defender has no ready live video track during an active attack:

- detector is stopped
- local warning is shown
- no fair-play damage event is created

Warning copy:

- `TURN CAMERA ON`

## 6. Smoothing Values

Current values:

- `FACE_UNSTABLE_GRACE_MS = 400`
- `FACE_LOST_WARNING_MS = 1200`
- `MOUTH_UNCLEAR_WARNING_MS = 800`
- `VISIBILITY_RECOVERY_MS = 400`

These values are conservative enough to avoid reacting to 1-2 frame drops.

## 7. Recovery Conditions

When face/mouth reliability returns, the warning clears only after about `400ms` of stable visibility.

No button click or Ready Check rerun is required.

## 8. Warning UI

Warnings are shown in two lightweight places:

- the existing GAME BOARD inline warning badge
- a new small player-tile overlay badge on the local defender card

The UI uses the existing MEET MEET palette:

- cyan `#22e6f2`
- magenta accent
- navy
- white / muted text

No red, yellow, orange, modal, or blocking alert was added.

## 9. Smile Detector Relationship

Smile/laugh detection remains separate from Visibility Guard.

Visibility-invalid states can temporarily prevent a new laugh hit confirmation, but Visibility Guard itself never creates a LIFE loss event.

Existing one-hit-per-attack protection is unchanged.

## 10. CPU / Performance Impact

No new model was added.

The detector still runs on the same local video element and only while needed:

- active attack
- local defender
- not eliminated
- not already damaged for current attack

Camera-off handling stops detector work instead of trying to process invalid video.

## 11. Test Results

Code-level verification completed:

- Guard lifecycle is limited to active defender attack state.
- Camera-off path shows local warning and does not publish fair-play damage.
- GAME START conditions do not use visibility state.
- Attack timer is not paused by visibility warnings.

Manual browser tests still recommended:

- normal face visible
- short head turn
- 1.5s out of frame
- mouth/lower-face blocked
- camera off/on during attack
- 2-player auto/manual start
- turn handoff and LIFE behavior

## 12. Known False Positive Notes

Mouth/lower-face detection is intentionally conservative. The detector uses available landmarks and does not guarantee that a hand, mask, clothing, or head angle is the exact cause.

If mouth reliability is not consistently detectable in real sessions, this should remain a warning-only diagnostic signal.

## 13. Future Penalty Readiness

Penalty logic should not be added until enough real-session data confirms stable behavior.

Future penalty design would need:

- low-frequency synchronized visibility status
- defender-specific grace policy
- clear recovery rules
- no false elimination on detector uncertainty

## 14. Verification

- `npm run lint`: passed
- `npm run build`: passed
