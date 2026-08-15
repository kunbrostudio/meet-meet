# MEET MEET Step 6-GR1 Report

## Goal

Manual Host judgement was replaced with local-only real-time visual fair-play detection. Each participant analyzes only their own local webcam and sends minimal fair-play events to Host. Host remains the only authority that updates Life.

## Changed Files

- `package.json`
- `package-lock.json`
- `src/types/game.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`
- `src/services/fairPlayDetectorService.ts`
- `src/components/livekit/LiveKitTestRoom.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `src/components/game-room/MeetMeetRoomLayout.tsx`
- `src/components/game-room/ParticipantColumn.tsx`
- `src/components/game-room/ParticipantGameCard.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6GR1_REPORT.md`

## MediaPipe Package

Installed:

- `@mediapipe/tasks-vision`

Used features:

- `FaceLandmarker`
- face blendshapes
- `HandLandmarker`

## Local Webcam Only

`FairPlayDetector` receives a hidden local video element backed by `displayedLocalParticipant.mediaStream`.

It does not analyze:

- remote participant video,
- server-side video,
- saved video,
- uploaded images.

It does not send webcam frames, face images, hand images, raw landmarks, or full blendshape arrays through LiveKit or the server.

## FaceLandmarker / HandLandmarker

`src/services/fairPlayDetectorService.ts` initializes both detectors once and reuses them:

- `FaceLandmarker.createFromOptions(..., { runningMode: 'VIDEO', outputFaceBlendshapes: true })`
- `HandLandmarker.createFromOptions(..., { runningMode: 'VIDEO', numHands: 2 })`

The loop is throttled by `DETECTION_INTERVAL_MS = 90`, roughly 10-12fps.

## Face Check Flow

New phase:

```text
waiting -> ready -> face-check -> countdown
```

Host starts `face-check` after everyone is Ready and initializes:

- active roster,
- turnOrder,
- `playerStates` with `DEFAULT_PLAYER_LIVES`,
- `fairPlay.checkSequence`.

Each client performs local face check:

1. camera forward
2. mouth visible
3. mouth-open response
4. smile response
5. pass

Each client sends `fair-play-check-result`. Host trusts LiveKit sender identity, not payload identity. Countdown starts only when every active non-eliminated player has PASS for the current check sequence.

## Calibration

Calibration stays in local runtime:

- `neutralSmileScore`
- `neutralMouthOpen`
- `smileReferenceScore`

Only PASS metadata is synchronized. Calibration data and landmarks are not sent.

This is not a mask classifier. It is a mouth visibility / calibration based MVP.

## Laugh Score

The detector combines:

- `mouthSmileLeft`
- `mouthSmileRight`
- `cheekSquintLeft`
- `cheekSquintRight`
- neutral smile calibration delta
- sustained duration

Constants are centralized in `fairPlayDetectorService.ts`.

## Episode / Hysteresis

Laugh state machine:

```text
neutral -> candidate -> locked -> neutral
```

Current MVP settings:

- trigger score: `LAUGH_TRIGGER_SCORE`
- rearm score: `LAUGH_REARM_SCORE`
- minimum duration: `LAUGH_MIN_DURATION_MS`
- lock duration: `LAUGH_LOCK_MS`

One continuous laugh episode can only request one Life penalty until the detector rearms.

## Mouth ROI / Hand Overlap

Mouth ROI uses face landmarks around:

- upper/lower lip
- left/right mouth corners

Hand landmarks are checked against an expanded mouth bounding box. Sustained overlap starts mouth occlusion warning.

## Visibility Warning

During `attack-active`, only alive DEFENDER clients run detection.

Warnings:

- mouth occluded: `입을 보여주세요!`
- face missing: `얼굴을 보여주세요!`

Grace/countdown:

- face missing grace: about 500ms
- mouth occlusion grace: about 500ms
- violation countdown: `VISIBILITY_COUNTDOWN_MS = 4000`

If the face/mouth returns before timeout, warning cancels and no penalty is sent.

## Fair Play Events

LiveKit message:

```ts
fair-play-event-request
```

Reasons:

- `visible-laugh`
- `mouth-occlusion-timeout`
- `face-not-visible-timeout`

Payload includes:

- `eventId`
- reason
- roundNumber
- attackSequence
- detectorVersion
- optional score summary

No target participant identity is accepted from payload.

## Host Authority

Host validates:

- phase is `attack-active`,
- sender is in active roster,
- sender is not attacker,
- sender is current defender,
- sender is not eliminated,
- roundNumber matches,
- attackSequence matches,
- eventId has not been processed.

On success, Host decrements only the sender's Life and publishes a new authoritative `game-state-snapshot`.

## Life Update

Existing `playerStates` is reused:

```ts
playerStates[participantIdentity] = {
  lives,
  eliminated
}
```

Life changes do not stop the attack timer. Attack image and timer continue.

## Manual Judging Removed

The runtime flow no longer enters manual judgement.

Removed from active UI:

- `판정 시간`
- `누가 웃었나요?`
- defender checkboxes
- `판정 확정`
- Host manual judgement controls

The current flow is:

```text
attack-active
-> attack-ended
-> round-ended
-> next attack-ready
```

## Performance / Cleanup

- Detector is not created on every render.
- Inference is throttled and non-overlapping.
- Loop stops outside `face-check` and eligible `attack-active`.
- Detector closes on room unmount/leave cleanup.

## Debug Mode

`VITE_FAIR_PLAY_DEBUG=true` enables a small debug panel with:

- smile score
- cheek score
- laugh state
- face visible
- mouth occluded
- warning remaining ms

No raw landmarks or images are logged.

## Known Limits

- This is not a dedicated mask detection model.
- Face/mouth visibility calibration can fail under poor lighting or unusual camera angles.
- Thresholds need real user tuning.
- MediaPipe model assets load from public URLs at runtime.
- No audio laughter detection in this step.

## Step 6-GR2

Audio laughter detection is intentionally deferred to Step 6-GR2.

## Manual Test

2-player:

1. Host and Guest join.
2. Both Ready.
3. Host starts game.
4. Both enter face-check.
5. Normal face/mouth/smile passes.
6. Cover mouth during face-check and confirm it does not pass.
7. Complete countdown, role reveal, image upload, attack start.
8. Defender smiles/laughs and confirms Life decreases on both screens.
9. Keep laughing and confirm same episode does not drain all Life.
10. Return neutral, laugh again, confirm a new Life penalty can occur.
11. Cover mouth for less than 4 seconds, confirm no penalty.
12. Cover mouth for 4 seconds, confirm Life decreases.
13. Move face out of camera for 4 seconds, confirm Life decreases.
14. Confirm attack timer continues after every penalty.

3-4 players:

- Every client analyzes only its own local webcam.
- Only alive defenders run detection during their defender turn.
- Attacker detector penalties are disabled during their own attack.
- Host applies penalties per sender identity.

## Verification

Ran:

```bash
npm run lint
npm run build
```

Result:

- `npm run lint`: passed.
- `npm run build`: passed.
- Vite emitted the existing chunk-size warning.
