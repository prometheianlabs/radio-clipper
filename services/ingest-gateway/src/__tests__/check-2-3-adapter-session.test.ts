// Validation checks 2 & 3: session creation and reconnect behaviour.
//
// Check 2: a simulated Shoutcast source can authenticate and produce
//          a session.created event with the correct fields.
//
// Check 3: a reconnect produces session.reconnected on the same session ID,
//          and session.ended fires with the correct reason on disconnect.
//
// No real AWS services are used. The credential resolver is an injected stub.
// HTTP requests are simulated with PassThrough streams.

import { describe, it, expect, beforeEach } from 'vitest';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TSessionLifecycleEvent, TNormalizedAudioFrame } from '@radio-clipper/contracts';
import { ShoutcastSourceAdapter } from '../adapter/shoutcast-source-adapter.js';
import type { TStationIngestConfig } from '@radio-clipper/contracts';

// --- Test helpers ---

const oStationConfig: TStationIngestConfig = {
  sStationId: 'station_001',
  sName: 'Test Station',
  sSlug: 'test',
  eStatus: 'active',
  ePrimaryIngestProtocol: 'shoutcast',
  aFutureProtocolsEnabled: [],
  eEncoderType: 'butt',
  sIngestEndpoint: 'localhost:8000',
  sCredentialSecretArn: 'arn:aws:secretsmanager:us-east-1:000:secret:test',
  nRetentionDays: 7,
  sCreatedAt: '2026-04-12T00:00:00Z',
  sUpdatedAt: '2026-04-12T00:00:00Z',
};

const CORRECT_PASSWORD = 'testpassword';

// Build a fake IncomingMessage using a PassThrough stream.
// The stream starts in paused mode so data pushed after the handler
// registers its listener will be delivered correctly.
function fnMakeRequest(sPassword: string, nBitrateKbps = 128): IncomingMessage {
  const oStream = new PassThrough();
  const sAuth = `Basic ${Buffer.from(`:${sPassword}`).toString('base64')}`;

  // Attach the header properties the adapter reads.
  Object.assign(oStream, {
    headers: {
      authorization: sAuth,
      'content-type': 'audio/mpeg',
      'icy-br': String(nBitrateKbps),
      'icy-sr': '44100',
      'icy-name': 'Test Station',
    },
    method: 'SOURCE',
    url: '/stream',
  });

  return oStream as unknown as IncomingMessage;
}

// Build a minimal ServerResponse stub that records what was written.
function fnMakeResponse() {
  const o = {
    nStatus: 0,
    bEnded: false,
    sBody: '',
    writeHead(nStatus: number) { o.nStatus = nStatus; },
    end(sBody = '') { o.bEnded = true; o.sBody = sBody; },
    flushHeaders() {},
  };
  return o as unknown as ServerResponse & typeof o;
}

// Push audio bytes to a request stream and close it.
// Uses setImmediate so the data arrives after the adapter has registered
// its 'data' and 'end' listeners.
async function fnStreamAudioAndEnd(
  oReq: IncomingMessage,
  nBytes = 16_000,
): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  (oReq as unknown as PassThrough).push(Buffer.alloc(nBytes));
  (oReq as unknown as PassThrough).push(null);
  // Wait for 'end' event to propagate
  await new Promise<void>((resolve) => setImmediate(resolve));
}

// --- Check 2: session creation ---

