# MEET MEET Step 6-G Report

## Goal

Manual Host judgement and a basic Life system were added after attack end. Automatic laugh detection, scoring, LiveKit kick, and persistence were intentionally left out.

## Changed Files

- `src/types/game.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`
- `src/pages/MeetingRoomPage.tsx`
- `src/components/game-room/GameBoard.tsx`
- `src/components/game-room/GameBoardHeader.tsx`
- `src/components/game-room/MeetMeetRoomLayout.tsx`
- `src/components/game-room/ParticipantColumn.tsx`
- `src/components/game-room/ParticipantGameCard.tsx`
- `src/App.css`
- `docs/MEET_MEET_STEP6G_REPORT.md`

This report is written on top of the existing Step 6-E/6-F working tree changes.

## Life Authoritative State

`GameStateSnapshot` now includes:

```ts
playerStates?: Record<string, {
  lives: number
  eliminated: boolean
}>
```

Only Host creates and mutates this field through authoritative snapshots.

## DEFAULT_PLAYER_LIVES

`DEFAULT_PLAYER_LIVES = 3` is exported from `src/services/gameStateService.ts`.

Life is initialized once when Host confirms the first active roster and creates the first `role-reveal` snapshot.

## Phase Flow

Current flow:

```text
attack-active
-> attack-ended
-> judging
-> round-result
-> next attack-ready
```

If one or fewer players remain alive after a round result:

```text
round-result -> game-over
```

## Judging Phase

After `attack-ended`, Host publishes `judging` after the existing short end-review delay.

GAME BOARD shows:

- `판정 시간`
- `누가 웃었나요?`
- Guest copy: `Host가 판정을 진행하고 있습니다.`

Host sees checkbox controls for alive defenders only. The current attacker is never a judgement candidate.

## Host Judgement

Host confirms selected laughed defender identities from local UI.

Before applying Life changes, Host validates:

- current phase is `judging`,
- current round has no `roundResult`,
- target is in active roster,
- target is a defender,
- target is not the attacker,
- target is not eliminated.

Then Host publishes `round-result`.

## Duplicate Judgement Guard

Duplicate Life reduction is prevented by:

- ignoring judgement unless phase is `judging`,
- ignoring judgement when `roundResult` already exists,
- moving phase to `round-result` after the first confirmation,
- relying on authoritative snapshot revision and Host-only mutation.

Double-clicking the confirm button after phase transition cannot decrement Life again.

## Round Result Structure

`GameStateSnapshot.roundResult` uses:

```ts
{
  roundNumber,
  attackSequence,
  attackerIdentity,
  laughedParticipantIdentities,
  lifeChanges: [
    {
      participantIdentity,
      previousLives,
      currentLives,
      eliminated
    }
  ]
}
```

No-laugh rounds are represented by an empty `laughedParticipantIdentities` array and empty `lifeChanges`.

## Eliminated Handling

When a defender reaches Life 0:

- `eliminated = true`,
- the participant remains in the LiveKit room,
- video/audio are not disconnected,
- the participant card shows `ELIMINATED`,
- the participant is excluded from next attacker and defender selection.

## Next Attacker Selection

Host clicks `다음 라운드` from `round-result`.

Host uses the existing `turnOrder`, filters eliminated players out of the active player list, and picks the next alive identity after the current attacker. The order wraps around at the end.

If at least 2 players are alive:

- `roundNumber` increments,
- phase becomes `attack-ready`,
- previous attack timer/content/result are cleared,
- next attacker and defenders are published in the snapshot.

If 1 or fewer players are alive:

- phase becomes `game-over`,
- the last alive identity is used as the winner.

## Participant Card Life UI

Participant cards now show a small Life HUD:

- 3 Life: `♥ ♥ ♥`
- 2 Life: `♥ ♥ ♡`
- 1 Life: `♥ ♡ ♡`
- 0 Life: `♡ ♡ ♡` plus `ELIMINATED`

The webcam video itself is not filtered, dimmed, or covered by a large overlay.

## 2-Player Manual Test

1. Host and Guest join an MMT room.
2. Both Ready.
3. Host starts game.
4. Complete countdown, role reveal, attack-ready.
5. Attacker uploads image.
6. Attacker starts attack.
7. Wait for attack timer to end.
8. Confirm both screens show attack-ended, then judging.
9. Confirm only Host sees judgement checkboxes.
10. Confirm attacker is not listed as a judgement candidate.
11. Select defender and confirm.
12. Confirm both screens show Life `3 -> 2`.
13. Try confirming again and confirm Life does not decrement again.
14. Click next round.
15. Confirm next alive attacker is selected.
16. Repeat until one player remains and confirm game-over.

## 3-4 Player Behavior

- One attacker is selected from Host authoritative `turnOrder`.
- All alive non-attacker players are defenders.
- Host can select 0, 1, or multiple defenders as laughed in one judgement.
- Every selected defender loses exactly 1 Life.
- Eliminated players are excluded from future attacker/defender selection.

## Intentionally Excluded

- Automatic laugh detection
- Face recognition
- MediaPipe
- AI judgement
- Mic laugh analysis
- Video/audio/drawing attack tools
- Score/ranking/combo systems
- LiveKit kick or forced room exit
- Rematch
- Database persistence
- Login/user accounts

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

## Step 6-H Recommendation

- Add a Host controlled judgement confirmation affordance if needed.
- Add visible game-over summary and rematch preparation.
- Decide whether eliminated users become spectators.
- Add reconnect handling for `judging`, `round-result`, and `game-over`.
