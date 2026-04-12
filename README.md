# Radio Clipper Planning Pack v3

This package is the corrected build-ready planning set for **Radio Clipper v1**.

## What changed in this revision

This revision fixes the main architecture errors from the edited pack and aligns the plan with your latest direction:

- **AWS Amplify Gen 2** is now the app foundation for frontend hosting, auth, backend outputs, and custom AWS resources
- **Amazon Cognito** is now the explicit auth layer through Amplify Auth
- **Shoutcast is the v1 ingest target**
- **Icecast and WebRTC are planned as future ingest adapters**
- **Archon** is now included as the development workflow layer for planning, implementation, validation, and review
- the runtime plan no longer assumes **SRT** as the primary ingest path

## Core decisions locked in this pack

| Decision | Choice |
|---|---|
| App platform | AWS Amplify Gen 2 |
| Auth | Cognito via Amplify Auth |
| Metadata store | DynamoDB |
| Audio and clip storage | S3 |
| Frontend | Angular |
| Primary station encoder | BUTT |
| v1 ingest protocol | Shoutcast |
| future ingest protocols | Icecast, WebRTC/WHIP |
| live transcript | Amazon Transcribe Streaming |
| live client updates | Server-Sent Events (SSE) |
| export queue | SQS + DLQ |
| long-running workers | ECS/Fargate custom resources |
| development workflow | Archon |

## Package contents

- `START-HERE.md`
- `REVIEW-NOTES.md`
- `ROADMAP.md`
- `PRODUCT-OVERVIEW.md`
- `ARCHITECTURE.md`
- `DATA-MODEL.md`
- `API-AND-EVENTS.md`
- `UI-SCREENS.md`
- `OPS-AND-SECURITY.md`
- `BUILD-SEQUENCE.md`
- `ARCHON-WORKFLOW.md`
- `docs/READ-THEN-BUILD.md`
- `docs/CODING-STYLE.md`
- `docs/SLICE-01-CHECKLIST.md`
- `docs/SLICE-02-IMPLEMENTATION-PLAN.md`
- `slices/`

## Working convention for scaffold code

Current scaffold work uses readable Hungarian notation for new code and keeps framework-facing names descriptive.

See [docs/CODING-STYLE.md](docs/CODING-STYLE.md).

## v1 outcome

At the end of the v1 slices, a producer can:

1. sign in with Cognito-backed auth
2. monitor a live station feed
3. read near-live captions and transcript text
4. highlight finalized transcript text
5. export an audio clip aligned to that selection
6. review the clip in a clip library

## Scope boundary

**Shoutcast first.**  
The codebase must be designed so that **Icecast** and **WebRTC/WHIP** can be added later without rewriting chunking, transcription, selection, or export logic.
