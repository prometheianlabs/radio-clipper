# Product Overview

## Product statement

Radio Clipper is a near-live radio production tool that ingests the program feed from a station studio, streams it into AWS, generates near-live transcript text and captions, and lets producers export an audio clip by selecting transcript text from the live transcript.

## Primary users

### Producers

Need to:

- monitor the live show
- follow captions and transcript text
- highlight the exact words they want
- export a usable clip quickly

### Station operators

Need to:

- keep ingest online
- confirm encoder health
- verify transcript lag stays inside acceptable bounds
- rotate stream credentials and manage station settings

### Platform admins

Need to:

- manage environments and policies
- monitor service health
- inspect failed export jobs
- control retention, alerts, and access boundaries

## Core workflow

1. A station feed is connected to a station-side encoder machine.
2. BUTT sends the audio to the AWS ingest gateway using **Shoutcast** in v1.
3. The ingest gateway normalizes the contribution stream into the internal audio pipeline.
4. Chunking writes rolling audio objects to S3 and metadata to DynamoDB.
5. The transcription worker feeds low-latency audio to Amazon Transcribe Streaming.
6. Partial and final transcript items are delivered to the Angular web app.
7. Final transcript items are persisted with timing data.
8. A producer highlights finalized transcript text.
9. The backend resolves that selection to an exact audio window.
10. The export worker stitches the overlapping chunks and writes the final clip to S3.
11. The clip is available in the clip library.

## Core v1 capabilities

- Cognito-backed authentication
- near-live transcript and captions
- rolling audio retention
- transcript selection
- clip export
- clip history and replay
- station health and ingest visibility

## V1 non-goals

- replacing a radio automation system
- public consumer streaming product
- automated clipping by topic or ad break
- editorial AI summaries
- multi-language translation
- deep audio editing timeline

## Product rules

### Rule 1: timestamps are first-class data

Every finalized transcript token must map back to the recorded audio window that produced it.

### Rule 2: reconnects are normal

The contribution path will disconnect sometimes. The system must recover without corrupting transcript alignment.

### Rule 3: ingest is modular

The system must be designed so that the ingest adapter can change without breaking chunking, transcription, clip export, or the producer UI.

### Rule 4: metadata and media are separate concerns

- DynamoDB stores metadata and operational state
- S3 stores chunk audio and exported clips

### Rule 5: live readability matters

The UI must visually distinguish unstable partial text from finalized selectable text.
