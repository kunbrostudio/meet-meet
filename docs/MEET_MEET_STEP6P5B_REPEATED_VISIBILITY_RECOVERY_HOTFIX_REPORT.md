# MEET MEET Step 6-P5B Repeated Visibility Recovery Hotfix Report

## Purpose

This hotfix stabilizes the in-game visibility penalty countdown so repeated
FACE_LOST -> VISIBLE recovery cycles can happen safely within the same attack.
The scope is limited to stale visibility penalty timer prevention and repeated
episode cancellation.

## Changed Files

- `src/pages/MeetingRoomPage.tsx`
- `docs/MEET_MEET_STEP6P5B_REPEATED_VISIBILITY_RECOVERY_HOTFIX_REPORT.md`

## Root Cause

The visibility penalty countdown was keyed mainly by participant, attack, and
warning status, while the active timeout and interval were owned by shared refs.
After a recovery, the countdown was cleared, but an older interval or timeout
callback could still run with a stale FACE_LOST closure before React fully
settled the recovered warning state.

This meant a recovered defender could see a previous countdown continue, and a
stale timeout could later confirm a visibility penalty even though the current
stable state was already visible.

## Stale Deadline / Timeout Findings

- `visibilityPenaltyDeadlineRef` was cleared on cancellation, but stale callbacks
  did not verify that their deadline was still the current active deadline before
  acting.
- Timeout callbacks cleared global timer refs before checking whether they still
  belonged to the active episode.
- Recovery state in the detector was reset by Step 6-P5A, so this hotfix does
  not change detector thresholds. The remaining risk was timer ownership and
  stale callback validation in `MeetingRoomPage`.

## Episode Structure

`MeetingRoomPage` now tracks one active visibility penalty episode:

- `episodeId`
- episode key
- attack identity
- participant identity
- penalty status
- deadline

Each cancellation invalidates previous callbacks by incrementing the episode id
and clearing the active episode object.

## Stale Callback Defense

Before a countdown update or penalty confirmation runs, it checks:

- callback episode id matches the current episode id
- callback key matches the current episode key
- callback deadline matches the current deadline
- attack identity still matches
- phase is still `attack-active`
- participant is still not already penalized
- local one-hit-per-attack report lock is not already set
- warning is still active with the same penalty status

If any check fails, the callback is ignored and cannot reduce LIFE.

## Attack Identity Validation

The timer stores an attack identity made from:

- `roundNumber`
- `attackSequence`
- `attackerIdentity`

The timeout callback recomputes the current attack identity before confirming
a penalty. If the turn or attack changed, the stale callback is ignored.

## Recovery Cancellation

When the fair play detector emits `active: false`, `MeetingRoomPage` now cancels
the active visibility penalty episode immediately. This prevents a still-running
countdown interval from restoring the old FACE_LOST warning after stable visible
recovery.

## Test Notes

Code-level verification confirms stale callbacks now require the active episode,
current deadline, current attack identity, active warning state, and one-hit lock
checks before applying a penalty.

Manual browser verification is still required for the physical camera movement
scenarios:

- Repeat FACE_LOST -> countdown -> stable VISIBLE recovery at least five times.
- Confirm LIFE does not change during recovered episodes.
- Confirm a final real 3-second FACE_LOST episode applies exactly one LIFE
  penalty.
- Confirm turn or attack transition clears any pending visibility countdown.

Manual 5-cycle recovery result: not executed in this terminal-only run.

Manual real 3-second penalty result: not executed in this terminal-only run.

## Verification

- `npm run lint`: pass
- `npm run build`: pass
