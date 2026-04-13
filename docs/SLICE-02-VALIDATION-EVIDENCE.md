# Slice 02 Validation Evidence

This record captures the executable validation evidence for [slices/SLICE-02-shoutcast-ingest.md](../slices/SLICE-02-shoutcast-ingest.md).

## Automated checks

Executed on 2026-04-12 / 2026-04-13 during Slice 02 sign-off:

```bash
cd services/ingest-gateway
npm test
npm run typecheck
npm run validate:local
```

Results:

- `npm test` passed with 56 tests across checks 1 through 8.
- `npm run typecheck` passed.
- `npm run validate:local` passed using the real gateway entry point in in-memory local mode.

## Local proof output

Command:

```bash
cd services/ingest-gateway
npm run validate:local
```

Observed evidence:

```json
{
  "sCheckedAt": "2026-04-13T02:20:31.629Z",
  "sGatewayStatus": "idle",
  "oFirstConnection": {
    "eStatus": "online",
    "sSessionId": "5d7af141-28fa-4a50-930f-8ed9e4970bd1",
    "nReconnectCount": 0,
    "nLatestChunkSequenceNo": 0,
    "nLatestChunkDurationMs": 500
  },
  "oAfterFirstDisconnect": {
    "eStatus": "offline",
    "sSessionId": null
  },
  "oReconnect": {
    "eStatus": "online",
    "sSessionId": "5d7af141-28fa-4a50-930f-8ed9e4970bd1",
    "nReconnectCount": 1,
    "nLatestChunkSequenceNo": 2
  },
  "oAfterFinalDisconnect": {
    "eStatus": "offline",
    "sSessionId": null
  }
}
```

## What this proves

1. The gateway starts locally without AWS-backed stores when `INGEST_USE_IN_MEMORY_STORES=1`.
2. A simulated source connects successfully through `/stream`.
3. The first connection produces a live session and a completed chunk.
4. A clean disconnect transitions station health back to `offline`.
5. A reconnect preserves the same `sSessionId` and increments `nReconnectCount`.
6. Final disconnect returns the station to `offline` cleanly.

## Remaining manual evidence

- A human-operated BUTT session against either local mode or AWS-backed infrastructure should still be captured when an operator session is available.
- AWS-backed infrastructure verification still needs live DynamoDB and S3 evidence before claiming production readiness.