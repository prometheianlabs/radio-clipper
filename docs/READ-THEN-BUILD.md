# Read Then Build

Use this order before writing implementation code.

## Current slice

**Slice 02 — Shoutcast Ingest** (plan approved, ready for implementation)

## Read order

1. [START-HERE.md](../START-HERE.md)
2. [ROADMAP.md](../ROADMAP.md)
3. [slices/SLICE-02-shoutcast-ingest.md](../slices/SLICE-02-shoutcast-ingest.md) ← current slice
4. [ARCHITECTURE.md](../ARCHITECTURE.md)
5. [ARCHON-WORKFLOW.md](../ARCHON-WORKFLOW.md)
6. [DATA-MODEL.md](../DATA-MODEL.md)
7. [API-AND-EVENTS.md](../API-AND-EVENTS.md)
8. [docs/SLICE-02-IMPLEMENTATION-PLAN.md](SLICE-02-IMPLEMENTATION-PLAN.md)
9. [docs/CODING-STYLE.md](CODING-STYLE.md)

## Build order (Slice 02)

1. Shared ingest contracts in `packages/contracts`.
2. Station ingest configuration model.
3. `ShoutcastSourceAdapter` in `services/ingest-gateway`.
4. Live session lifecycle against DynamoDB.
5. Chunk segmentation and S3 archive path.
6. Ingest health surface.
7. Operator setup note for BUTT in `docs/`.

## Guardrails

- Keep `ShoutcastSourceAdapter` internals behind the protocol-agnostic adapter boundary.
- Do not couple downstream services (transcription, export, UI) to Shoutcast-specific fields.
- Chunk timing must derive from absolute UTC plus session offset — not arrival clock.
- Write DynamoDB chunk metadata only after the S3 object write succeeds.
- Do not start Slice 03 transcription work in this slice.
- Use readable Hungarian notation in all new code.
