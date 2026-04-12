# Architecture

## High-level design

Radio Clipper is split into:

1. **station-side contribution**
2. **AWS ingest and normalization**
3. **rolling archive and transcription**
4. **authenticated producer workflow**
5. **clip export and operations**

## Top-level platform model

### Amplify Gen 2 responsibilities

Amplify Gen 2 is the top-level platform foundation.

Use Amplify Gen 2 for:

- Angular app hosting
- Cognito auth through Amplify Auth
- environment outputs to the frontend
- deployment workflows for app environments
- custom resource orchestration for the rest of the AWS stack

### Custom resources under Amplify

Provision these from Amplify Gen 2 custom resources:

- DynamoDB tables
- S3 buckets
- ECS/Fargate services
- SQS queues
- CloudWatch dashboards and alarms
- optional CloudFront distribution for monitor media delivery
- Secrets Manager secrets for station stream credentials

## Station-side encoder

Use **BUTT** as the recommended station-side encoder.

Reasons:

- GUI-based and simple for station staff
- supports **Shoutcast**, **Icecast**, and **WebRTC/WHIP**
- cross-platform
- supports line input from studio/program audio

### v1 contribution protocol

**Shoutcast** is the launch protocol.

### Future contribution protocols

Design now for these later adapters:

- **Icecast**
- **WebRTC/WHIP**

## Ingest adapter boundary

Do not build the rest of the system around one protocol.

Define an internal interface such as:

- `ContributionAdapter`
  - `acceptConnection()`
  - `authenticateSource()`
  - `emitNormalizedAudioFrames()`
  - `emitSessionEvents()`
  - `closeSession()`

Implementations:

- `ShoutcastSourceAdapter` — required in v1
- `IcecastSourceAdapter` — planned
- `WhipWebRtcAdapter` — planned

Everything downstream consumes normalized internal audio, not protocol-specific state.

## Recommended component layout

### 1. Angular web app

Hosted on Amplify Hosting.

Responsibilities:

- sign-in and auth flow
- producer live desk
- admin views
- clip library
- role-based route guarding

### 2. Control API

Runs as a long-lived service.

Responsibilities:

- authenticated REST endpoints
- SSE live event channel
- station metadata reads
- clip request handling
- admin operations

### 3. Ingest gateway

Runs as a long-lived service.

Responsibilities:

- accept station-side contribution sessions
- authenticate station credentials
- create and update ingest sessions
- normalize audio into the internal processing path
- emit connection and heartbeat events

### 4. Chunk/archive path

Responsibilities:

- segment audio into fixed windows
- write chunk objects to S3
- persist chunk metadata to DynamoDB
- maintain the monitor stream assets

### 5. Transcription worker

Responsibilities:

- consume normalized live audio
- decode to the format required for Amazon Transcribe Streaming
- handle partial and final transcript results
- persist finalized transcript items
- publish transcript events to the UI

### 6. Export worker

Responsibilities:

- consume clip jobs from SQS
- resolve transcript selection to absolute times
- find overlapping chunks
- stitch and trim with ffmpeg
- write final clips to S3
- publish clip status updates

## Live monitor audio path

Keep the monitor path separate from transcription.

Recommended approach for v1:

- create short rolling monitor assets from the chunk/archive path
- serve monitor audio to the Angular app with normal authenticated media delivery
- accept a modest delay in the monitor player for v1

This keeps the transcript-driven clipping path correct even if the player lags behind live.

## Live event channel

Use **SSE** for server-to-client live updates.

Event categories:

- stream state
- transcript partial/final updates
- clip job updates
- admin health status

Why:
- server-to-client only
- simpler reconnect semantics
- easier operational debugging than a full duplex socket layer for v1

## AWS service shape

- **Amplify Hosting** — Angular frontend
- **Amplify Auth / Cognito** — identity and JWT issuance
- **ECS/Fargate** — control API, ingest gateway, transcription worker, export worker
- **DynamoDB** — metadata and state
- **S3** — chunk audio, monitor assets, final clips
- **SQS + DLQ** — export job queue
- **CloudWatch** — logs, metrics, alarms
- **Secrets Manager** — stream credentials and service secrets
- **Amazon Transcribe Streaming** — near-live transcript generation

## Time model

Every live session must preserve:

- station ID
- ingest adapter type
- session ID
- session start UTC
- chunk sequence and absolute time window
- transcript token timing
- clip request timing
- final export timing

## Failure handling

The system must expect:

- source disconnects and reconnects
- ingest adapter restarts
- transcript lag spikes
- chunk write failures
- export job failures
- credential rotation events

## Architecture rule

If a future protocol change from Shoutcast to Icecast or WebRTC would force a rewrite of chunking, transcription, or clip export, the ingest layer was designed incorrectly.
