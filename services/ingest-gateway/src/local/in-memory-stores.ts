// In-memory local-mode stores for Slice 02 validation.
//
// These implementations let the ingest gateway run end to end without AWS
// credentials or provisioned infrastructure. They are intentionally simple and
// exist only to validate adapter, session, chunk, and health behavior locally.

import type { TAudioChunkMetadata, TLiveSession } from '@radio-clipper/contracts';

import type { IS3AudioStore, TChunkWriteRequest } from '../chunk/audio-store.js';
import type { IChunkStore } from '../chunk/chunk-store.js';
import type { ISessionStore, TSessionCreateRecord } from '../session/session-store.js';

export class InMemoryAudioStore implements IS3AudioStore {
  private readonly oObjects = new Map<string, Uint8Array>();

  async fnPutChunk(oRequest: TChunkWriteRequest): Promise<void> {
    this.oObjects.set(oRequest.sKey, new Uint8Array(oRequest.oData));
  }
}

export class InMemoryChunkStore implements IChunkStore {
  private readonly oChunks = new Map<string, TAudioChunkMetadata>();

  async fnCreate(oMetadata: TAudioChunkMetadata): Promise<void> {
    const sKey = `${oMetadata.sSessionId}#${oMetadata.sChunkStartedAt}`;
    if (this.oChunks.has(sKey)) {
      throw new Error(`Duplicate chunk write for ${sKey}`);
    }
    this.oChunks.set(sKey, { ...oMetadata });
  }
}

export class InMemorySessionStore implements ISessionStore {
  private readonly oSessions = new Map<string, TLiveSession>();

  async fnCreate(oRecord: TSessionCreateRecord): Promise<void> {
    const sKey = this.fnKey(oRecord.sStationId, oRecord.sSessionId);
    if (this.oSessions.has(sKey)) {
      throw new Error(`Duplicate session create for ${sKey}`);
    }

    this.oSessions.set(sKey, {
      sSessionId: oRecord.sSessionId,
      sStationId: oRecord.sStationId,
      sIngestProtocol: oRecord.sIngestProtocol,
      sAdapterType: oRecord.sAdapterType,
      sStartedAt: oRecord.sStartedAt,
      sEndedAt: null,
      eStatus: 'live',
      sLastHeartbeatAt: oRecord.sStartedAt,
      nMonitorDelayMs: 0,
      nTranscriptionDelayMs: 0,
      nReconnectCount: 0,
      sIngestNodeId: oRecord.sIngestNodeId,
    });
  }

  async fnHeartbeat(
    sStationId: string,
    sSessionId: string,
    sOccurredAt: string,
  ): Promise<void> {
    const oSession = this.fnRequireSession(sStationId, sSessionId);
    oSession.sLastHeartbeatAt = sOccurredAt;
  }

  async fnReconnect(
    sStationId: string,
    sSessionId: string,
    nReconnectCount: number,
    sOccurredAt: string,
  ): Promise<void> {
    const oSession = this.fnRequireSession(sStationId, sSessionId);
    oSession.nReconnectCount = nReconnectCount;
    oSession.sLastHeartbeatAt = sOccurredAt;
    oSession.sEndedAt = null;
    oSession.eStatus = 'live';
  }

  async fnEnd(
    sStationId: string,
    sSessionId: string,
    sEndedAt: string,
    eStatus: 'ended' | 'failed',
  ): Promise<void> {
    const oSession = this.fnRequireSession(sStationId, sSessionId);
    oSession.sEndedAt = sEndedAt;
    oSession.eStatus = eStatus;
  }

  private fnKey(sStationId: string, sSessionId: string): string {
    return `${sStationId}#${sSessionId}`;
  }

  private fnRequireSession(sStationId: string, sSessionId: string): TLiveSession {
    const sKey = this.fnKey(sStationId, sSessionId);
    const oSession = this.oSessions.get(sKey);
    if (!oSession) {
      throw new Error(`Session not found: ${sKey}`);
    }
    return oSession;
  }
}