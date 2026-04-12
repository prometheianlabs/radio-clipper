# Archon Workflow Plan

## Why Archon is in this project

Archon is not part of runtime media processing.  
It is the workflow engine used to keep AI-assisted development deterministic and slice-bounded.

Use Archon to enforce:

- planning before implementation
- one-slice-at-a-time execution
- validation gates
- review gates
- release notes per slice

## Recommended Archon structure

```text
.archon/
  config.yaml
  logs/                 # generated run logs, not source of truth
  workflows/
    plan-slice.yaml
    implement-slice.yaml
    validate-slice.yaml
    review-slice.yaml
```

## Workflow contract

### Rule 1

Each workflow must target one slice only.

### Rule 2

A workflow must begin by scoping to exactly one slice from `slices/`.

### Rule 3

After scoping, context gathering must include:

- `README.md`
- `START-HERE.md`
- `ROADMAP.md`
- `ARCHON-WORKFLOW.md`
- selected slice file
- any directly referenced architecture docs

### Rule 4

Implementation workflows must refuse to touch future slices.

### Rule 5

Validation workflows must run the slice stop condition and record evidence.

### Rule 6

Review workflows must produce:

- what changed
- what risks remain
- what should be deferred
- whether the slice is actually done

## Suggested node pattern

Each workflow YAML should keep this structure:

1. `scope` node chooses one slice and states boundaries.
2. `gather-context` node reads repo files needed for that slice.
3. A single action node (`plan`, `implement`, `validate`, or `review`) performs bounded work.

## Suggested slice workflow sequence

### 1. Plan (`plan-slice.yaml`)

Outputs:
- written implementation plan
- risks and deferrals
- validation targets
- stop condition interpretation

### 2. Implement (`implement-slice.yaml`)

Outputs:
- bounded code changes for the current slice only
- assumptions list
- handoff to validation

### 3. Validate (`validate-slice.yaml`)

Outputs:
- executed checks
- validation evidence
- stop condition status

### 4. Review (`review-slice.yaml`)

Outputs:
- findings
- remaining risks
- cleanup list
- done/not-done decision

## Artifact hygiene

Track:
- `.archon/workflows/*.yaml`
- `.archon/config.yaml`
- slice plans and checklists in `docs/`

Do not track:
- `.archon/logs/*.jsonl` generated runtime logs

## Repo discipline

Do not let Archon run broad "improve everything" workflows on this repo.

Good:
- implement slice 02 ingest gateway only
- validate slice 03 transcript timing persistence
- review slice 05 export correctness

Bad:
- refactor whole backend
- optimize all services
- redesign UI and workers together

## Archon success condition

If you can swap models or rerun workflows and still get the same slice boundaries, validation path, and completion logic, then Archon is being used correctly.
