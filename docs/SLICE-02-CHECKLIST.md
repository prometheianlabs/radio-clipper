# Slice 02 Checklist

This checklist translates [slices/SLICE-02-shoutcast-ingest.md](../slices/SLICE-02-shoutcast-ingest.md) into concrete sign-off work.

## Goal

Prove that one station feed can enter AWS through the v1 Shoutcast path, create or resume a live session, and persist deterministic rolling chunks with correct metadata and health visibility.

## Scope for this slice

- implement shared ingest contracts for normalized audio, session lifecycle, and chunk metadata
- validate station ingest configuration before accepting a source connection
- implement `ShoutcastSourceAdapter` behind the protocol-agnostic adapter boundary
- implement live session create, heartbeat, reconnect, and end handling
- implement deterministic fixed-window chunk assembly
- write chunk objects before chunk metadata persistence
- expose ingest health state through HTTP health routes
- provide a BUTT operator setup note for simulated and real validation

## Explicitly defer

- transcription worker implementation
- transcript persistence
- UI live transcript updates
- clip export logic
- future Icecast or WebRTC adapters

## Validation for this slice

Use these checks before claiming Slice 02 done:

1. Station config and source credential validation reject invalid input and disabled stations.
2. A simulated Shoutcast source authenticates, creates a session, and emits normalized frames.
3. Reconnect preserves session identity and increments reconnect tracking.
4. Chunk assembly produces deterministic windows and monotonic `sequence_no` values.
5. S3 chunk writes happen before DynamoDB metadata writes.
6. Health routes report current station ingest status.
7. Session reconnect updates preserve live session invariants in storage.
8. Heartbeat writes bridge back into in-memory health tracking.
9. A station operator has a clear BUTT setup note for local and AWS-backed use.

## Stop condition

This slice is ready to hand off when the ingest gateway can accept one real or simulated Shoutcast source, survive reconnects without corrupting the session clock, persist correct chunk metadata, and answer current ingest health for that station.

## Completion record

**Status: DONE — 2026-04-12**

Validation evidence recorded:

1. `services/ingest-gateway` tests pass: 56 tests across checks 1 through 8.
2. `services/ingest-gateway` typecheck passes.
3. BUTT operator note exists at `docs/BUTT-OPERATOR-SETUP.md` and covers local dev plus AWS-backed validation.
4. Shared ingest contracts exist under `packages/contracts/src/`.
5. Ingest gateway wiring, session lifecycle, chunk pipeline, and health routes exist under `services/ingest-gateway/src/`.
6. Executable local proof output is recorded at `docs/SLICE-02-VALIDATION-EVIDENCE.md`.

Remaining sign-off gap:

- real or simulated manual BUTT session proof should be captured as operational evidence when an encoder session is available.

Next step:

- plan Slice 03 without reopening Slice 02 scope.