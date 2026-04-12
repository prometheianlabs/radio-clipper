# Roadmap

## Objective

Build a near-live radio production system that ingests audio from a station-side encoder, processes it in AWS, generates live transcript text and captions, and lets producers export clips by selecting transcript text.

## Platform direction

### App platform

- AWS Amplify Gen 2
- Cognito through Amplify Auth
- Angular frontend hosted on Amplify Hosting

### Runtime services

- ECS/Fargate for long-running workers
- DynamoDB for metadata
- S3 for rolling chunks, monitor stream assets, and final clips
- SQS for export jobs
- CloudWatch for logs, metrics, and alarms

## Phase 0 — foundation

Goal:
- establish repo structure, Amplify foundation, auth model, and workflow discipline

Deliverables:
- Angular app shell
- Amplify Gen 2 backend skeleton
- Cognito groups
- DynamoDB table plan
- S3 bucket plan
- Archon workflow plan
- environment naming and deployment rules

Exit condition:
- team agrees on architecture
- repo installs and builds
- Amplify sandbox and branch environments are understood

## Phase 1 — Shoutcast ingest

Goal:
- prove one station feed can reliably enter AWS and be normalized into the internal audio pipeline

Deliverables:
- station encoder configuration guide
- v1 Shoutcast ingest gateway
- session creation and heartbeat tracking
- rolling chunk archive
- live session visibility

Exit condition:
- one station can connect and stay connected
- ingest reconnect behavior is verified
- chunk metadata is correct and queryable

## Phase 2 — near-live transcription

Goal:
- generate transcript text within a few seconds and persist timing data that can drive clipping

Deliverables:
- transcription worker
- partial/final transcript handling
- transcript persistence
- live transcript event stream to UI

Exit condition:
- producers can watch live captions
- finalized items have usable timing
- transcript delay is operationally visible

## Phase 3 — producer workflow

Goal:
- deliver a usable Angular live desk

Deliverables:
- live monitor player
- rolling transcript panel
- stable transcript selection model
- clip request flow
- clip job status

Exit condition:
- a producer can follow the show and create a clip from one screen

## Phase 4 — clip rendering

Goal:
- export repeatable and correctly timed clips from transcript selection

Deliverables:
- selection-to-time mapping
- chunk overlap lookup
- ffmpeg render path
- final clip storage
- clip library

Exit condition:
- clip exports are correct, repeatable, and supportable

## Phase 5 — hardening

Goal:
- make the system supportable in production

Deliverables:
- station health views
- alarms and dashboards
- audit logging
- role boundaries
- stream key rotation
- retention rules
- deployment safeguards

Exit condition:
- failures are visible
- support staff can diagnose issues quickly
- the system can run continuously

## Planned future integrations

These are planned but not launch blockers:

- **Icecast contribution adapter**
- **WebRTC/WHIP contribution adapter**
- lower-latency monitor audio path
- speaker/channel-aware transcription where source audio allows it
- custom vocabulary management per station
- CMS and newsroom integrations
