// Live session record and lifecycle events — mirrors the `live_sessions` DynamoDB table.
// A session begins on the first authenticated source connection and ends on terminal shutdown.
// Reconnects increment reconnect_count but do not create a new session.

import type { TIngestProtocol } from '../station.js';

export type TSessionStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'ended'
  | 'failed';

export type TLiveSession = {
  sSessionId: string;
  sStationId: string;
  sIngestProtocol: TIngestProtocol;
  /** String identifier for the adapter implementation, e.g. "ShoutcastSourceAdapter". */
  sAdapterType: string;
  /** ISO 8601 UTC. Set when session is created; never updated. */
  sStartedAt: string;
  /** ISO 8601 UTC. Null until the session reaches a terminal state. */
  sEndedAt: string | null;
  eStatus: TSessionStatus;
  /** ISO 8601 UTC. Updated on every heartbeat tick. */
  sLastHeartbeatAt: string;
  nMonitorDelayMs: number;
  nTranscriptionDelayMs: number;
  nReconnectCount: number;
  /** Identifier for the ingest gateway node that owns this session. */
  sIngestNodeId: string;
};

// Session lifecycle events emitted by the adapter and processed by the session manager.

export type TSessionCreatedEvent = {
  eType: 'session.created';
  sSessionId: string;
  sStationId: string;
  sStartedAt: string;
  sAdapterType: string;
  sIngestProtocol: TIngestProtocol;
  sIngestNodeId: string;
};

export type TSessionHeartbeatEvent = {
  eType: 'session.heartbeat';
  sSessionId: string;
  sStationId: string;
  sOccurredAt: string;
};

export type TSessionReconnectedEvent = {
  eType: 'session.reconnected';
  sSessionId: string;
  sStationId: string;
  nReconnectCount: number;
  sOccurredAt: string;
};

export type TSessionEndedEvent = {
  eType: 'session.ended';
  sSessionId: string;
  sStationId: string;
  sEndedAt: string;
  eReason: 'clean_disconnect' | 'timeout' | 'error';
};

export type TSessionLifecycleEvent =
  | TSessionCreatedEvent
  | TSessionHeartbeatEvent
  | TSessionReconnectedEvent
  | TSessionEndedEvent;
