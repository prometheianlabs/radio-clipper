# Releasing

## Release model

This repository is still planning-first. It does not have an automated deploy path or a production runtime yet, so a "release" currently means publishing an updated planning baseline on `main`.

## Required checks before merge

- Confirm the README, roadmap, and implementation slices still describe the same product direction.
- Keep architecture, data-model, and API/event-contract documents aligned when one of those areas changes.
- Call out any assumption changes that would affect the future build order, hosting model, or ingest path.

## Release path

1. Merge the approved documentation or planning change to `main`.
2. Confirm the top-level docs still point at the current canonical plan.
3. Treat the merged commit as the current planning baseline until the implementation repo or runtime workflows exist.

## Revisit trigger

Replace this document with a deploy-oriented release process as soon as the repo gains real application code, CI gates, or environment promotion workflows.
