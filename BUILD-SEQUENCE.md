# Build Sequence

## Step 1 — foundation

Create the Angular shell, Amplify Gen 2 backend skeleton, Cognito groups, custom resource boundaries, and Archon workflow files.

## Step 2 — one working Shoutcast ingest path

Before transcript or clipping work, prove that one station feed can enter AWS through the v1 Shoutcast path and be archived with correct timestamps.

## Step 3 — near-live transcript

Add the transcription worker and persist transcript timing metadata.

## Step 4 — producer live desk

Build the Angular UI that lets producers monitor the feed, follow transcript text, and create a clip request.

## Step 5 — clip export engine

Build the chunk overlap query, ffmpeg export path, and clip storage flow.

## Step 6 — supportability

Add diagnostics, alarms, role checks, credential rotation, and admin surfaces.

## Step 7 — future ingest adapters

Only after v1 is stable, add the next contribution adapters:

- Icecast
- WebRTC/WHIP

## Why this order matters

If ingest timing is wrong, transcript-aligned clipping is wrong.  
If transcript timing is wrong, the UI feels unreliable.  
If adapter boundaries are weak, future protocol support becomes expensive.  
If ops work is delayed too long, failures become hard to diagnose.
