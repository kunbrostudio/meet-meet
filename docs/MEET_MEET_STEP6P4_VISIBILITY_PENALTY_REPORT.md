# MEET MEET Step 6-P4 Visibility Penalty Report

## 1. Visibility Penalty Architecture

Visibility penalty is implemented as a local defender detector signal that enters the existing Host-authoritative fair-play damage pipeline.

Flow:

1. Local defender enters `FACE_LOST` or `CAMERA_OFF` during `attack-active`.
2. Local UI starts a 3 second warning countdown.
3. If the defender recovers before timeout, countdown is cancelled.
4. If the countdown completes, the client submits a `fair-play-event-request`.
5. Host validates current attack state and applies LIFE damage through the existing pipeline.

No direct local LIFE mutation was added.

## 2. FACE_LOST Grace Criteria

FACE_LOST still relies on the existing smoothed visibility guard:

- `FACE_UNSTABLE_GRACE_MS = 400`
- `FACE_LOST_WARNING_MS = 1200`
- `VISIBILITY_RECOVERY_MS = 400`

Short tracking loss does not start a LIFE penalty.

## 3. 3 Second Countdown

When `FACE_LOST` is confirmed, the local defender warning becomes:

- `KEEP YOUR FACE VISIBLE`
- countdown number from 3 to 1

The countdown uses `VISIBILITY_PENALTY_COUNTDOWN_MS = 3000`.

## 4. CAMERA_OFF Handling

When the local defender turns camera off during `attack-active`:

- detector stops
- warning shows `TURN CAMERA ON`
- 3 second countdown starts
- camera recovery cancels the countdown
- timeout submits `visibility-camera-off`

## 5. LIFE Hit Pipeline Connection

New fair-play reasons:

- `visibility-face-lost`
- `visibility-camera-off`

Both reasons are validated by the LiveKit game data parser and then handled by the same `applyFairPlayEventFromHost` pipeline used by smile/audio hits.

## 6. One Hit Per Attack

The existing lock remains the source of truth:

- `penalizedParticipantIdentitiesForCurrentAttack`
- `localFairPlayAttackReportRef`
- `localFairPlayEventReportedRef`

If a defender already lost LIFE in the current attack, visibility countdown is cancelled or ignored.

## 7. Multi Defender Behavior

Visibility hit is treated as a normal defender HIT.

If not all active defenders are hit, the attack continues.

If all active defenders are hit, the existing early attack end path runs.

## 8. Attack Early Finish

The Host-owned damage pipeline already checks `allDefendersHit`.

Visibility hit participates in that same check, so 1:1 visibility hit can end the attack immediately.

## 9. Elimination

Visibility hit uses the same LIFE decrement path.

If LIFE reaches 0:

- existing eliminated state is set
- existing forced removal behavior applies
- Host handoff behavior remains owned by existing room lifecycle code

## 10. Host Handoff Impact

No new Host handoff logic was added.

If the Host is a defender and is eliminated by a visibility hit, the existing elimination and Host transfer flow remains responsible.

## 11. Timer Cancellation

Visibility countdown cancels when:

- warning status recovers
- status changes to non-penalty `FACE_UNSTABLE` or `MOUTH_UNCLEAR`
- attack phase ends
- defender already received current attack damage
- effect unmounts

Attack timer continues while visibility countdown is running.

## 12. Warning UI / Color

Warning UI uses the existing player tile badge and GAME BOARD warning badge.

P4 updates warning accents to:

- `#f22bbe`

Navy surfaces and pixel styling are preserved.

## 13. Desktop Test

Recommended manual tests:

1. 2 players ready and start match.
2. Defender leaves frame briefly for about 0.3s: no LIFE change.
3. Defender leaves frame until countdown starts, then returns before 3s: no LIFE change.
4. Defender stays out for 3s: `VISIBILITY HIT · LIFE -1`.
5. Confirm 1:1 attack ends early.

## 14. Mobile Test

Recommended mobile checks:

1. Defender tile displays compact warning.
2. GAME BOARD shows readable countdown.
3. Text does not overflow in mobile portrait.
4. Attack timer continues.

## 15. Verification

- `npm run lint`: passed
- `npm run build`: passed
