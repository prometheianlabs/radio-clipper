// Public surface of @radio-clipper/contracts.
// Only Slice 02 ingest types are exported here. Transcript, clip, and admin types are deferred.

export type {
  TIngestProtocol,
  TStationStatus,
  TEncoderType,
  TStationIngestConfig,
} from './station.js';

export type {
  TChunkCodec,
  TAudioChunkMetadata,
} from './ingest/chunk.js';

export type {
  TSessionStatus,
  TLiveSession,
  TSessionCreatedEvent,
  TSessionHeartbeatEvent,
  TSessionReconnectedEvent,
  TSessionEndedEvent,
  TSessionLifecycleEvent,
} from './ingest/session.js';

export type {
  TNormalizedAudioFrame,
  IContributionAdapter,
} from './ingest/adapter.js';
