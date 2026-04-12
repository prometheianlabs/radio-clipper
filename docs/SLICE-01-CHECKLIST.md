# Slice 01 Checklist

This checklist translates [slices/SLICE-01-foundation.md](../slices/SLICE-01-foundation.md) into concrete startup work.

## Goal

Stand up the repo skeleton, Angular shell, Amplify Gen 2 backend skeleton, shared packages, and workflow boundaries without leaking into Slice 02.

## Scope for this slice

- create the top-level repo shape
- establish Angular app shell path at `apps/web`
- establish Amplify Gen 2 backend path at `amplify`
- establish shared packages at `packages/contracts` and `packages/config`
- create service directories for future slices without implementing runtime behavior
- document Cognito group direction for `producer`, `admin`, and `platform_admin`
- document Archon slice workflow boundaries
- document the readable Hungarian notation rule for scaffold code

## Do now

1. Confirm the repo contains only planning docs and no existing app scaffold.
2. Create the top-level directories defined in [START-HERE.md](../START-HERE.md).
3. Add placeholder files so each new directory has an obvious purpose.
4. Create a minimal Angular workspace plan for `apps/web`.
5. Create a minimal Amplify Gen 2 backend plan for `amplify`.
6. Define shared contracts and config package responsibilities.
7. Define the `.archon/workflows` files that will gate later slice work.
8. Record the coding-style rule used by the scaffold code.
9. Record the stop condition and what counts as validation.

## Explicitly defer

- Shoutcast ingest implementation
- transcript pipeline code
- live desk UI behavior beyond auth shell intent
- clip export logic
- station credential rotation flow

## Suggested first implementation order

1. `apps/web`
2. `amplify`
3. `packages/contracts`
4. `packages/config`
5. `.archon/workflows`
6. empty service placeholders under `services/`

## Validation for this slice

Use these checks before claiming Slice 01 done:

1. The repo shape matches the directories in [slices/SLICE-01-foundation.md](../slices/SLICE-01-foundation.md).
2. The Angular app shell path exists and has a documented startup target.
3. The Amplify backend path exists and has a documented purpose.
4. Shared package boundaries are written down.
5. Archon workflow boundaries are written down.
6. No files contain Slice 02 ingest behavior.

## Stop condition

This slice is ready to implement further when the workspace has the agreed directory skeleton, clear ownership notes for each area, and a bounded plan for the first real code generation pass.

## Completion record

**Status: DONE — 2026-04-12**

Validation checks passed:

1. Repo shape matches `slices/SLICE-01-foundation.md` — all top-level directories exist.
2. Angular app shell at `apps/web` with routes, auth guards, and three page components.
3. Amplify Gen 2 backend at `amplify/` with auth resource plan and custom resource boundaries.
4. Shared package roots at `packages/contracts` and `packages/config` with documented responsibilities.
5. Archon workflow files at `.archon/workflows/` (plan, implement, validate, review).
6. No Slice 02 ingest behavior present in any file.

Slice 02 implementation plan approved and recorded at `docs/SLICE-02-IMPLEMENTATION-PLAN.md`.