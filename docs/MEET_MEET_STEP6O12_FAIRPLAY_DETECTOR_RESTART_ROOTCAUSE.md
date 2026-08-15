# MEET MEET Step 6-O12 Fair Play Detector Restart Root Cause

## Summary

Step 6-O12 fixes the Fair Play detector restart lifecycle. The Game Board already showed the Fair Play UI after a new participant joined a post-game room, but the actual detector pipeline could remain stuck at `CHECKING...` because detector lifetime was scoped to the page component rather than to the current local Fair Play session.

This step does not change room lifecycle, host succession, Ready, auto start, attack, life, kick, chat, or visual design.

## Changed Files

- `src/pages/MeetingRoomPage.tsx`
- `src/services/fairPlayDetectorService.ts`
- `docs/MEET_MEET_STEP6O12_FAIRPLAY_DETECTOR_RESTART_ROOTCAUSE.md`

## First Fair Play Path

The first Fair Play path is:

1. `MeetingRoomPage` derives `fairPlayLocalStream` from `displayedLocalParticipant?.mediaStream`.
2. Hidden analysis video `fairPlayVideoRef` receives that local stream.
3. `shouldRunFairPlayCheck` becomes true for the local participant in a pre-game phase.
4. `MeetingRoomPage` creates `new FairPlayDetector(video, callbacks)`.
5. `FairPlayDetector.startFaceCheck()` initializes MediaPipe `FaceLandmarker` and `HandLandmarker`.
6. `FairPlayDetector.startLoop()` starts the RAF frame loop.
7. `detect()` processes frames and emits check states.
8. `handleFaceCheck()` advances `CAMERA -> FACE -> MOUTH -> SMILE -> PASS`.
9. `onCheckResult` publishes PASS for `localParticipantIdentityRef.current`.

## Second Fair Play Failure Point

The second Fair Play UI could appear without guaranteeing a fresh detector session. The previous code reused:

- `fairPlayDetectorRef.current`
- `fairPlayDetectorModeRef.current`
- the detector's cached `video` reference
- RAF/frame state such as `running`, `lastDetectionAt`, and `processing`

The page stays mounted across match cycles, so React component mount/unmount was not a reliable detector lifecycle boundary. A new Fair Play requirement needed to reset the detector by session, not by page.

## Root Cause

Root cause: Fair Play detector lifecycle was not keyed to the current local Fair Play session.

The bug category is:

- stale detector/session ref
- stale video element binding risk
- RAF lifecycle not explicitly reset per Fair Play session
- effect dependency too broad for UI, but not explicit enough for detector session ownership

It was not fixed by changing UI conditions, room roster, Ready, or host authority because those paths only made the Fair Play panel visible. They did not force the detector engine to restart for the second local session.

## Fix

`MeetingRoomPage.tsx` now creates a local Fair Play session key from:

- `meetingId`
- `roomCode`
- local participant identity
- Fair Play check `startedAt` or current game state update timestamp
- local video track id

When that key changes:

1. The old detector is stopped and closed.
2. `fairPlayDetectorRef` is cleared.
3. `fairPlayDetectorModeRef` is reset to `idle`.
4. duplicate publish state is reset.
5. A new `FairPlayDetector` instance is created against the current hidden video element.

`FairPlayDetector` now also supports `setVideo(video)` so reused detector instances can explicitly bind to the current video element.

## Detector Reset Details

`FairPlayDetector.startFaceCheck()` now resets:

- `lastDetectionAt`
- `processing`
- frame diagnostic state
- face-check stage diagnostic state
- `faceCheckStartedAt`
- `faceStableSince`
- `mouthOpenSeen`
- `smileSeen`

`stop()` also clears `processing` in addition to cancelling the RAF loop.

## Diagnostic Logs

Development logs added:

- `[fair-play-session]`
- `[fair-play-video]`
- `[fair-play-detector]`
- `[fair-play-loop]`
- `[fair-play-frame]`
- `[fair-play-stage]`
- `[fair-play-not-started]`
- existing `[fair-play-local]`
- existing `[fair-play-publish]`

Expected first cycle:

```text
[fair-play-session] id=... participant=... required=true
[fair-play-video] element=true srcObject=true trackState=live
[fair-play-detector] instance=created closed=false
[fair-play-loop] status=started mode=face-check
[fair-play-frame] status=processing
[fair-play-stage] CAMERA=pass
```

Expected second cycle:

```text
[fair-play-session] id=... participant=... required=true
[fair-play-video] element=true srcObject=true trackState=live
[fair-play-detector] instance=created closed=false
[fair-play-loop] status=started mode=face-check
[fair-play-frame] status=processing
[fair-play-stage] CAMERA=pass
```

The second cycle should now produce a fresh session and fresh loop logs rather than silently reusing stale detector state.

## Manual Verification Targets

Jun browser after joining a post-game room:

1. Fair Play UI appears.
2. `[fair-play-session]` logs Jun's local identity.
3. `[fair-play-video]` shows `srcObject=true` and `trackState=live`.
4. `[fair-play-loop]` and `[fair-play-frame]` appear.
5. UI progresses through `CAMERA -> FACE -> MOUTH -> SMILE -> PASS`.
6. `[fair-play-complete]` equivalent is visible through `[fair-play-local]` and `[fair-play-publish]`.

Kunan restart case:

1. A new local Fair Play session creates a different session key.
2. The previous detector is closed.
3. A new detector instance starts the RAF loop.
4. The same stage progression works without participant-name-specific logic.

## Test Results

- `npm run lint`: passed
- `node scripts/meet-meet-room-lifecycle-check.mjs`: passed
- `npm run build`: passed

`npm run build` still emits the existing Vite chunk-size warning, but the build succeeds.

## Limitations

Browser-only MediaPipe frame processing cannot be fully proven from the terminal build. The code now logs the exact detector session, video binding, RAF loop, and first frame processing points needed to compare first and second browser cycles directly.
