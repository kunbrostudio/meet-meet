# MEET MEET Step 6-P Visibility Guard Report

## Purpose

Step 6-P adds an in-game Face Visibility Guard for the local defender during the active DON'T LAUGH attack phase.

The guard is diagnostic and user-facing only:

- It warns when face tracking is unstable.
- It warns when the face is not clear for a sustained period.
- It warns when the mouth/lower-face region is not reliable.
- It does not deduct LIFE.
- It does not eliminate, kick, or remove participants.
- It does not write to the chat timeline.

## Changed Files

- `src/services/fairPlayDetectorService.ts`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6P_VISIBILITY_GUARD_REPORT.md`

## Visibility Status Structure

`FairPlayDetector` now separates visibility state from smile detection:

- `UNKNOWN`
- `VISIBLE`
- `FACE_UNSTABLE`
- `FACE_LOST`
- `MOUTH_UNCLEAR`

`FairPlayWarningState` now carries a visibility-oriented `status` and conservative warning reason:

- `face-unstable`
- `face-lost`
- `mouth-unclear`

The implementation avoids claiming that a user is cheating or definitively covering their mouth. The UI uses reliability language such as `KEEP YOUR MOUTH VISIBLE`.

## Temporal Smoothing

The detector uses time-based smoothing:

- `FACE_UNSTABLE`: after about 400ms of unreliable face or mouth tracking.
- `FACE_LOST`: after about 1200ms of missing face tracking.
- `MOUTH_UNCLEAR`: after about 800ms of unreliable mouth/lower-face tracking.
- `VISIBLE`: restored only after about 400ms of stable visibility.

State-change logs are emitted only in development and only when the visibility status changes.

## Penalty Protection

The previous visibility timeout path could publish fair-play events for hidden face or mouth occlusion. Step 6-P removes that publish path.

Visibility warnings now remain local UI guidance and do not trigger:

- LIFE loss
- elimination
- kick
- room removal
- attack timer pause

Smile detection still emits `visible-laugh` only when the face and mouth area are reliable.

## Audio / Visual Fusion Protection

Audio laugh fusion no longer treats `FACE_LOST`, `FACE_UNSTABLE`, or `MOUTH_UNCLEAR` as a reason to confirm a laugh hit.

Audio-based hit confirmation is allowed only while the local visual state is reliable.

## UI

The existing inline `game-fair-play-warning` badge is reused in the GAME BOARD attack panel.

The warning:

- Is not a modal.
- Does not block gameplay.
- Does not show a penalty countdown.
- Uses the existing cyan/magenta/navy palette.
- Avoids new red, orange, or yellow warning colors.

The local participant video card still receives the existing warning frame treatment, now using the approved neon palette.

## Manual Test Checklist

1. Join as Host and Guest.
2. Start a DON'T LAUGH match.
3. Confirm the guard is inactive before `attack-active`.
4. Confirm the attacker does not receive visibility warnings.
5. As defender, briefly move out of frame; short drops should not immediately show `FACE_LOST`.
6. Stay out of frame for about 1.2s; `FACE NOT CLEAR` should appear.
7. Return to camera; warning should disappear after a short stable recovery.
8. Make the mouth/lower-face region unreliable; `KEEP YOUR MOUTH VISIBLE` should appear after smoothing.
9. Confirm attack timer continues while warnings are visible.
10. Confirm LIFE is not reduced by visibility warnings alone.
11. Confirm normal visible smile/laugh detection still works.

## Verification

- `npm run lint`: passed
- `npm run build`: passed

## Next Step Suggestions

- Tune thresholds using real 2-player sessions.
- Add an optional dev-only visibility diagnostic panel with face scale and mouth reliability values.
- Consider publishing low-frequency visibility status only if spectators or host moderation need it later.
