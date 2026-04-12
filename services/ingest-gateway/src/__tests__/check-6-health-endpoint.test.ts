// Validation check 6: health endpoint reflects live ingest state.
//
// Tests that IngestHealthTracker correctly transitions through
// offline → online → reconnecting → offline, and that fnRouteHealthRequest
// serialises the state into the expected HTTP responses.
//
// No real HTTP server is started. ServerResponse is stubbed inline.

import { describe, it, expect, beforeEach } from 'vitest';
import type { ServerResponse, IncomingMessage } from 'node:http';
import type { TSessionLifecycleEvent, TAudioChunkMetadata } from '@radio-clipper/contracts';
import { IngestHealthTracker } from '../health/ingest-health-tracker.js';
import { fnRouteHealthRequest } from '../health/health-router.js';

// --- Shared event fixtures ---

const SESSION_ID = 'sess-abc-123';
const STATION_ID = 'station_001';

function fnCreatedEvent(): TSessionLifecycleEvent {
  return {
    eType: 'session.created',
    sSessionId: SESSION_ID,
    sStationId: STATION_ID,
    sStartedAt: '2026-04-12T10:00:00.000Z',
    sAdapterType: 'ShoutcastSourceAdapter',
    sIngestProtocol: 'shoutcast',
    sIngestNodeId: 'node-1',
  };
}

function fnReconnectedEvent(nCount: number): TSessionLifecycleEvent {
  return {
    eType: 'session.reconnected',
    sSessionId: SESSION_ID,
    sStationId: STATION_ID,
    nReconnectCount: nCount,
    sOccurredAt: new Date().toISOString(),
  };
}

function fnEndedEvent(): TSessionLifecycleEvent {
  return {
    eType: 'session.ended',
    sSessionId: SESSION_ID,
    sStationId: STATION_ID,
    sEndedAt: new Date().toISOString(),
    eReason: 'clean_disconnect',
  };
}

function fnChunk(nSequenceNo: number): TAudioChunkMetadata {
  return {
    sChunkId: `sess-abc-123_${String(nSequenceNo).padStart(6, '0')}`,
    sSessionId: SESSION_ID,
    sStationId: STATION_ID,
    nSequenceNo,
    sChunkStartedAt: '2026-01-01T00:00:00.000Z',
    sChunkEndedAt: '2026-01-01T00:00:06.000Z',
    nStartOffsetMs: nSequenceNo * 6000,
    nEndOffsetMs: (nSequenceNo + 1) * 6000,
    sS3Key: `chunks/${STATION_ID}/${SESSION_ID}/${String(nSequenceNo).padStart(6, '0')}.mp3`,
    eCodec: 'mp3',
    nSampleRateHz: 44100,
    nDurationMs: 6000,
    nByteSize: 96000,
    sChecksum: 'a'.repeat(64),
  };
}

// --- HTTP stub ---

function fnMakeHttpObjects(sMethod: string, sUrl: string) {
  const oReq = { method: sMethod, url: sUrl } as IncomingMessage;
  const oBody = { nStatus: 0, sJson: '', bEnded: false };
  const oRes = {
    writeHead(n: number) { oBody.nStatus = n; },
    end(s: string) { oBody.sJson = s; oBody.bEnded = true; },
  } as unknown as ServerResponse;
  return { oReq, oRes, oBody };
}

// --- IngestHealthTracker state transitions ---

