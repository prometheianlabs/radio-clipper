# Start Here

Use this pack as the build source of truth for the first version of Radio Clipper.

## Product scope

Keep v1 narrow:

- one station feed per active session
- Shoutcast ingest first
- near-live transcript and captions
- rolling audio retention
- transcript selection to clip export
- Angular producer workflow
- Amplify Gen 2 + Cognito
- DynamoDB for metadata
- S3 for audio and exports

Do not add these in v1:

- automated clipping rules
- AI summaries
- speaker diarization
- waveform editing
- public sharing portals
- automation system integrations
- direct newsroom/CMS publishing
- Icecast or WebRTC contribution as launch blockers

## Repository shape

Suggested top-level structure:

- `apps/web` — Angular producer/admin interface
- `amplify/` — Amplify Gen 2 backend, auth, outputs, and custom resources
- `services/control-api` — authenticated REST + SSE service
- `services/ingest-gateway` — contribution protocol termination and normalization
- `services/transcribe-worker` — real-time transcription worker
- `services/export-worker` — clip render/export worker
- `packages/contracts` — shared API and event contracts
- `packages/config` — shared config parsing and validation
- `docs/` — planning docs copied from this pack
- `.archon/` — Archon workflows and run instructions

## Build order

Read and execute slices in order:

1. `slices/SLICE-01-foundation.md`
2. `slices/SLICE-02-shoutcast-ingest.md`
3. `slices/SLICE-03-live-transcription.md`
4. `slices/SLICE-04-producer-console.md`
5. `slices/SLICE-05-clipping-and-export.md`
6. `slices/SLICE-06-admin-ops-hardening.md`

Then keep the future integration slice queued:

7. `slices/SLICE-07-future-ingest-adapters.md`

## Architectural rule that cannot be broken

Every finalized transcript token must map back to a precise audio time range.

That means the system must preserve:

- station identity
- live session identity
- absolute UTC timestamps
- chunk boundaries
- transcript token timing
- deterministic clip reconstruction rules

## Development rule that cannot be broken

Do not let AI coding tools edit multiple slices at once.

Every slice must end with:

- a written plan
- implementation bounded to that slice
- validation evidence
- review notes
- explicit stop condition

Use Archon to enforce that workflow.
