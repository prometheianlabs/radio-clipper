# Read Then Build

Use this order before writing implementation code.

## Current slice

**Slice 03 — Live Transcription** (planning next; Slice 02 implementation complete)

## Read order

1. [START-HERE.md](../START-HERE.md)
2. [ROADMAP.md](../ROADMAP.md)
3. [slices/SLICE-03-live-transcription.md](../slices/SLICE-03-live-transcription.md) ← current slice
4. [ARCHITECTURE.md](../ARCHITECTURE.md)
5. [ARCHON-WORKFLOW.md](../ARCHON-WORKFLOW.md)
6. [DATA-MODEL.md](../DATA-MODEL.md)
7. [API-AND-EVENTS.md](../API-AND-EVENTS.md)
8. [docs/SLICE-02-CHECKLIST.md](SLICE-02-CHECKLIST.md)
9. [docs/SLICE-03-IMPLEMENTATION-PLAN.md](SLICE-03-IMPLEMENTATION-PLAN.md)
10. [docs/CODING-STYLE.md](CODING-STYLE.md)

## Build order (Slice 03 planning)

1. Read the Slice 02 completion record and keep its boundaries intact.
2. Read `slices/SLICE-03-live-transcription.md`.
3. Define the normalized handoff from ingest into transcription.
4. Plan partial and final transcript persistence.
5. Plan the live transcript event stream to the UI.
6. Define validation targets for timing fidelity and transcript delay.

## Guardrails

- Keep `ShoutcastSourceAdapter` internals behind the protocol-agnostic adapter boundary.
- Do not couple downstream services (transcription, export, UI) to Shoutcast-specific fields.
- Chunk timing must derive from absolute UTC plus session offset — not arrival clock.
- Write DynamoDB chunk metadata only after the S3 object write succeeds.
- Do not reopen Slice 02 implementation unless validation evidence falsifies it.
- Use readable Hungarian notation in all new code.
