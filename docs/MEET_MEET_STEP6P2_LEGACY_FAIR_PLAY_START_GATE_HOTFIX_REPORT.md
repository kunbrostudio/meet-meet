# MEET MEET Step 6-P2 Legacy Fair Play Start Gate Hotfix Report

## 1. Actual Blocking Location

The match start was blocked in `src/pages/MeetingRoomPage.tsx`, inside `handleStartGame`.

The branch logged:

```text
[match-start] start blocked: fair play check incomplete
```

It created an in-room `fairPlayCheck` state and required every active player to pass it before allowing `GAME START`.

## 2. Legacy Fair Play Architecture

The older room-level architecture expected every participant to complete an in-room Fair Play Check before a match could start.

That legacy structure used:

- `GameFairPlayCheckState`
- `GameFairPlayCheckParticipantStatus`
- `isFairPlayCheckPassed`
- `fairPlay.check.participants`

These structures still exist for compatibility and related detector workflows, but they are no longer match-start prerequisites.

## 3. Current App-Level Game Ready Architecture

Current MEET MEET flow:

1. Main app CAMERA is enabled.
2. App-level GAME READY CHECK validates camera / face / mouth / smile.
3. Create Room / Join Room is allowed only after Game Ready.
4. In the room, users use Room READY to express match intent.

Entering a room already implies the App-level Game Ready gate has passed.

## 4. Why They Conflicted

The room no longer runs the old in-room Fair Play Check, so the legacy `passed` list could remain empty.

That produced:

```text
2 / 2 READY
passed 0 / 2
```

As a result, both auto start and manual start were blocked even though the correct room-level start requirements were satisfied.

## 5. Removed Start Gate

Removed the `allPassed` gate from `handleStartGame`.

Match start now depends on:

- Host authority
- `phase === 'ready'`
- connected participant count
- room ready count
- active roster count
- duplicate start protection

It no longer waits for in-room Fair Play pass state.

## 6. Detector Functions Kept

The detector and related structures were not deleted.

Still retained:

- App-level Game Ready Check detector support
- smile/laugh detection
- attack-phase Visibility Guard
- fair-play event handling for actual laugh detection

Only the legacy in-room start gate was removed.

## 7. Auto Start Test

Expected:

1. Host + Guest join.
2. Both users are Room READY.
3. Auto start reaches 0.
4. `handleStartGame('auto')` accepts the request.
5. Host publishes `countdown`.
6. Countdown completes.
7. Round 1 role reveal and attack flow begin.

The legacy `fair play check incomplete` log should no longer appear.

## 8. Manual Start Test

Expected:

1. Host + Guest join.
2. Both users are Room READY.
3. Host clicks `GAME START`.
4. `handleStartGame('manual')` accepts the request.
5. Match proceeds to countdown and Round 1.

The legacy `fair play check incomplete` log should no longer appear.

## 9. First Match Test

First match should proceed:

- `ready`
- `countdown`
- `game-started`
- `role-reveal`
- `attack-ready`
- `attack-active`

## 10. Second Match Impact

Second match and infinite room flow now use Room READY rather than a stale room-level `fairPlay.check` pass list.

This prevents a later match from being blocked by an old or empty legacy fair-play roster.

## 11. Visibility Guard Impact

Step 6-P Visibility Guard remains separate.

It activates only during `attack-active` for the local defender and is not used as a match start condition.

## 12. Verification

- `npm run lint`: passed
- `npm run build`: passed
