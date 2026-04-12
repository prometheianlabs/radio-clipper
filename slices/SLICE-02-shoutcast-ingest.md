# Slice 02 — Shoutcast Ingest

## Goal

Receive the live station feed in AWS through the **v1 Shoutcast path**, authenticate the source, create a live session, and persist rolling timestamped audio chunks.

## Deliverables

- ingest gateway service
- `ShoutcastSourceAdapter`
- station credential validation
- live session creation and heartbeat updates
- chunk archive path to S3
- chunk metadata in DynamoDB
- current session health endpoint

## Design rules

- do not hard-code Shoutcast assumptions into downstream services
- normalized internal audio frames are the handoff boundary
- keep ingest session and chunk timing deterministic

## Station configuration output

This slice must produce a clear operator setup note for BUTT:

- server type: Shoutcast
- mount/connection details
- source credential
- expected audio format
- reconnect expectations

## Stop condition

One real or simulated station source can connect through the Shoutcast path, stay online, reconnect after interruption, and produce correct chunk metadata in DynamoDB.
