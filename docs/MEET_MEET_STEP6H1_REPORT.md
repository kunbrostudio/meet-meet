# MEET MEET Step 6-H1 Report

## Purpose

Step 6-H1 fixes the Guest/Participant client Fair Play Check sync issue found in 2-person Host + Chrome Incognito Guest testing.

## Root Cause

The main break was in `src/components/livekit/LiveKitTestRoom.tsx`.

`LiveKitDataBridge` publishes game messages on `LIVEKIT_GAME_STATE_TOPIC`, but its receive-side topic/type allow-list did not include `fair-play-check-status`.

Because of that, a Guest could publish local Fair Play Check progress, but the Host client filtered the message before calling `onDataMessage`. The Host aggregate snapshot stayed at the initial waiting/camera-required status, and the Guest UI also kept showing the stale Host snapshot.

## Why Host Worked But Guest Failed

- Host local detection worked because Host applies its own local Fair Play status directly through `applyFairPlayCheckStatusFromHost`.
- Guest detection/status had to travel through LiveKit Data.
- The missing `fair-play-check-status` allow-list entry blocked the Guest -> Host path.

## Guest Phase Reception

Guest still receives Host `game-state-snapshot` updates through the existing snapshot path. Step 6-H1 added development-only diagnostics for:

- `[fair-play] phase received`
- participant identity
- host/guest role
- current phase

## Guest Local Detector Startup

Guest detector startup remains client-local and is not Host-gated. Step 6-H1 keeps the architecture:

Client local camera -> local `FairPlayDetector.startFaceCheck()` -> status publish -> Host aggregate -> authoritative snapshot broadcast

No Host-side remote video analysis was added.

## LocalTrack Camera Ready

Camera readiness now uses the actual local analysis video track:

- video track exists
- `track.enabled === true`
- `track.muted === false`
- `track.readyState === 'live'`

This avoids treating Host/remote participant state as the source of truth for the local client.

## Already Camera ON Handling

`src/services/livekitParticipantAdapter.ts` now accepts `localMediaStream` as a fallback for the local mapped participant. `LiveKitParticipantObserver` passes the current `localMediaStream` into the adapter.

This makes the hidden Fair Play analysis video able to use an already-enabled local camera stream even if the LiveKit local publication object is not ready at the exact first mapping tick.

## Participant Identity Mapping

Fair Play status keys continue to use stable LiveKit participant identity:

- `participantIdentity`
- not display name
- not room code
- not browser/session storage

Host still rejects status updates whose identity is not in the active player roster.

## Guest -> Host Publish

Guest publishes:

- message type: `fair-play-check-status`
- topic: `LIVEKIT_GAME_STATE_TOPIC`
- transport: existing reliable LiveKit Data path

The receive allow-list now includes this message type, so Host can receive and aggregate it.

## Host Aggregate

Host handles `fair-play-check-status` through `applyFairPlayCheckStatusFromHost`.

Development-only diagnostics were added:

- `[fair-play] participant status received`
- `[fair-play] aggregate updated`
- `[fair-play] status published`
- `[fair-play] detector started`
- `[fair-play] local camera ready`

These logs are guarded by `import.meta.env.DEV` and are not frame-level logs.

## Incognito Test Result

Automated browser testing was not run in this environment. The code path that specifically affected Incognito Guest sync was fixed: Guest status messages are no longer filtered out by the LiveKit game-topic receive allow-list.

## Camera Already ON Test

Automated browser testing was not run in this environment. The implementation now reads the current local video track immediately when `fair-play-check` begins, rather than requiring a fresh camera toggle event.

## Validation

- `npm run lint` passed.
- `npm run build` passed.

The Vite chunk-size warning remains and is unrelated to this bugfix.
