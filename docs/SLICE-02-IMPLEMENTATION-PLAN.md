# Slice 02 Implementation Plan

This plan translates [slices/SLICE-02-shoutcast-ingest.md](../slices/SLICE-02-shoutcast-ingest.md) into an implementation sequence that stays bounded to ingest.

## Goal

Prove that one station feed can enter AWS through the v1 Shoutcast path, be authenticated, create or resume a live session, and persist deterministic rolling audio chunks with correct metadata.

## Scope boundary

In scope:

- Shoutcast connection acceptance
- source credential validation
- `ShoutcastSourceAdapter`
- live session creation and heartbeat updates
- chunk segmentation and S3 archive writes
- chunk metadata persistence in DynamoDB
- current session health endpoint or equivalent ingest health surface
- operator setup note for BUTT

Out of scope:

- transcription worker integration beyond a normalized handoff contract
- producer UI changes
- clip export logic
- monitor player delivery
- future Icecast or WebRTC adapters

## Locked technical decisions

1. Downstream code must consume normalized internal audio, not Shoutcast-specific connection state.
2. Chunk timing must be deterministic and tied to absolute UTC plus session offset.
3. Credentials must be read from Secrets Manager references stored against the station record.
4. Session and chunk metadata must follow the table shapes in [DATA-MODEL.md](../DATA-MODEL.md).
5. Reconnects must update the same operational model without corrupting chunk timing.

## Implementation order

### 1. Shared ingest contracts

Create the minimum contracts needed for Slice 02 in `packages/contracts`:

- contribution adapter interface
- normalized audio frame type
- ingest session event types
- chunk metadata type
- station ingest configuration type

Exit check:

- the ingest gateway can depend on protocol-agnostic contracts
- no downstream contract assumes Shoutcast-specific fields

### 2. Station ingest configuration model

Define the station fields required at runtime from the `stations` table:

- `station_id`
- `primary_ingest_protocol`
- `ingest_endpoint`
- `credential_secret_arn`
- `status`
- `retention_days`

Exit check:

- one station config can be loaded and validated before accepting a source connection

### 3. `ShoutcastSourceAdapter`

Implement the v1 adapter in `services/ingest-gateway` with a protocol-specific edge and a protocol-agnostic output:

- accept connection
- validate source credential
- emit normalized audio frames
- emit session lifecycle events
- close cleanly on disconnect

Design constraint:

- the adapter may parse Shoutcast specifics internally, but its outputs must match the shared contracts only

Exit check:

- a simulated Shoutcast source can authenticate and produce normalized frames

### 4. Live session lifecycle

Implement session state handling against the `live_sessions` table:

- create session on first authenticated connection
- write `started_at`, `status`, `adapter_type`, `ingest_protocol`, and `ingest_node_id`
- update `last_heartbeat_at`
- increment `reconnect_count` on reconnect
- set `ended_at` and final `status` on terminal shutdown

Exit check:

- a connected source creates a visible live session record and reconnect updates are queryable

### 5. Chunk segmentation and archive path

Pick one fixed chunk window for v1 and keep it constant per deployment.

Recommended initial choice:

- 6 second chunks

Implementation requirements:

- segment normalized audio into fixed windows
- derive `chunk_started_at` and `chunk_ended_at` deterministically
- write chunk objects to S3
- compute `sequence_no`, `duration_ms`, `byte_size`, and `checksum`
- persist `audio_chunks` metadata after successful object write

Exit check:

- chunks appear in S3 with matching DynamoDB metadata and monotonic timing

### 6. Ingest health surface

Expose the minimum current-session status needed by later slices:

- current station online or offline state
- active `session_id`
- last heartbeat timestamp
- reconnect count
- current adapter and protocol
- latest chunk write result or lag indicator

Exit check:

- the control surface can answer whether ingest is healthy for one station

### 7. Operator setup note for BUTT

Produce a short operator-facing note that includes:

- server type `Shoutcast`
- endpoint or host details
- source credential handling
- expected codec or format
- reconnect expectations

Exit check:

- a station operator has enough information to connect a real or simulated source

## Proposed file targets

Expected first files to change for Slice 02:

- `packages/contracts/` for ingest and chunk contracts
- `services/ingest-gateway/` for adapter, connection handling, and chunk pipeline
- `amplify/` for ingest-related resource placeholders or outputs only if Slice 02 needs them
- `docs/` for operator setup note and validation evidence

Expected files that should not change in Slice 02:

- `apps/web/` beyond type-sharing or environment output consumption
- export worker code
- transcription worker implementation

## Validation plan

Run the cheapest checks that can falsify the ingest hypothesis:

1. unit or integration test for source credential validation
2. simulated source connection test for session creation
3. reconnect test proving `reconnect_count` and heartbeat updates
4. chunking test proving deterministic windows and monotonic `sequence_no`
5. archive test proving S3 object write plus DynamoDB metadata write
6. health endpoint test for active session status

If a real station feed is available, finish with one end-to-end ingest proof using BUTT.

## Risks to resolve early

1. Shoutcast metadata and audio framing may not align cleanly with the normalized frame boundary.
2. Reconnect handling can accidentally create duplicate live sessions if session identity rules are weak.
3. Chunk writes can drift if the chunk clock is tied to arrival time instead of preserved session timing.
4. Persisting metadata before object write completion can leave false-positive chunk rows.
5. Hard-coding Shoutcast fields into shared contracts will make Slice 07 more expensive.

## Stop condition interpretation

Slice 02 is done only when one real or simulated station source can:

1. authenticate successfully
2. stay connected long enough to produce multiple chunks
3. reconnect after interruption without corrupting session tracking
4. produce correct chunk metadata in DynamoDB
5. expose current ingest health through the control surface

## Immediate next coding step

Start with shared ingest contracts and the session lifecycle shape before implementing the socket edge. That is the smallest step that locks the adapter boundary and gives later ingest code a defensible target.