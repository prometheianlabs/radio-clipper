# Slice 01 — Foundation

## Goal

Stand up the repo, Angular app shell, Amplify Gen 2 backend skeleton, Cognito auth direction, shared contracts, and Archon workflow discipline.

## Deliverables

- Angular web shell
- Amplify Gen 2 backend folder
- Amplify Auth with Cognito group plan
- custom resource placeholders for DynamoDB, S3, ECS, SQS
- shared contracts package
- Archon workflow docs or files
- environment config strategy
- basic authenticated route shell

## Repository shape

- `apps/web`
- `amplify/`
- `services/control-api`
- `services/ingest-gateway`
- `services/transcribe-worker`
- `services/export-worker`
- `packages/contracts`
- `packages/config`
- `.archon/`
- `docs/`

## Infrastructure work

Define the backend foundation:

- Amplify app backend
- auth resource
- environment outputs
- custom resource boundary for:
  - DynamoDB
  - S3
  - ECS/Fargate
  - SQS
  - Secrets Manager
  - CloudWatch

## Auth direction

Use Cognito groups:

- `producer`
- `admin`
- `platform_admin`

The Angular app should be prepared for:
- sign-in
- sign-out
- guarded routes
- current-user role inspection

## Stop condition

The repo installs and builds.  
The Angular app runs locally.  
The Amplify backend skeleton exists.  
The auth direction is wired in documentation and scaffold code.  
Archon workflow boundaries are documented.
