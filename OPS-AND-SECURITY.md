# Operations and Security

## Operational priorities

Main operational risks:

- station contribution disconnects
- ingest adapter failures
- transcript lag
- transcript/audio misalignment
- export worker failures
- invisible failures without alerting

## Logging

Every service must emit structured logs with:

- station ID
- session ID
- service name
- event type
- severity
- timestamp
- correlation ID

Ship logs to CloudWatch Logs.

## Metrics

### Ingest

- active sessions
- disconnect count
- reconnect count
- adapter auth failures
- chunk write success rate

### Transcription

- transcript delay
- partial result rate
- final result rate
- transcription error count

### Exports

- queue depth
- export duration
- export success rate
- retry count
- DLQ count

## Alerts

Create alarms for:

- missing station heartbeat
- repeated auth failures
- chunk archive failures
- transcript delay above threshold
- export failure spike
- DLQ count above zero
- worker task exit

## Auth and authorization

### Identity

Use **Amplify Auth powered by Cognito**.

### Roles

- `producer`
- `admin`
- `platform_admin`

### Access rules

- producers can monitor assigned stations and create clips
- admins can manage station settings and health
- platform admins can access all stations, environments, and diagnostics

## Station credentials

Each station receives a source credential used by the ingest gateway.

Rules:

- never store raw source credentials in DynamoDB
- store credential values in Secrets Manager
- store only secret references and metadata in DynamoDB
- support admin-triggered credential rotation
- log all credential rotation events

## Infrastructure model

Amplify Gen 2 is the top-level backend definition.

Under Amplify custom resources, define:

- DynamoDB tables
- S3 buckets
- ECS/Fargate services
- SQS queues
- CloudWatch alarms
- Secrets Manager secrets

No production-only manual resources.

## Cost model direction

The highest cost driver is expected to be **Amazon Transcribe Streaming**.

Secondary costs:

- Fargate services
- S3 storage and requests
- DynamoDB
- Amplify Hosting
- CloudWatch
- SQS

## Retention

Define retention for:

- rolling chunks
- monitor assets
- final clips
- logs
- audit events

## Production hardening checklist

- health endpoints for all long-running services
- DLQ configured for export jobs
- alarms for all critical paths
- startup config validation
- authenticated admin operations only
- branch environment rules for Amplify deployments
- least-privilege IAM
- no hard-coded secrets
