# MEET MEET Step 6-P5 Visibility Countdown UI Hotfix Report

## 1. Actual Cause of Countdown Restart

The Step 6-P4 visibility countdown was owned by a React effect cleanup.

When the effect re-ran while `FACE_LOST` was still active, cleanup cleared the active timeout/interval and reset the countdown key. The next effect pass started a fresh countdown, producing repeated logs:

```text
[visibility-penalty] countdown started
[visibility-penalty] cancelled { reason: 'effect-cleanup' }
```

## 2. Why Effect Cleanup Repeated

The countdown UI updates `fairPlayWarning.remainingMs` every 250ms. Even though the visible status stayed the same, normal render/effect lifecycle changes could still cause the effect cleanup path to run.

Because cleanup was treated as a real cancellation, harmless lifecycle work became game-state cancellation.

## 3. Timer Ownership Change

Timer ownership is now attack-scoped and ref-based:

- `visibilityPenaltyKeyRef`
- `visibilityPenaltyDeadlineRef`
- `visibilityPenaltyTimerRef`
- `visibilityPenaltyIntervalRef`
- `visibilityPenaltyInitialTimerRef`

Effect cleanup no longer cancels an active countdown. Countdown is cancelled only by meaningful state changes.

## 4. Deadline / State Machine Structure

When a penalty status starts:

```text
deadline = Date.now() + 3000
```

Re-renders reuse the same key and deadline. Remaining time is calculated from the deadline instead of restarting from 3 seconds.

State flow:

- `VISIBLE`
- `FACE_LOST` / `CAMERA_OFF`
- `COUNTDOWN_ACTIVE`
- `RECOVERED` or `PENALTY_CONFIRMED`

## 5. Recovery Logic

Countdown is cancelled when:

- visibility recovers
- status changes to `FACE_UNSTABLE` or `MOUTH_UNCLEAR`
- attack ends
- defender has already been hit
- game leaves active attack

Recovery logs include remaining milliseconds.

## 6. One-Hit Lock Connection

The existing one-hit-per-attack lock remains unchanged:

- `penalizedParticipantIdentitiesForCurrentAttack`
- `localFairPlayAttackReportRef`
- `localFairPlayEventReportedRef`

If a defender has already taken damage, visibility countdown is not started.

## 7. Warning UI Changes

GAME BOARD warning is now vertical and centered:

- warning text
- larger countdown number
- centered layout
- added padding and gap

The old left/right inline alignment was removed.

## 8. `#f22bbe` Applied Locations

The warning pink is used for:

- warning border
- countdown number
- player tile warning border
- warning glow / pulse
- player tile visibility badge

Normal ready/info cyan remains separate.

## 9. Player Tile Pulse Animation

The local defender tile now uses a soft `participant-visibility-warning-pulse` animation while warning is active.

The pulse is slow and subtle, avoiding rapid flashing.

## 10. Desktop Test

Recommended manual test:

1. Start a 2-player attack.
2. Defender leaves frame until `FACE_LOST`.
3. Confirm countdown starts once.
4. Confirm `3 -> 2 -> 1` does not restart.
5. Confirm LIFE -1 after timeout.

## 11. Mobile Test

Recommended manual test:

1. Use mobile portrait.
2. Trigger `FACE_LOST`.
3. Confirm warning text is centered.
4. Confirm countdown number is readable.
5. Confirm player tile warning does not overflow.

## 12. Verification

- `npm run lint`: passed
- `npm run build`: passed
