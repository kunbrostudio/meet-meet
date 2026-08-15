# MEET MEET Step 6-H5 Room Create Fix2 Report

## Changed Files

- `server/index.ts`
- `.env.example`
- `README.md`
- `docs/MEET_MEET_STEP6H5_ROOM_CREATE_FIX2_REPORT.md`

## Root Cause

The repeated room creation block was caused by using browser-session room ownership as a hard permission check for `POST /api/free-beta/rooms`.

Even after stale reconciliation was added, the create path still checked the session's active room set and returned an active-room error when the session appeared to have an existing room. That made cleanup correctness part of create permission, which is fragile during repeated local tests, game-over flows, elimination flows, and API server restarts.

## Removed Per-Session Validation

Removed the hard-block create validation based on:

- `session.activeRoomCodes`
- `maxActiveRoomsPerSession`
- previous active room references

The Korean error message saying that one browser session can only create one active room is no longer present in runtime server/client code.

The join path no longer blocks on per-session active room ownership either. It still validates target room existence and capacity.

## Remaining Abuse Protection

The following protections remain:

- global active room capacity: `FREE_BETA_MAX_ACTIVE_ROOMS`
- create rate limit: `FREE_BETA_CREATE_RATE_LIMIT`
- create rate window: `FREE_BETA_CREATE_RATE_WINDOW_SECONDS`
- join rate limit: `FREE_BETA_JOIN_RATE_LIMIT`
- max participants per room: `FREE_BETA_MAX_PARTICIPANTS`
- room duration / expiration cleanup
- `FREE_BETA_MEETING_CREATION_ENABLED`

## createRateLimit Structure

Room creation uses an in-memory `createRateBuckets` map keyed by client IP.

Defaults remain:

- `FREE_BETA_CREATE_RATE_LIMIT=3`
- `FREE_BETA_CREATE_RATE_WINDOW_SECONDS=600`

This is now the main repeated-create abuse control instead of per-browser-session room ownership.

## maxActiveRooms Meaning

`FREE_BETA_MAX_ACTIVE_ROOMS` is a global in-memory active room capacity guard. It counts active rooms from `freeBetaRooms` where:

- `closedAt` is empty
- `expiresAt` is in the future

The old default was effectively `3`. The config is still environment-variable based. Development keeps a low default of `3`; production now defaults to `100` unless deployment config sets `FREE_BETA_MAX_ACTIVE_ROOMS`.

## Production Configuration

Production should set:

- `FREE_BETA_MAX_ACTIVE_ROOMS`
- `FREE_BETA_CREATE_RATE_LIMIT`
- `FREE_BETA_CREATE_RATE_WINDOW_SECONDS`
- `FREE_BETA_ROOM_DURATION_MINUTES`

These remain runtime environment variables and were not written into `.env`.

## Memory Registry Note

The current room/session implementation is in-memory:

- `anonymousSessions`
- `freeBetaRooms`
- `attackContentRecords`
- rate limit maps

This is acceptable for local/dev and a single long-running server instance, but it is not a reliable authoritative global state for serverless or multi-instance production. A later production hardening step should move room/session/rate-limit state to a shared store such as Redis or a database.

## Cleanup Behavior

The cleanup and reconciliation helpers from the previous session fix are retained. They still clean stale references and room associations, but create permission no longer depends on them being perfect.

Room cleanup paths remain:

- host room end
- room expiration
- participant leave
- participant kick / elimination
- last participant leave

## Test Results

Automated checks run:

- `rg` confirmed the active-room browser-session block string/code is no longer present in runtime `server` or `src`.
- `npm run lint`: passed
- `npm run build`: passed

Manual tests still recommended:

- 10 repeated create/end/create cycles in the same Chrome session
- game-over then create
- player elimination then create
- API server restart then create
- normal Chrome host and Incognito guest join

## Final Policy

MEET MEET no longer treats "this browser session previously had a room" as a reason to block room creation.

Room creation can still fail for real reasons:

- server capacity
- create rate limit
- LiveKit configuration / creation failure
- network failure
- meeting creation disabled
