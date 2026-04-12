# Memory

## Current state

- planning pack reviewed on 2026-04-12
- repo started as docs-only workspace
- Slice 01 is the agreed starting point

## Locked decisions

- Angular frontend lives in `apps/web`
- Amplify Gen 2 is the top-level backend foundation
- Cognito groups are `producer`, `admin`, and `platform_admin`
- v1 ingest starts with Shoutcast in a later slice
- service boundaries stay protocol-agnostic
- scaffold code uses readable Hungarian notation

## Near-term next steps

1. implement shared ingest contracts for Slice 02
2. implement Shoutcast session lifecycle and heartbeat handling
3. implement chunk archive and metadata persistence
4. produce BUTT operator setup note and validation evidence