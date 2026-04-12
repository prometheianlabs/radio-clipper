# Coding Style

## Current project convention

Use readable Hungarian notation in code that is authored during this build-out.

Examples:

- `sName` for strings
- `nRetryCount` for numbers
- `bIsSignedIn` for booleans
- `oSession` for objects
- `aStations` for arrays
- `fnSignIn` for functions and methods when that improves clarity

## Readability rule

Notation is meant to clarify data shape, not obscure intent.

- prefer full words after the prefix
- keep Angular class names framework-normal and descriptive
- avoid one-letter names except in trivial template scopes
- do not use notation to justify long or noisy identifiers

## Scope

Apply this convention to:

- scaffold code in `apps/web`
- backend skeleton code in `amplify`
- shared package starter code added later

Keep documentation and examples aligned with the same naming approach.