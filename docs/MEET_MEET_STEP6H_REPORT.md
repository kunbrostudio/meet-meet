# MEET MEET Step 6-H Report

## Purpose

Step 6-H adds a pre-game Fair Play Check gate before the synchronized countdown. The game now waits for local camera/face/mouth/smile checks from every active player before the Host publishes the countdown snapshot.

## Changed Files

- `src/types/game.ts`
- `src/services/livekitChatService.ts`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `src/components/game-room/PlayerGallery.tsx`
- `src/App.css`

## Fair Play State Structure

- Added `fair-play-check` to `GamePhase`.
- Added `GameFairPlayCheckState` under `GameStateSnapshot.fairPlay.check`.
- Each active participant is tracked with:
  - `cameraReady`
  - `faceReady`
  - `mouthReady`
  - `smileReady`
  - `passed`
  - `failed`
  - `step`
  - `message`
  - detector version metadata where available

## Detection Flow

Each client runs the existing local `FairPlayDetector.startFaceCheck()` against its own camera feed during `fair-play-check`.

The local detector maps UI steps to synchronized status:

- Camera missing/off -> `cameraReady=false`
- Face visible/stable -> `faceReady`
- Mouth visible/open check -> `mouthReady`
- Smile check -> `smileReady`
- Completed check -> `passed=true`

Mouth occlusion during this pre-game check blocks progress but does not apply life penalties.

## Host Authority

Clients publish `fair-play-check-status` LiveKit data messages. Only the Host applies those messages to the authoritative `game-state-snapshot`.

Guests do not create countdown timing, change phase, or mutate the room-level fair play state locally. They render only the Host snapshot.

## All-Pass Gate

The Host checks `fairPlay.check.participants` for every `activePlayerIdentity`.

When every active participant has:

- camera ready
- face ready
- mouth ready
- smile ready
- passed

the Host publishes the next authoritative snapshot:

`fair-play-check -> countdown`

The existing synchronized countdown then continues unchanged.

## Participant Exit / Camera Reset

- If the room is no longer full during `fair-play-check`, the Host returns the game to `waiting`.
- If active players drop below 2, the Host also returns to `waiting`.
- If a participant turns camera off during the check, that participant publishes a reset status with `cameraReady=false`.

## UI

`GameBoard` now renders a compact `FAIR PLAY CHECK` panel only during `fair-play-check`.

It shows:

- local check message
- CAMERA / FACE / MOUTH / SMILE progress chips
- participant-level pass/wait messages

The existing GAME MODE / PLAYERS MODE layout and arcade styling were preserved.

## Validation

- `npm run lint` passed.
- `npm run build` passed.

Build warning remains the existing Vite chunk-size warning for large bundles.

## Manual Test Procedure

1. Open Host and Guest with cameras off.
2. Fill room or use Host start flow.
3. Confirm game enters `fair-play-check`, not `countdown`.
4. Confirm camera-off players show a camera-required message.
5. Turn cameras on and complete face/mouth/smile checks on each client.
6. Confirm Host publishes countdown only after all active players pass.
7. Switch between GAME MODE and PLAYERS MODE during the check and confirm status persists.
8. Turn camera off during the check and confirm that player resets to not ready.
9. Leave during the check and confirm the Host returns the game to `waiting` if the room is no longer full or fewer than 2 players remain.

## Remaining Limits / Next Step

- No new penalty or life logic was added for pre-game check failures.
- No automatic camera or microphone activation was added.
- Step 6-I or the next game-flow step can tune the check panel copy and add richer reconnect/retry handling if needed.
