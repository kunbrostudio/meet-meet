# MEET MEET Step 6-O11 Fair Play Host Authority Report

## Summary

Step 6-O11 fixes the next-match stall after a new participant joins a post-game room. Step 6-O10 made the Fair Play UI appear, but the flow could still remain stuck at `CHECKING...` because host authority and host badge rendering were not robust enough after the original host was eliminated.

## Changed Files

- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/ParticipantGameCard.tsx`
- `server/index.ts`
- `scripts/meet-meet-room-lifecycle-check.mjs`
- `docs/MEET_MEET_STEP6O11_FAIRPLAY_HOST_AUTHORITY_REPORT.md`

## Root Cause

The Fair Play detector owner path already used the local browser's participant stream and local LiveKit identity:

- Local stream source: `displayedLocalParticipant?.mediaStream`
- Local identity source: `localParticipantIdentityRef.current`
- PASS callback: `FairPlayDetector.onCheckResult`
- Publish function: `publishFairPlayCheckStatus`

The remaining break was host authority after host succession. If Kunan inherited the room host role on the server but the local client did not reliably evaluate `isCurrentUserHost` from the authoritative `hostParticipantIdentity`, Kunan would not aggregate Jun's `fair-play-check-status`. Jun could publish PASS, but no host would convert it into a shared `game-state-snapshot`, leaving everyone stuck in `CHECKING...`.

The HOST badge also had a separate render bug: `ParticipantGameCard` memo comparison did not include `participant.meetingRole`, so a host role update could be skipped even when `roomHostParticipantIdentity` changed correctly.

## Local Detector Owner Identity

The detector remains local-only:

- Jun browser checks Jun's local video stream.
- Kunan browser checks Kunan's local video stream.
- Remote rows in the Game Board remain summary-only.

Development logging now reports:

- `[local-participant] identity=... detectorTarget=...`
- `[fair-play-local] identity=... camera/face/mouth/smile/pass`

This verifies the detector is not accidentally targeting a remote participant.

## PASS Publish Identity

`onCheckResult` publishes Fair Play status using `localParticipantIdentityRef.current`, so the PASS payload belongs to the current browser's LiveKit identity.

Development logging now reports:

- `[fair-play-publish] identity=... status=passed`
- `[fair-play-shared] identity=... status=passed`

This separates local detector completion from host aggregation and shared snapshot sync.

## Host Authority

`isCurrentUserHost` now prioritizes the authoritative host identity:

1. `roomHostParticipantIdentity`
2. `gameState.hostParticipantIdentity`
3. only then the legacy local participant role fallback

This means Kunan gets actual host authority when the server says Kunan is the current `hostParticipantIdentity`, even if participant metadata/role strings are stale for a moment.

## HOST Badge

`ParticipantGameCard` now includes `participant.meetingRole` in its memo comparison. When Kunan becomes host, the card can re-render and show the `HOST` badge.

## Server Authority Diagnostics

`server/index.ts` now logs `[room-authority]` in development room state diagnostics:

- room code
- persisted `hostParticipantIdentity`
- participant identities
- names
- join order
- meeting roles

This confirms that after Ken is eliminated, Kunan remains the persisted server host and Jun joining does not recalculate host ownership incorrectly.

## Match 2 Roster

The lifecycle check verifies:

- A is removed.
- B remains as server host.
- C joins.
- Match 2 roster is `[B, C]`.
- B keeps Fair Play pass but Ready resets.
- C starts Fair Play required and not passed.
- Match 2 starts from `[B, C]`.

Stale Match 1 participant A is not included in Match 2 roster, Fair Play, Ready, or active players.

## Test Results

- `npm run lint`: passed
- `node scripts/meet-meet-room-lifecycle-check.mjs`: passed
- `npm run build`: passed

`npm run build` still reports the existing Vite chunk-size warning, but the build succeeds.

## Manual Verification

Recommended browser test:

1. Ken creates a 2-player room.
2. Kunan joins.
3. Finish Match 1 with Ken eliminated.
4. Confirm server log shows `[room-authority] hostParticipantIdentity=<Kunan identity>`.
5. Confirm Kunan card shows `HOST`.
6. Jun joins from a new browser session.
7. Confirm Jun sees local Fair Play and detector progresses to PASS.
8. Confirm Kunan sees Jun summary move from `CHECKING...` to `PASSED`.
9. Confirm both can become Ready and the board shows `2 / 2 READY`.
10. Confirm Kunan can manually start or auto-start Match 2.