describe('IngestHealthTracker — state transitions', () => {
  let oTracker: IngestHealthTracker;

  beforeEach(() => {
    oTracker = new IngestHealthTracker();
  });

  it('returns null for an unknown station', () => {
    expect(oTracker.fnGetHealth('unknown')).toBeNull();
  });

  it('transitions to online when session.created fires', () => {
    oTracker.fnHandleSessionEvent(fnCreatedEvent());
    const oState = oTracker.fnGetHealth(STATION_ID);
    expect(oState?.eStatus).toBe('online');
    expect(oState?.sSessionId).toBe(SESSION_ID);
    expect(oState?.sAdapterType).toBe('ShoutcastSourceAdapter');
    expect(oState?.sIngestProtocol).toBe('shoutcast');
    expect(oState?.nReconnectCount).toBe(0);
  });

  it('updates reconnect count on session.reconnected', () => {
    oTracker.fnHandleSessionEvent(fnCreatedEvent());
    oTracker.fnHandleSessionEvent(fnReconnectedEvent(1));
    const oState = oTracker.fnGetHealth(STATION_ID);
    expect(oState?.eStatus).toBe('online');
    expect(oState?.nReconnectCount).toBe(1);
    // Session ID must NOT change on reconnect
    expect(oState?.sSessionId).toBe(SESSION_ID);
  });

  it('transitions to offline when session.ended fires', () => {
    oTracker.fnHandleSessionEvent(fnCreatedEvent());
    oTracker.fnHandleSessionEvent(fnEndedEvent());
    const oState = oTracker.fnGetHealth(STATION_ID);
    expect(oState?.eStatus).toBe('offline');
    expect(oState?.sSessionId).toBeNull();
  });

  it('updates oLatestChunk when a chunk completes', () => {
    oTracker.fnHandleSessionEvent(fnCreatedEvent());
    oTracker.fnHandleChunkCompleted(fnChunk(0));
    const oState = oTracker.fnGetHealth(STATION_ID);
    expect(oState?.oLatestChunk?.nSequenceNo).toBe(0);
    expect(oState?.oLatestChunk?.nDurationMs).toBe(6000);
  });

  it('nSecondsSinceLastChunk is non-negative and reflects real elapsed time', () => {
    oTracker.fnHandleSessionEvent(fnCreatedEvent());
    oTracker.fnHandleChunkCompleted(fnChunk(0));
    const oState = oTracker.fnGetHealth(STATION_ID);
    // The chunk ended at a fixed past time, so lag should be > 0
    expect(oState?.oLatestChunk?.nSecondsSinceLastChunk).toBeGreaterThan(0);
  });

  it('records errors without crashing', () => {
    oTracker.fnHandleSessionEvent(fnCreatedEvent());
    oTracker.fnHandleError(STATION_ID, new Error('S3 timeout'));
    const oState = oTracker.fnGetHealth(STATION_ID);
    expect(oState?.sLastErrorMessage).toBe('S3 timeout');
    expect(oState?.sLastErrorAt).not.toBeNull();
    // Error must not flip the session offline
    expect(oState?.eStatus).toBe('online');
  });

  it('full cycle: online → offline → online retains new session state', () => {
    oTracker.fnHandleSessionEvent(fnCreatedEvent());
    oTracker.fnHandleSessionEvent(fnEndedEvent());

    // New session starts
    const sNewSessionId = 'sess-new-456';
    oTracker.fnHandleSessionEvent({
      ...fnCreatedEvent(),
      sSessionId: sNewSessionId,
    });

    const oState = oTracker.fnGetHealth(STATION_ID);
    expect(oState?.eStatus).toBe('online');
    expect(oState?.sSessionId).toBe(sNewSessionId);
  });
});

// --- HTTP routing ---

describe('check 6 — health endpoint HTTP responses', () => {
  let oTracker: IngestHealthTracker;

  beforeEach(() => {
    oTracker = new IngestHealthTracker();
    oTracker.fnHandleSessionEvent(fnCreatedEvent());
  });

  it('GET /health returns 200 with station summary', () => {
    const { oReq, oRes, oBody } = fnMakeHttpObjects('GET', '/health');
    const bHandled = fnRouteHealthRequest(oReq, oRes, oTracker);

    expect(bHandled).toBe(true);
    expect(oBody.nStatus).toBe(200);

    const oParsed = JSON.parse(oBody.sJson);
    expect(oParsed.sStatus).toBe('healthy');
    expect(oParsed.nStationCount).toBe(1);
  });

  it('GET /health/stations/:id returns 200 with full station health', () => {
    const { oReq, oRes, oBody } = fnMakeHttpObjects(
      'GET',
      `/health/stations/${STATION_ID}`,
    );
    const bHandled = fnRouteHealthRequest(oReq, oRes, oTracker);

    expect(bHandled).toBe(true);
    expect(oBody.nStatus).toBe(200);

    const oParsed = JSON.parse(oBody.sJson);
    expect(oParsed.eStatus).toBe('online');
    expect(oParsed.sSessionId).toBe(SESSION_ID);
    expect(oParsed.sAdapterType).toBe('ShoutcastSourceAdapter');
    expect(oParsed.sCheckedAt).toBeDefined();
  });

  it('GET /health/stations/:id returns 404 for an unknown station', () => {
    const { oReq, oRes, oBody } = fnMakeHttpObjects(
      'GET',
      '/health/stations/does-not-exist',
    );
    fnRouteHealthRequest(oReq, oRes, oTracker);
    expect(oBody.nStatus).toBe(404);
  });

  it('GET /health shows idle when no sessions are online', () => {
    const oEmptyTracker = new IngestHealthTracker();
    const { oReq, oRes, oBody } = fnMakeHttpObjects('GET', '/health');
    fnRouteHealthRequest(oReq, oRes, oEmptyTracker);
    const oParsed = JSON.parse(oBody.sJson);
    expect(oParsed.sStatus).toBe('idle');
  });

  it('returns false for URLs that are not health routes', () => {
    const { oReq, oRes } = fnMakeHttpObjects('SOURCE', '/stream');
    const bHandled = fnRouteHealthRequest(oReq, oRes, oTracker);
    expect(bHandled).toBe(false);
  });

  it('returns 405 for non-GET methods on health routes', () => {
    const { oReq, oRes, oBody } = fnMakeHttpObjects('POST', '/health');
    fnRouteHealthRequest(oReq, oRes, oTracker);
    expect(oBody.nStatus).toBe(405);
  });
});
