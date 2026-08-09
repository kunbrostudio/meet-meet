# MEET MEET Step 6-E Report

## Goal

Static image attack content sync was added for the current `attack-ready` -> `attack-active` flow. LiveKit Data carries only image metadata and `contentId`; image bytes are uploaded to and downloaded from the API server.

## Changed Files

- `.env.example`
- `README.md`
- `server/index.ts`
- `src/App.css`
- `src/components/game-room/GameBoard.tsx`
- `src/components/livekit/LiveKitTestRoom.tsx`
- `src/pages/MeetingRoomPage.tsx`
- `src/services/attackContentService.ts`
- `src/services/gameStateService.ts`
- `src/services/livekitChatService.ts`
- `src/types/game.ts`

## Server Upload API

- Added `POST /api/free-beta/rooms/:roomCode/attack-content`.
- Added `GET /api/free-beta/attack-content/:contentId/meta`.
- Added `GET /api/free-beta/attack-content/:contentId`.
- Uploads require the existing HttpOnly session cookie and room membership.
- Uploaded files are stored in the OS temp directory under `meet-meet-attack-content`.
- The room registry owns uploaded `contentId`s through `FreeBetaRoom.attackContentIds`.
- Room expiration and host room end delete temporary attack content from memory and disk.

## Validation

- Allowed formats: JPEG, PNG, WebP.
- Max size: 3MB.
- Server validates image magic signatures and rejects unsupported content.
- Server does not trust client participant identity or role for upload ownership.
- Upload ownership is derived from the session participant in the room registry.
- Added upload rate limit settings:
  - `FREE_BETA_ATTACK_UPLOAD_RATE_LIMIT`
  - `FREE_BETA_ATTACK_UPLOAD_RATE_WINDOW_SECONDS`

## Game State Metadata

Added `GameAttackContent` to `GameStateSnapshot`:

- `contentId`
- `mimeType`
- `size`
- `uploaderParticipantIdentity`
- `roomCode`
- `roundNumber`
- `version`
- `createdAt`

No binary, base64, data URL, or filesystem path is included in the LiveKit snapshot.

## LiveKit Sync

Added `attack-content-submit-request` on `LIVEKIT_GAME_STATE_TOPIC`.

Flow:

1. Attacker uploads image with `multipart/form-data`.
2. API returns content metadata.
3. Attacker sends `attack-content-submit-request` with `contentId`, `roundNumber`, and `attackSequence`.
4. Host validates sender authority and server metadata.
5. Host publishes authoritative `game-state-snapshot` with `attackContent`.
6. All clients download the blob with `credentials: 'include'` and display an object URL.

## Host Authority

Only Host can approve attack content into the game snapshot. Host validation checks:

- Current phase is `attack-ready`.
- LiveKit sender identity is the current `attackerIdentity`.
- Sender is in `activePlayerIdentities`.
- Round number matches.
- Attack sequence matches.
- Server metadata `roomCode` matches the room.
- Server metadata uploader identity matches the LiveKit sender.

`attack-start-request` is ignored unless the authoritative snapshot already has `attackContent`.

## UI

- Attacker sees an upload/select/drop area in `attack-ready`.
- Attacker can replace the image before attack start.
- Defender sees that the attacker is preparing an image.
- Once Host approves the content, both attacker and defender fetch and preview the same image.
- `attack-active` and `attack-ended` keep displaying the approved image.
- Images use `object-fit: contain`; no filters or color overlays are applied.

## Safety Notes

- GIF, SVG, video, audio, drawing tools, camera attack, life, score, judging, and next-round logic were not implemented.
- LiveKit video/audio, chat, room creation/join, participant distribution, Ready, countdown, and attacker selection logic were preserved.
- Object URLs are revoked during replacement and component cleanup.

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

## Manual Test Checklist

1. Host and Guest join the same MMT room.
2. Both participants Ready, Host starts countdown.
3. After role reveal, if Host is attacker, Host uploads a JPEG/PNG/WebP image.
4. If Guest is attacker, Guest uploads a JPEG/PNG/WebP image.
5. Confirm both screens show the same approved image preview in `attack-ready`.
6. Confirm `공격 시작` stays disabled until Host snapshot includes `attackContent`.
7. Start attack and confirm both screens show the same image during `attack-active`.
8. Confirm the image remains visible in `attack-ended`.
9. Try GIF/SVG or a file larger than 3MB and confirm rejection.
10. Confirm room end removes temporary room content without affecting LiveKit/chat behavior.

## Step 6-F Recommended Work

- Add attack result/judging phase placeholder.
- Define life state separately from attack content metadata.
- Add Host-authoritative round transition policy.
- Add attack content cleanup when moving to a new round.
- Add reconnect behavior for late participants during `attack-active`.
