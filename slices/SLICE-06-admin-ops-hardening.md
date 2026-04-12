# Slice 06 — Admin, Ops, and Hardening

## Goal

Make the system supportable in production.

## Deliverables

- admin station health screens
- alarms and dashboards
- credential rotation flow
- role enforcement across endpoints
- retention policies
- failure investigation flow for export jobs
- deployment safeguards

## Design rules

- no manual production-only resources
- all critical paths must be observable
- credential changes must be auditable

## Stop condition

Operators can identify ingest, transcript, and export failures quickly. Credential rotation works. Production alarms exist for all critical paths.
