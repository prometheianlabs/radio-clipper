# Radio Clipper

Cloud-native radio clipping platform planning repository for ingesting live station audio, generating near-live transcripts, and exporting producer-ready audio clips.

## Status

This repository currently serves as the planning and architecture pack for the first implementation. It documents the product direction, system design, data model, API/event contracts, UI slices, and build sequence for a v1 release.

## V1 goals

- Monitor a live station feed
- Review near-live transcript text
- Select finalized transcript ranges
- Export aligned audio clips
- Manage a searchable clip library

## Planned stack

- AWS Amplify Gen 2
- Angular
- Amazon Cognito
- Amazon Transcribe Streaming
- DynamoDB
- S3
- SQS

## Scope

Radio Clipper is currently scoped around a Shoutcast-first ingest path, with Icecast and WebRTC/WHIP reserved for future adapters.

## Repository contents

- Product overview and roadmap
- Architecture and operations notes
- Data model and API/event contracts
- UI screen planning
- Slice-by-slice implementation plan

## Notes

This is a planning-first repository rather than a finished production application. The current documents are intended to support implementation, validation, and future build-out.

## Release and versioning

- There is no production deployment workflow yet; changes to `main` currently update the planning baseline, not a live product.
- Treat merged planning changes as documentation releases that should keep the roadmap, architecture, and implementation slices aligned.
- The current release policy for this planning phase lives in [RELEASING.md](RELEASING.md).
