# Read Then Build

Use this order before writing implementation code.

## Read order

1. [START-HERE.md](/home/colt/Desktop/radio-clipper-v3/START-HERE.md)
2. [ROADMAP.md](/home/colt/Desktop/radio-clipper-v3/ROADMAP.md)
3. [slices/SLICE-01-foundation.md](/home/colt/Desktop/radio-clipper-v3/slices/SLICE-01-foundation.md)
4. [ARCHITECTURE.md](/home/colt/Desktop/radio-clipper-v3/ARCHITECTURE.md)
5. [ARCHON-WORKFLOW.md](/home/colt/Desktop/radio-clipper-v3/ARCHON-WORKFLOW.md)
6. [DATA-MODEL.md](/home/colt/Desktop/radio-clipper-v3/DATA-MODEL.md)
7. [API-AND-EVENTS.md](/home/colt/Desktop/radio-clipper-v3/API-AND-EVENTS.md)
8. [UI-SCREENS.md](/home/colt/Desktop/radio-clipper-v3/UI-SCREENS.md)
9. [docs/CODING-STYLE.md](/home/colt/Desktop/radio-clipper-v3/docs/CODING-STYLE.md)

## Build order

1. Scaffold `apps/web` as the Angular shell.
2. Scaffold `amplify` as the Amplify Gen 2 backend boundary.
3. Add shared package roots under `packages/`.
4. Add `.archon/workflows` slice workflow files.
5. Leave `services/` as placeholders until Slice 02 and later.

## Guardrails

- Do not start Shoutcast ingest in Slice 01.
- Do not add transcript or export logic in Slice 01.
- Keep the service directories protocol-agnostic.
- Preserve the rule that finalized transcript timing must map back to precise audio windows.
- Use readable Hungarian notation in scaffold code and examples.