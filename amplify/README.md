# amplify

Amplify Gen 2 backend root.

Slice 01 intent:

- define backend entry points and outputs
- define Amplify Auth and Cognito group direction
- reserve custom resource boundaries for DynamoDB, S3, ECS, SQS, Secrets Manager, and CloudWatch

## Current scaffold files

- `backend.ts` holds the top-level backend planning object
- `auth/resource.ts` records the Cognito group direction
- `custom-resources/resource-boundaries.ts` records custom resource boundaries
- `outputs.ts` records frontend output expectations

## Coding style

Use readable Hungarian notation in scaffold code here as documented in [docs/CODING-STYLE.md](/home/colt/Desktop/radio-clipper-v3/docs/CODING-STYLE.md).