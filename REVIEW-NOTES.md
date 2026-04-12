# Review Notes

This file documents what was corrected from the edited pack.

## Main corrections

### 1. Primary ingest protocol corrected

The edited pack treated **SRT** as the primary ingest path. That no longer matches the product direction.

Corrected plan:
- v1 starts with **Shoutcast**
- future integrations include **Icecast** and **WebRTC/WHIP**
- all downstream services work against a normalized internal audio stream, not against one hard-coded ingress protocol

### 2. Platform foundation corrected

The edited pack used plain CDK as the top-level platform model.

Corrected plan:
- **Amplify Gen 2** is the top-level app and backend framework
- auth, frontend hosting, outputs, and environment management live under Amplify
- ECS, DynamoDB, S3, SQS, CloudWatch, and any custom networking are provisioned from Amplify Gen 2 custom resources

### 3. Auth direction clarified

The edited pack referenced Cognito, but not as part of a clear platform flow.

Corrected plan:
- **Amplify Auth** provisions and manages **Cognito**
- role groups:
  - `producer`
  - `admin`
  - `platform_admin`
- the Angular app uses Amplify Auth for sign-in and token handling
- backend services validate Cognito JWTs

### 4. Archon added in the correct place

Archon is not part of runtime media processing.

Corrected plan:
- Archon is used as the **development workflow engine**
- it enforces:
  - slice planning
  - bounded implementation
  - validation
  - review
  - release readiness

### 5. Ingest design boundary improved

The edited pack tied ingest, transcription, and monitor assumptions too tightly together.

Corrected plan:
- build an **ingest adapter boundary**
- adapters:
  - `ShoutcastSourceAdapter` in v1
  - `IcecastSourceAdapter` later
  - `WhipWebRtcAdapter` later
- chunking, transcript timing, clip export, and UI do not depend on which adapter delivered the source

## What stayed the same

These parts were directionally correct and remain:

- DynamoDB for metadata
- S3 for audio objects and final clips
- Amazon Transcribe Streaming for near-live captions
- transcript-first clip creation
- SSE for server-to-client live updates
- Fargate workers for long-running processing
