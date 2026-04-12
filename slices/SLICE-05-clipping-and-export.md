# Slice 05 — Clipping and Export

## Goal

Resolve transcript selections into precise audio windows and export final clips.

## Deliverables

- clip job queue and worker
- chunk overlap lookup
- ffmpeg stitch and trim path
- final clip storage in S3
- clip library records in DynamoDB
- clip completion and failure events

## Design rules

- use overlap-safe chunk lookup
- add configurable pre-roll and post-roll
- clip jobs must be idempotent and retryable

## Stop condition

Selecting transcript text produces a correctly timed clip that is stored, replayable, and traceable to its source session.
