# MEET MEET Step 6-GR2 Report

## Scope

Step 6-GR2 adds local microphone laughter analysis during `attack-active` and fuses it with the existing visual Fair Play detector. Life changes still go through the existing Host authoritative `fair-play-event-request` path.

No raw audio, recordings, waveforms, spectrograms, video frames, landmarks, or classifier history are sent over LiveKit or stored.

## Changed Files

- `package.json`
- `package-lock.json`
- `src/constants/fairPlayAudio.ts`
- `src/services/audioLaughDetectorService.ts`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/services/livekitChatService.ts`
- `src/types/game.ts`
- `src/App.css`
- `public/models/README.md`
- `docs/MEET_MEET_STEP6GR2_REPORT.md`

This work builds on uncommitted GR1/GR1B files already present in the working tree.

## Package

Installed:

- `@mediapipe/tasks-audio`

Command used:

- `npm install @mediapipe/tasks-audio`

The first sandboxed attempt failed with DNS resolution for `registry.npmjs.org`; the install succeeded after approved network access.

## YAMNet Model

Default model path:

- `/models/yamnet.tflite`

Expected repository location:

- `public/models/yamnet.tflite`

The actual `.tflite` model file is not committed because it was not available locally in this environment. `public/models/README.md` documents the required placement and `VITE_FAIR_PLAY_AUDIO_MODEL_PATH` override.

Official model source to use:

- Google YAMNet TFLite from TensorFlow Hub: `lite-model/yamnet/classification/tflite/1`

If the model file is missing at runtime, `AudioLaughDetector` reports unavailable and the visual detector continues without crashing.

## Laughter Categories

`src/constants/fairPlayAudio.ts` defines the category allowlist:

- `Laughter`
- `Giggle`
- `Snicker`
- `Belly laugh`
- `Chuckle, chortle`

`Baby laughter` is intentionally excluded.

Because YAMNet metadata category names must match exactly, the detector also reports the top returned category in debug mode so real local testing can confirm the allowlist.

## Local Microphone Reuse

`MeetingRoomPage` reuses the existing local participant `MediaStream`:

- `fairPlayLocalStream?.getAudioTracks()[0]`
- wrapped as `new MediaStream([audioTrack])`
- passed to `AudioLaughDetector`

The detector does not call `stop()` on the reused microphone track. It only closes its own `AudioContext`, source node, processor node, timer, and classifier.

If the browser microphone permission is removed or the track is ended, audio detection becomes unavailable and visual detection remains active.

## Audio Sampling

`src/services/audioLaughDetectorService.ts` creates:

- `AudioContext`
- `MediaStreamAudioSourceNode`
- bounded `ScriptProcessorNode`
- rolling in-memory sample buffer
- inference interval guarded by `inferenceBusy`

Sampling constants:

- `AUDIO_LAUGH_SAMPLE_WINDOW_MS = 975`
- `AUDIO_LAUGH_INFERENCE_INTERVAL_MS = 450`

The detector keeps only a bounded rolling buffer and does not queue unlimited inference work.

## Worker Architecture

Worker architecture was reviewed but not implemented in this step. MediaPipe Audio `classify()` is synchronous, so the current implementation limits work on the main thread with:

- one classifier instance per active local audio track
- attack-only activation
- bounded sample buffer
- fixed inference interval
- `inferenceBusy` guard

Moving classification into a Vite worker is still recommended after the YAMNet model file is present and local latency can be measured.

## Audio Laugh Score

Each inference result is reduced to:

- `audioLaughScore`: max score among allowed laughter categories
- `topCategoryName`
- `topCategoryScore`

Thresholds are centralized in `src/constants/fairPlayAudio.ts`:

- `AUDIO_LAUGH_CANDIDATE_THRESHOLD = 0.45`
- `AUDIO_LAUGH_TRIGGER_THRESHOLD = 0.70`
- `AUDIO_LAUGH_VERY_HIGH_THRESHOLD = 0.85`
- `AUDIO_LAUGH_REARM_THRESHOLD = 0.32`
- `AUDIO_LAUGH_EPISODE_LOCK_MS = 1800`

## Episode / Dedup

Audio state:

- `neutral`
- `audio-candidate`
- `audio-triggered`
- `locked`

An audio episode emits one `AudioLaughEvent` with one `eventId`. After trigger, the detector locks for `AUDIO_LAUGH_EPISODE_LOCK_MS` so one laugh sound does not create repeated local requests.

The existing Host damage lock remains the final defense.

## Fusion Rules

Visual direct rule remains unchanged:

- existing visual `visible-laugh` immediately sends a Fair Play event

Audio fusion in `MeetingRoomPage.handleAudioLaughEvent`:

- mouth occluded + audio trigger: `occluded-audio-laugh`
- face hidden + audio trigger: `hidden-audio-laugh`
- visual smile/cheek/candidate signal + audio trigger: `multimodal-laugh`
- face visible + very high audio score: `audio-laugh`

Ambiguous audio-only spikes below `AUDIO_LAUGH_VERY_HIGH_THRESHOLD` do not send a penalty request.

## Host Authority

Audio and fused events reuse:

- LiveKit game-state topic
- `fair-play-event-request`
- `handleLocalFairPlayEvent`
- `applyFairPlayEventFromHost`

Host validation still requires:

- `phase === attack-active`
- sender is active player
- sender is not attacker
- sender is defender
- sender is not eliminated
- roundNumber matches
- attackSequence matches
- eventId not processed
- current attack damage lock does not include sender

The payload does not include a trusted participant identity. Host uses LiveKit sender identity.

## One-Hit-Per-Attack

GR1B damage cap is preserved.

`shouldRunAttackFairPlay` now also checks `!isLocalFairPlayDamageLocked`, so both visual and audio detectors stop sending local events after the participant has already lost Life in the current `attackSequence`.

Host still checks `penalizedParticipantIdentitiesForCurrentAttack` before reducing Life. This covers:

- `visible-laugh`
- `multimodal-laugh`
- `audio-laugh`
- `occluded-audio-laugh`
- `hidden-audio-laugh`
- `mouth-occlusion-timeout`
- `face-not-visible-timeout`

## UI

Normal users only see a small attack-time status:

- `마이크 웃음 감지 중`

Life feedback remains generic:

- `웃음 감지! LIFE -1`
- `이번 공격 피해 완료`

Debug mode only:

- visual score
- audio score
- top audio category
- audio episode state
- unavailable reason

Debug uses existing:

- `VITE_FAIR_PLAY_DEBUG=true`

## Microphone Mute

This step reuses the existing local audio track. If MEET MEET mute disables that same track, browser audio analysis may receive silence and audio detection can become ineffective while muted.

The implementation does not alter LiveKit microphone publish/mute behavior. A future step should decide whether local fair-play analysis should use a separate cloned analysis track before publish mute is applied.

## Privacy

Not sent or stored:

- raw audio samples
- microphone recordings
- waveform arrays
- spectrograms
- AudioBuffer data
- classifier result history

Optional event/debug values:

- `audioLaughScore`
- top laughter category name/score

## Cleanup

`AudioLaughDetector.stop()` cleans up:

- interval timer
- rolling sample buffer
- `ScriptProcessorNode`
- `MediaStreamAudioSourceNode`
- `AudioContext`

`close()` additionally closes the MediaPipe classifier. It does not stop the reused microphone track.

## CPU / Latency

The current implementation avoids render-time classifier creation and only runs during eligible defender `attack-active`.

Known cost:

- `AudioClassifier.classify()` is synchronous.
- Current mitigation is bounded interval and no unbounded queue.
- Worker migration is recommended for GR2 follow-up once model/runtime behavior is manually profiled.

## Remote Speaker / Background Laughter Limit

No existing strong remote audio-level signal was integrated in this step. Speaker playback or background laughter can still create audio-only false positives.

Current mitigation:

- audio-only requires `VERY_HIGH`
- normal multimodal cases prefer visual + audio
- mouth/face hidden cases require visibility state plus high audio
- one-hit-per-attack prevents repeated Life loss

Manual testing should compare speakers vs headphones.

## Current Attack Content Assumption

This implementation assumes current attack content is static image only.

Future attack-media audio must be excluded or suppressed before enabling audio/video attack content.

## Validation

Executed:

- `npm run lint`: passed
- `npm run build`: passed

lint still reports one existing warning in `MeetingRoomPage.tsx` about unnecessary hook dependencies, but there are no lint errors.

## Manual Test Plan

2-player:

- Host and Guest pass pre-join Face Check.
- Start game, reach `attack-active`.
- Defender speaks normally: Life should not change.
- Defender laughs out loud: audio score should rise; if fusion rule passes, Life decreases by 1 on both screens.
- In same `attackSequence`, trigger visual laugh and hidden audio laugh again: Life must not decrease a second time.
- Next `attackSequence`, a new laugh can reduce Life again.

Mouth occlusion:

- Defender covers mouth.
- Warning appears.
- Defender laughs before 4-second timeout.
- Expected reason: `occluded-audio-laugh`.
- Life decreases by at most 1.

Face hidden:

- Defender moves face out of camera.
- Warning appears.
- Defender laughs.
- Expected reason: `hidden-audio-laugh`.
- Short tracking loss without high audio should not trigger.

General audio false-positive:

- Test normal speech, loud speech, cough, breathing, singing.
- Confirm Life does not decrease in ordinary cases.

Remote/background laughter:

- Remote participant laughs through speakers while defender remains neutral.
- Compare speaker playback vs headphones.
- If false positives occur, raise audio-only threshold or require stronger visual confirmation.

3-4 players:

- Each browser analyzes only its own local microphone.
- Host remains authoritative for Life.
- Non-attacker defenders can each lose at most one Life per `attackSequence`.

## Next Step Proposal

- Add the official `public/models/yamnet.tflite` asset and manually verify category names.
- Profile `AudioClassifier.classify()` latency on desktop/mobile.
- Move inference into a Vite worker if latency is visible.
- Tune thresholds with real laughter/speech/background tests.
- Decide policy for local analysis when LiveKit microphone publish is muted.
- Add remote speaking/audio-level contamination mitigation if existing LiveKit state exposes a reliable signal.
