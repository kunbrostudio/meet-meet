# MEET MEET Step 6-P5A Visibility Recovery Hysteresis Report

## 1. Flicker Cause

The observed warning flicker came from unstable recovery handling in the visibility detector.

After a defender returned from `FACE_LOST`, the detector could briefly reacquire the face, clear the warning, then lose landmarks again during camera/landmark reacquisition. That allowed the UI to bounce between warning on/off even though the player had returned to camera.

## 2. Previous Raw / Stable Structure

The previous implementation already had timing thresholds, but the recovery path was too short:

- recovery confirmation was about `400ms`
- no recovery lock existed
- `FACE_UNSTABLE` could be emitted as a warning state
- repeated same-state warning emissions could overwrite countdown UI state

Raw detector fluctuation could therefore leak into the game-facing warning state.

## 3. New State Machine

The detector now separates raw candidates from stable visibility state:

```text
raw face / mouth signal
-> candidate timer
-> stable visibility state
-> warning / countdown / game rule
```

Recommended flow:

```text
VISIBLE
-> FACE_UNSTABLE
-> FACE_LOST
-> recovery candidate
-> VISIBLE
-> recovery lock
```

## 4. FACE_LOST Enter Threshold

`FACE_LOST_ENTER_MS = 800`

The face must remain missing long enough before stable `FACE_LOST` is emitted. Short drops remain ignored or internal `FACE_UNSTABLE`.

## 5. Recovery Confirm Threshold

`FACE_RECOVERY_CONFIRM_MS = 800`

After `FACE_LOST`, the face must be detected steadily for about 800ms before the warning clears and stable `VISIBLE` is restored.

## 6. Recovery Lock

`FACE_RECOVERY_LOCK_MS = 1000`

After confirmed recovery, short face-missing noise is ignored for about 1 second. This absorbs detector reacquisition jitter after the user returns to camera.

`CAMERA_OFF` remains outside this lock and is handled by the local camera track state.

## 7. Countdown Connection

Penalty countdown still starts only from stable:

- `FACE_LOST`
- `CAMERA_OFF`

It does not start from raw face missing frames or `FACE_UNSTABLE`.

The detector now emits warning state only on stable status changes, preventing countdown `remainingMs` from being overwritten by repeated same-state detector callbacks.

## 8. Effect Cleanup Impact

Step 6-P5 already moved countdown ownership to ref/deadline state.

Step 6-P5A complements that by preventing detector warning churn from repeatedly changing UI state during the same stable `FACE_LOST` episode.

## 9. Player Tile Warning

Player tile warning and pulse still use the same local warning state. Because warning state now follows stable visibility status, tile border pulse no longer reflects raw detector flicker.

## 10. Tests A-G

Code-level verification:

- `FACE_LOST` requires sustained missing face detection.
- Recovery requires sustained visible detection.
- Recovery lock prevents immediate re-entry after successful recovery.
- `FACE_UNSTABLE` does not trigger penalty countdown.
- `MOUTH_UNCLEAR` remains warning-only.
- `CAMERA_OFF` penalty path is unchanged.
- Countdown deadline logic remains untouched.

Manual camera tests still recommended:

- A: complete face exit
- B: return during countdown
- C: return and hold still for 10s
- D: slight movement after recovery
- E: real exit after recovery lock ends
- F: short head dip
- G: camera off

## 11. Verification

- `npm run lint`: passed
- `npm run build`: passed
