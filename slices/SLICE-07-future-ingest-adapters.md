# Slice 07 — Future Ingest Adapters

## Goal

Add future contribution protocols without rewriting downstream media logic.

## Scope

This slice is **post-v1**.

## Deliverables

- `IcecastSourceAdapter`
- `WhipWebRtcAdapter`
- protocol-specific station configuration docs
- parity tests proving that downstream session, chunk, transcript, and clip behavior still works

## Design rules

- do not fork chunking, transcript persistence, or export logic per protocol
- adapter outputs must conform to the same normalized internal audio contract
- UI and clip workflows must remain protocol-agnostic

## Stop condition

Icecast and/or WebRTC sources can be added while the rest of the system continues to behave the same way from the producer’s perspective.
