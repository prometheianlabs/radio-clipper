# Slice 03 — Live Transcription

## Goal

Generate near-live transcript text from the normalized live audio feed and persist finalized timing data.

## Deliverables

- transcription worker
- low-latency audio handoff from ingest
- partial and final transcript handling
- transcript persistence in DynamoDB
- transcript events over SSE
- transcript delay tracking

## Design rules

- partial text is display-only
- finalized items are the authoritative clipping basis
- transcript storage must preserve absolute time and session offset

## Stop condition

A producer can watch transcript text update within a few seconds of speech. Finalized transcript items are persisted with correct timing and are queryable by session.
