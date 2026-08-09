# MEET MEET Step 6-F Report

## Goal

Attack end synchronization and the first round transition state were added on top of the existing Host-authoritative game state flow.

## Changed Files

- `src/types/game.ts`
- `src/services/livekitChatService.ts`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `docs/MEET_MEET_STEP6F_REPORT.md`

This step builds on the existing Step 6-E attack image work already present in the working tree.

## Phase Transition

Current synchronized flow:

```text
waiting
-> ready
-> countdown
-> game-started
-> role-reveal
-> attack-ready
-> attack-active
-> attack-ended
-> round-ended
```

New phase:

- `round-ended`: neutral next-round preparation state after the attack end review window.

## Host Authoritative Attack End

- `MeetingRoomPage` keeps using Host-only `attackCompletionTimerRef`.
- Host compares `Date.now()` with authoritative `attackEndsAt`.
- When the timer expires, Host publishes an `attack-ended` snapshot.
- Guests do not locally change phase when their local UI timer reaches zero. They continue to follow the Host snapshot.

## Round Transition

After `attack-ended`, Host waits `GAME_ATTACK_END_REVIEW_DURATION_MS` and publishes `round-ended`.

The `round-ended` snapshot:

- advances `roundNumber` by 1,
- advances `currentTurnIndex` to the next active player,
- sets the next `attackerIdentity`,
- recalculates `defenderIdentities`,
- clears `attackStartedAt`,
- clears `attackDurationMs`,
- clears `attackEndsAt`,
- clears `attackContent`,
- keeps the existing `turnOrder` stable.

If fewer than 2 active players remain, Host publishes `waiting` instead.

## UI

- `attack-ended` now displays:
  - `공격 종료`
  - `이번 공격이 끝났습니다.`
- `round-ended` displays:
  - `다음 라운드 준비 중`
  - next attacker name
- Participant cards receive `isAttackActive` only during `attack-active`, so `ACTIVE ATTACK` and `버티는 중` are released after the attack ends.
- Upload preview state is cleared outside `attack-ready`.

## Race / Duplicate Guard

- Existing `attackSequence`, `roundNumber`, and `attackEndsAt` checks remain in the Host attack-end timer.
- The round transition timer checks the latest `gameStateRef` before publishing.
- Timer refs are cleared on phase changes and component cleanup.

## Verification

Ran:

```bash
npm run lint
npm run build
```

Result:

- `npm run lint`: passed.
- `npm run build`: passed.
- Vite emitted the existing chunk-size warning for the LiveKit bundle.

## Manual Test Method

1. Host and Guest join the same room.
2. Both participants Ready.
3. Host starts the game.
4. Confirm synchronized countdown and role reveal.
5. Attacker uploads a static image.
6. Confirm both clients show the approved image.
7. Attacker starts attack.
8. Confirm both clients show `attack-active` and the timer.
9. Wait for timer end.
10. Confirm both clients receive Host snapshot and show `공격 종료`.
11. Confirm participant cards no longer show `ACTIVE ATTACK` / `버티는 중`.
12. Confirm both clients move to `round-ended` with the next attacker shown.
13. Confirm previous attack image and upload message are no longer shown in `round-ended`.

## Remaining Limits

- No score, life, judging, laugh detection, or winner logic yet.
- `round-ended` does not yet include a Host button or timer to enter the next `attack-ready`.
- Attack content cleanup is state-level only in this step; server temp file lifecycle remains room-scoped from Step 6-E.

## Step 6-G Recommendation

- Add a Host-authoritative transition from `round-ended` to next `attack-ready`.
- Add a simple judging placeholder before round transition.
- Introduce life state and defender result collection.
- Add reconnect handling for clients joining during `attack-ended` or `round-ended`.
