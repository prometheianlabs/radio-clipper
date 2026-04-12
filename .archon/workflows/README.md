# .archon/workflows

Archon workflow files for slice-bounded planning and delivery live here.

Current workflow set:

- `plan-slice.yaml`
- `implement-slice.yaml`
- `validate-slice.yaml`
- `review-slice.yaml`

## Workflow node contract

Each workflow uses the same three-stage pattern:

1. `scope` node selects exactly one slice and declares boundary intent.
2. `gather-context` node reads core docs plus selected slice and supporting references.
3. action node (`plan`, `implement`, `validate`, `review`) produces bounded output for that stage only.

## Artifact expectations

- workflow YAML files are versioned source of truth
- `.archon/config.yaml` stores local worktree defaults
- `.archon/logs/*.jsonl` are generated run logs and should remain untracked
