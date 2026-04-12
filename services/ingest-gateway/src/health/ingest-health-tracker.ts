// IngestHealthTracker — in-memory health state for one or more stations.
//
// This is not a database. It holds only what is needed to answer the question
// "is ingest healthy right now?" without a round-trip to DynamoDB. The HTTP
// health endpoint reads from this tracker, not from the session table.
//
// State is updated by three event sources:
//   1. Session lifecycle events from the adapter (via SessionManager callbacks)
//   2. Completed chunk notifications from the ChunkAssembler
//   3. Error notifications from the adapter or assembler
//
// There is one TStationHealthState per station being served by this gateway
// process. In v1 that is one station. The map structure is here so multi-station
// support does not require a structural change later.
//
// Thread safety: Node.js is single-threaded. Updates and reads to the map
// are synchronous and cannot interleave. No locking is needed.

import type { TAudioChunkMetadata, TSessionLifecycleEvent } from '@radio-clipper/contracts';

/** The health state the HTTP endpoint exposes for one station. */
export type TStationHealthState = {
  sStationId: string;

  /** 'online' while a session is live, 'reconnecting' during a reconnect,
   *  'offline' when no session is active. */
  eStatus: 'online' | 'offline' | 'reconnecting';

  /** Active session ID, or null when offline. */
  sSessionId: string | null;

  /** Adapter class name, e.g. 'ShoutcastSourceAdapter'. Null when offline. */
  sAdapterType: string | null;

  /** Protocol string, e.g. 'shoutcast'. Null when offline. */
  sIngestProtocol: string | null;

  /** ISO 8601 UTC. Updated by the heartbeat timer in SessionManager. */
  sLastHeartbeatAt: string | null;

  /** Total reconnects on the current session. Resets when a new session starts. */
  nReconnectCount: number;

  /** Summary of the most recently completed chunk. Used to detect write lag. */
  oLatestChunk: TLatestChunkSummary | null;

  /** ISO 8601 UTC of the most recent error, if any. */
  sLastErrorAt: string | null;
  sLastErrorMessage: string | null;
};

/** Minimal chunk summary kept in health state — not the full TAudioChunkMetadata. */
export type TLatestChunkSummary = {
  nSequenceNo: number;
  sChunkStartedAt: string;
  sChunkEndedAt: string;
  nDurationMs: number;
  /** Seconds since chunk_ended_at — a proxy for write lag. Updated on each read. */
  nSecondsSinceLastChunk: number;
};

export class IngestHealthTracker {
  // Keyed by station_id.
  private readonly oStates = new Map<string, TStationHealthState>();

  /**
   * Process one session lifecycle event.
   * Call this from the same fnOnSessionEvent callback that feeds SessionManager.
   */
  fnHandleSessionEvent(oEvent: TSessionLifecycleEvent): void {
    switch (oEvent.eType) {
      case 'session.created': {
        // New session — build fresh state.
        this.oStates.set(oEvent.sStationId, {
          sStationId: oEvent.sStationId,
          eStatus: 'online',
          sSessionId: oEvent.sSessionId,
          sAdapterType: oEvent.sAdapterType,
          sIngestProtocol: oEvent.sIngestProtocol,
          sLastHeartbeatAt: oEvent.sStartedAt,
          nReconnectCount: 0,
          oLatestChunk: null,
          sLastErrorAt: null,
          sLastErrorMessage: null,
        });
        break;
      }

      case 'session.heartbeat': {
        const oState = this.oStates.get(oEvent.sStationId);
        if (oState) {
          oState.sLastHeartbeatAt = oEvent.sOccurredAt;
        }
        break;
      }

      case 'session.reconnected': {
        const oState = this.oStates.get(oEvent.sStationId);
        if (oState) {
          // A reconnect keeps the same logical session. Ensure the active
          // session ID is restored even if a prior session.ended set it null.
          oState.eStatus = 'online';
          oState.sSessionId = oEvent.sSessionId;
          oState.nReconnectCount = oEvent.nReconnectCount;
          oState.sLastHeartbeatAt = oEvent.sOccurredAt;
        } else {
          // Reconnect arrived before session.created — create minimal state.
          this.oStates.set(oEvent.sStationId, {
            sStationId: oEvent.sStationId,
            eStatus: 'online',
            sSessionId: oEvent.sSessionId,
            sAdapterType: null,
            sIngestProtocol: null,
            sLastHeartbeatAt: oEvent.sOccurredAt,
            nReconnectCount: oEvent.nReconnectCount,
            oLatestChunk: null,
            sLastErrorAt: null,
            sLastErrorMessage: null,
          });
        }
        break;
      }

      case 'session.ended': {
        const oState = this.oStates.get(oEvent.sStationId);
        if (oState) {
          oState.eStatus = 'offline';
          oState.sSessionId = null;
          oState.sAdapterType = null;
          oState.sIngestProtocol = null;
        }
        break;
      }
    }
  }

  /**
   * Update the latest chunk summary after a successful write.
   * Call this from ChunkAssembler.fnOnChunk.
   */
  fnHandleChunkCompleted(oChunk: TAudioChunkMetadata): void {
    const oState = this.oStates.get(oChunk.sStationId);
    if (!oState) return;

    // Store enough to calculate lag on the next health read.
    oState.oLatestChunk = {
      nSequenceNo: oChunk.nSequenceNo,
      sChunkStartedAt: oChunk.sChunkStartedAt,
      sChunkEndedAt: oChunk.sChunkEndedAt,
      nDurationMs: oChunk.nDurationMs,
      // Calculated fresh on each read in fnGetHealth — not stored here.
      nSecondsSinceLastChunk: 0,
    };
  }

  /**
   * Record an error from the adapter, session manager, or assembler.
   */
  fnHandleError(sStationId: string, oError: Error): void {
    const oState = this.oStates.get(sStationId);
    if (!oState) return;
    oState.sLastErrorAt = new Date().toISOString();
    oState.sLastErrorMessage = oError.message;
  }

  /**
   * Return the current health state for one station.
   * Returns null if no session has been seen for that station yet.
   *
   * nSecondsSinceLastChunk is calculated fresh on each call so it reflects
   * the actual age at read time, not the age at write time.
   */
  fnGetHealth(sStationId: string): TStationHealthState | null {
    const oState = this.oStates.get(sStationId);
    if (!oState) return null;

    // Shallow clone so the caller cannot mutate internal state.
    const oSnapshot: TStationHealthState = { ...oState };

    if (oSnapshot.oLatestChunk) {
      const nAgeMs =
        Date.now() - new Date(oSnapshot.oLatestChunk.sChunkEndedAt).getTime();
      oSnapshot.oLatestChunk = {
        ...oSnapshot.oLatestChunk,
        nSecondsSinceLastChunk: Math.max(0, Math.round(nAgeMs / 1000)),
      };
    }

    return oSnapshot;
  }

  /**
   * Return health state for every station the tracker knows about.
   * Used by a future admin endpoint that lists all active streams.
   */
  fnGetAllHealth(): TStationHealthState[] {
    return Array.from(this.oStates.keys()).map(
      (sId) => this.fnGetHealth(sId)!,
    );
  }
}
