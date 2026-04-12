# Memory

## Snapshot (2026-04-12)

- planning pack and slice docs reviewed end-to-end
- Slice 01 foundation is complete (`docs/SLICE-01-CHECKLIST.md`)
- Slice 02 implementation exists in code and docs (`docs/SLICE-02-IMPLEMENTATION-PLAN.md`, `docs/BUTT-OPERATOR-SETUP.md`)
- `.archon/config.yaml` marks current slice as `slice-02-shoutcast-ingest` with next workflow `validate-slice`
- working tree currently has in-progress, uncommitted Slice 02 and app-shell edits

## Locked decisions

- Angular frontend lives in `apps/web`
- Amplify Gen 2 is the top-level backend foundation
- Cognito groups are `producer`, `admin`, and `platform_admin`
- v1 ingest starts with Shoutcast
- service boundaries stay protocol-agnostic
- scaffold code uses readable Hungarian notation
- ingest gateway writes chunk metadata only after successful S3 object write
- reconnects continue the same session model with monotonic timing and sequence values

## Implemented Slice 02 surface

1. `packages/contracts` includes ingest adapter, session, chunk, and station config types.
2. `packages/config` includes station config validation and ingest gateway env loading.
3. `services/ingest-gateway` includes:
   - `ShoutcastSourceAdapter` and Shoutcast protocol parsing
   - `SessionManager` and DynamoDB session store
   - `ChunkAssembler`, S3 audio store, DynamoDB chunk store
   - in-memory ingest health tracker and health HTTP routing
   - `main.ts` pipeline wiring and graceful shutdown
4. operator setup and validation checklist documented in `docs/BUTT-OPERATOR-SETUP.md`.

## Validation snapshot (2026-04-12)

- `apps/web`: `npm test -- --watch=false` passed
- `apps/web`: `npm run build` passed
- `amplify`: `npm run typecheck` passed
- `packages/contracts`: `npm run typecheck` passed
- `packages/config`: `npm run typecheck` passed
- `services/ingest-gateway`: `npm run typecheck` passed
- `services/ingest-gateway`: `npm test` — 49/49 passed (all six validation checks)
  - check-1: credential parsing and station config validation (7 tests)
  - check-2: adapter session creation (5 tests)
  - check-3: reconnect lifecycle (3 tests)
  - check-4: chunk assembly determinism (8 tests)
  - check-5: S3 → DynamoDB write ordering and failure paths (4 tests)
  - check-6: IngestHealthTracker state transitions and HTTP routing (14 tests)

## Slice 02 status

Slice 02 is **validated**. All six stop-condition checks pass in isolation against in-memory stubs. Archon config updated to `status: validated`, `next_workflow: commit-slice`.

## Near-term next steps

1. commit Slice 02 (contracts, config, ingest-gateway, test suite, docs, archon config).
2. decide timing for replacing local stubs (`STATION_CONFIG_JSON`, `SOURCE_PASSWORD`) with live DynamoDB/Secrets Manager reads.
3. end-to-end proof with a real or simulated BUTT source if available before Slice 03 starts.
