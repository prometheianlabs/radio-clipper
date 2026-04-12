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

1. scaffold Angular app shell
2. scaffold Amplify Gen 2 backend shell
3. add shared package starter files
4. add Archon workflow files