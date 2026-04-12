type TResourceBoundary = {
  sName: string;
  sPurpose: string;
  asPlannedCapabilities: string[];
};

export const aResourceBoundaries: TResourceBoundary[] = [
  {
    sName: 'dynamodb',
    sPurpose: 'metadata storage for stations, sessions, chunks, transcripts, jobs, and clips',
    asPlannedCapabilities: ['table definitions', 'key strategy', 'gsi planning'],
  },
  {
    sName: 's3',
    sPurpose: 'audio chunks, monitor assets, and final clip exports',
    asPlannedCapabilities: ['bucket layout', 'retention policy', 'access policy'],
  },
  {
    sName: 'ecs_fargate',
    sPurpose: 'long-running control, ingest, transcription, and export services',
    asPlannedCapabilities: ['service definitions', 'task sizing', 'environment wiring'],
  },
  {
    sName: 'sqs',
    sPurpose: 'clip export queue and dead-letter queue',
    asPlannedCapabilities: ['queue creation', 'retry policy', 'dlq routing'],
  },
  {
    sName: 'secrets_manager',
    sPurpose: 'station source credentials and service secrets',
    asPlannedCapabilities: ['secret storage', 'rotation hooks', 'least-privilege access'],
  },
  {
    sName: 'cloudwatch',
    sPurpose: 'logs, metrics, dashboards, and alarms',
    asPlannedCapabilities: ['structured logs', 'critical-path alarms', 'operator dashboards'],
  },
];

export const oCustomResourceBoundaries = {
  sOrchestrator: 'Amplify Gen 2 custom resources',
  aResourceBoundaries,
};