# Slice 03 Implementation Plan

This plan translates [slices/SLICE-03-live-transcription.md](../slices/SLICE-03-live-transcription.md) into an implementation sequence that stays bounded to near-live transcription.

## Goal

Generate near-live transcript text from the normalized live audio feed, persist finalized timing data in DynamoDB, and surface transcript updates over SSE without leaking protocol-specific ingest concerns downstream.

## Scope boundary

In scope:

- low-latency audio handoff from ingest into the transcription worker
- transcript worker process shape and package boundary
- partial and final transcript handling
- transcript persistence in DynamoDB
- transcript events over SSE for later UI consumption
- transcript delay measurement and visibility

Out of scope:

- producer transcript selection UX
- clip request creation or export rendering
- monitor player delivery changes
- custom vocabulary management
- speaker diarization or channel-aware transcript features

## Locked technical decisions

1. The transcription worker must consume normalized audio frames, not Shoutcast-specific connection state.
2. Partial transcript text is display-only and must never become the authoritative clipping basis.
3. Final transcript items must preserve both absolute UTC timestamps and session offsets.
4. Transcript persistence must follow the `transcript_items` table shape in [DATA-MODEL.md](../DATA-MODEL.md).
5. Live transcript fan-out to the UI should use the SSE model already established in [API-AND-EVENTS.md](../API-AND-EVENTS.md).
6. Delay tracking must distinguish transcript lag from ingest health so operators can see where latency is introduced.

## Implementation order

### 1. Shared transcript contracts

Extend `packages/contracts` with the minimum types Slice 03 needs:

- transcript item type matching `transcript_items`
- partial/final transcript event envelope types
- transcription delay update type
- normalized audio handoff contract if the ingest-to-worker handoff needs its own queue message or event shape

Exit check:

- worker, control API, and UI-facing events can depend on protocol-agnostic transcript types
- no transcript contract imports or exposes Shoutcast-specific fields

### 2. Transcription worker skeleton

Establish `services/transcribe-worker` with a minimal runnable package boundary:

- package manifest and TypeScript config
- worker entry point
- injected dependency boundaries for audio input, Transcribe client, transcript store, and event publisher

Exit check:

- the worker can start locally with stubbed dependencies and fail fast on invalid env

### 3. Low-latency audio handoff from ingest

Define how normalized audio reaches the worker in Slice 03.

Recommended v1 direction:

- treat the handoff as an internal worker-facing stream or queue contract built from `TNormalizedAudioFrame`
- keep the handoff boundary independent of the transport so the ingest gateway and worker can evolve separately

Exit check:

- one session's normalized frames can be delivered to the worker in order with station ID, session ID, and timing intact

### 4. Partial and final transcript handling

Implement worker logic to:

- forward audio to Amazon Transcribe Streaming
- handle partial results without persisting them as authoritative records
- convert final results into stable transcript item records
- preserve result IDs and item ordering for later reconciliation

Exit check:

- partial results can be emitted live
- final results are distinguishable, stable, and ready for persistence

### 5. Transcript persistence

Implement the `transcript_items` write path in DynamoDB:

- write by `session_id` and `started_at`
- persist absolute start/end times
- persist `start_offset_ms` and `end_offset_ms`
- preserve `is_partial`, `is_stable`, and confidence fields as appropriate

Exit check:

- finalized transcript items are queryable by session in chronological order
- timing fields are internally consistent with the live session clock

### 6. Transcript SSE events

Publish transcript updates using the existing SSE envelope:

- `transcript.partial`
- `transcript.final`
- `transcript.delay.updated`

Exit check:

- a subscriber can observe live transcript updates for one session without polling

### 7. Transcript delay tracking

Track operational delay from spoken audio to transcript availability:

- capture delay for partial results
- capture delay for finalized results
- surface the latest delay in a form the control surface can expose later

Exit check:

- operators can tell whether transcript lag is within an acceptable window for live use

## Proposed file targets

Expected first files to change for Slice 03:

- `packages/contracts/` for transcript item and event contracts
- `services/transcribe-worker/` for worker startup and transcript processing
- `services/control-api/` only if needed for SSE transcript event plumbing
- `docs/` for Slice 03 validation evidence and any worker setup notes

Expected files that should not change in Slice 03:

- `apps/web/` beyond type-sharing or event consumption placeholders
- export worker implementation
- ingest adapter protocol parsing

## Validation plan

Run the cheapest checks that can falsify the transcription hypothesis:

1. contract tests for transcript item validation and event envelopes
2. worker startup test with stubbed dependencies and invalid env handling
3. ordered handoff test proving normalized audio reaches the worker unchanged in timing-critical fields
4. partial-versus-final handling test proving only final transcript items persist authoritatively
5. transcript persistence test proving absolute times and offsets are written correctly
6. SSE event test proving transcript partial/final updates reach subscribers in the expected envelope
7. delay tracking test proving transcript lag is measurable and surfaced

If live audio and AWS credentials are available, finish with one end-to-end transcription proof using a simulated or real station source.

## Risks to resolve early

1. Low-latency handoff design can accidentally couple the worker too tightly to the ingest process lifecycle.
2. Amazon Transcribe partial/final semantics can cause duplicate or unstable item persistence if result reconciliation is weak.
3. Transcript timing can drift if item timestamps are derived from arrival time instead of the preserved session clock.
4. SSE fan-out can leak partial transcript churn to later UI state if event types are underspecified.
5. Delay metrics can become misleading if ingest delay and transcript delay are conflated.

## Stop condition interpretation

Slice 03 is done only when one live session can:

1. deliver normalized audio into the transcription worker
2. emit partial transcript updates within a few seconds of speech
3. persist finalized transcript items with correct absolute times and offsets
4. expose transcript updates over SSE for downstream consumers
5. surface transcript delay in an operationally visible way

## Immediate next coding step

Start with shared transcript contracts and a minimal transcribe-worker package boundary before integrating Amazon Transcribe Streaming. That locks the downstream transcript model before any provider-specific streaming code is introduced.