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
  workflows/
    plan-slice.yaml
    implement-slice.yaml
    validate-slice.yaml
    review-slice.yaml
```

## Workflow rules

### Rule 1

Each workflow must target one slice only.

### Rule 2

A workflow must read these files before implementation:

- `README.md`
- `START-HERE.md`
- `ROADMAP.md`
- current slice file
- any directly referenced architecture doc

### Rule 3

Implementation workflows must refuse to touch future slices.

### Rule 4

Validation workflows must run the slice stop condition and record evidence.

### Rule 5

Review workflows must produce:

- what changed
- what risks remain
- what should be deferred
- whether the slice is actually done

## Suggested slice workflow pattern

### 1. Plan

Inputs:
- current slice
- architecture docs
- repo state

Output:
- written implementation plan
- risks
- files expected to change

### 2. Implement

Inputs:
- approved plan

Output:
- bounded code changes for the current slice only

### 3. Validate

Inputs:
- changed code

Output:
- build/test/run evidence
- stop condition result

### 4. Review

Inputs:
- implementation and validation results

Output:
- findings
- cleanup list
- done/not-done decision

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