describe('check 2 — session creation', () => {
  let oAdapter: ShoutcastSourceAdapter;

  beforeEach(async () => {
    oAdapter = new ShoutcastSourceAdapter(
      async () => CORRECT_PASSWORD,
      'test-node-1',
    );
    await oAdapter.fnConnect(oStationConfig);
  });

  it('responds 200 OK when the credential is correct', async () => {
    const oReq = fnMakeRequest(CORRECT_PASSWORD);
    const oRes = fnMakeResponse();

    await oAdapter.fnHandleSourceRequest(oReq, oRes);

    expect(oRes.nStatus).toBe(200);
  });

  it('emits session.created with correct station and node info', async () => {
    const aEvents: TSessionLifecycleEvent[] = [];
    oAdapter.fnOnSessionEvent((e) => aEvents.push(e));

    const oReq = fnMakeRequest(CORRECT_PASSWORD);
    const oRes = fnMakeResponse();

    await oAdapter.fnHandleSourceRequest(oReq, oRes);

    const oCreated = aEvents.find((e) => e.eType === 'session.created');
    expect(oCreated).toBeDefined();
    if (oCreated?.eType === 'session.created') {
      expect(oCreated.sStationId).toBe('station_001');
      expect(oCreated.sAdapterType).toBe('ShoutcastSourceAdapter');
      expect(oCreated.sIngestProtocol).toBe('shoutcast');
      expect(oCreated.sIngestNodeId).toBe('test-node-1');
      // Session ID should be a non-empty string (UUID)
      expect(oCreated.sSessionId.length).toBeGreaterThan(0);
    }
  });

  it('emits normalized audio frames when the encoder sends data', async () => {
    const aFrames: TNormalizedAudioFrame[] = [];
    oAdapter.fnOnFrame((f) => aFrames.push(f));

    const oReq = fnMakeRequest(CORRECT_PASSWORD);
    const oRes = fnMakeResponse();

    await oAdapter.fnHandleSourceRequest(oReq, oRes);
    await fnStreamAudioAndEnd(oReq);

    expect(aFrames.length).toBeGreaterThan(0);

    // Frames must be protocol-agnostic — no Shoutcast-specific fields
    const oFrame = aFrames[0];
    expect(oFrame.sStationId).toBe('station_001');
    expect(oFrame.eCodec).toBe('mp3');
    expect(oFrame.nSampleRateHz).toBe(44100);
    expect(oFrame.oData).toBeInstanceOf(Uint8Array);
  });

  it('responds 401 when the credential is wrong', async () => {
    const oReq = fnMakeRequest('wrongpassword');
    const oRes = fnMakeResponse();

    await oAdapter.fnHandleSourceRequest(oReq, oRes);

    expect(oRes.nStatus).toBe(401);
  });

  it('responds 401 when no Authorization header is sent', async () => {
    const oReq = fnMakeRequest(CORRECT_PASSWORD);
    // Strip the auth header
    (oReq as unknown as { headers: Record<string, string> }).headers = {
      'content-type': 'audio/mpeg',
    };
    const oRes = fnMakeResponse();

    await oAdapter.fnHandleSourceRequest(oReq, oRes);

    expect(oRes.nStatus).toBe(401);
  });

  it('emits session.ended when the encoder disconnects cleanly', async () => {
    const aEvents: TSessionLifecycleEvent[] = [];
    oAdapter.fnOnSessionEvent((e) => aEvents.push(e));

    const oReq = fnMakeRequest(CORRECT_PASSWORD);
    const oRes = fnMakeResponse();

    await oAdapter.fnHandleSourceRequest(oReq, oRes);
    await fnStreamAudioAndEnd(oReq);

    const oEnded = aEvents.find((e) => e.eType === 'session.ended');
    expect(oEnded).toBeDefined();
    if (oEnded?.eType === 'session.ended') {
      expect(oEnded.eReason).toBe('clean_disconnect');
    }
  });
});

// --- Check 3: reconnect behaviour ---

describe('check 3 — reconnect', () => {
  let oAdapter: ShoutcastSourceAdapter;
  let aEvents: TSessionLifecycleEvent[];

  beforeEach(async () => {
    aEvents = [];
    oAdapter = new ShoutcastSourceAdapter(
      async () => CORRECT_PASSWORD,
      'test-node-1',
    );
    oAdapter.fnOnSessionEvent((e) => aEvents.push(e));
    await oAdapter.fnConnect(oStationConfig);
  });

  it('uses the same session ID on reconnect', async () => {
    // First connection
    const oReq1 = fnMakeRequest(CORRECT_PASSWORD);
    await oAdapter.fnHandleSourceRequest(oReq1, fnMakeResponse());
    await fnStreamAudioAndEnd(oReq1);

    const sFirstSessionId = aEvents.find((e) => e.eType === 'session.created')?.sSessionId;
    expect(sFirstSessionId).toBeDefined();

    // Second connection (reconnect)
    const oReq2 = fnMakeRequest(CORRECT_PASSWORD);
    await oAdapter.fnHandleSourceRequest(oReq2, fnMakeResponse());

    const oReconnected = aEvents.find((e) => e.eType === 'session.reconnected');
    expect(oReconnected).toBeDefined();
    // Must be the SAME session ID — not a new one
    expect(oReconnected?.sSessionId).toBe(sFirstSessionId);
  });

  it('increments nReconnectCount on each reconnect', async () => {
    // First connection and disconnect
    const oReq1 = fnMakeRequest(CORRECT_PASSWORD);
    await oAdapter.fnHandleSourceRequest(oReq1, fnMakeResponse());
    await fnStreamAudioAndEnd(oReq1);

    // Second connection (reconnect 1)
    const oReq2 = fnMakeRequest(CORRECT_PASSWORD);
    await oAdapter.fnHandleSourceRequest(oReq2, fnMakeResponse());
    await fnStreamAudioAndEnd(oReq2);

    // Third connection (reconnect 2)
    const oReq3 = fnMakeRequest(CORRECT_PASSWORD);
    await oAdapter.fnHandleSourceRequest(oReq3, fnMakeResponse());

    const aReconnectEvents = aEvents.filter((e) => e.eType === 'session.reconnected');
    expect(aReconnectEvents).toHaveLength(2);

    const oCounts = aReconnectEvents.map((e) =>
      e.eType === 'session.reconnected' ? e.nReconnectCount : -1,
    );
    // Counts should be 1 and 2 in order
    expect(oCounts).toEqual([1, 2]);
  });

  it('session.ended is not emitted on reconnect — only on terminal disconnect', async () => {
    // First connection and clean disconnect
    const oReq1 = fnMakeRequest(CORRECT_PASSWORD);
    await oAdapter.fnHandleSourceRequest(oReq1, fnMakeResponse());
    await fnStreamAudioAndEnd(oReq1);

    // Second connection without ending it
    const oReq2 = fnMakeRequest(CORRECT_PASSWORD);
    await oAdapter.fnHandleSourceRequest(oReq2, fnMakeResponse());

    // Only one session.ended so far (from the first disconnect)
    const nEndedCount = aEvents.filter((e) => e.eType === 'session.ended').length;
    expect(nEndedCount).toBe(1);
  });
});
