// ShoutcastSourceAdapter — v1 Shoutcast ingest adapter.
//
// Implements IContributionAdapter from @radio-clipper/contracts.
// One instance of this class handles one live station connection at a time.
//
// BOUNDARY RULE: All Shoutcast-specific parsing stays in shoutcast-protocol.ts.
// Everything this class emits — frames and session events — uses the
// protocol-agnostic types from @radio-clipper/contracts. Downstream code
// (session manager, chunker, transcription worker) must never import from
// shoutcast-protocol.ts directly.
//
// Connection lifecycle:
//   1. Caller creates an adapter, registers handlers, calls fnConnect().
//   2. When the encoder's HTTP SOURCE request arrives, caller passes it to
//      fnHandleSourceRequest(). The adapter validates auth, emits
//      session.created, then streams frames until the encoder disconnects.
//   3. On clean disconnect the encoder closes the request body. The adapter
//      emits session.ended with reason 'clean_disconnect'.
//   4. On reconnect the encoder opens a new SOURCE request. The adapter emits
//      session.reconnected and continues on the same sSessionId.
//   5. Caller can force a shutdown at any time via fnDisconnect().
//
// Credential resolution:
//   The adapter does not import the AWS SDK directly. Instead, it accepts a
//   TCredentialResolver function at construction time. In production this
//   calls Secrets Manager. In tests it returns a hardcoded string.
//   This keeps the adapter testable without real AWS credentials.

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type {
  IContributionAdapter,
  TNormalizedAudioFrame,
  TSessionLifecycleEvent,
  TStationIngestConfig,
  TIngestProtocol,
} from '@radio-clipper/contracts';

import {
  fnParseSourcePassword,
  fnParseShoutcastHeaders,
  fnEstimateFrameDurationMs,
} from './shoutcast-protocol.js';

// Injected function that resolves a Secrets Manager ARN to the plaintext secret.
// Swap this out in tests to avoid real AWS calls:
//   const oAdapter = new ShoutcastSourceAdapter(async () => 'testpassword', 'node-1');
export type TCredentialResolver = (sSecretArn: string) => Promise<string>;

export class ShoutcastSourceAdapter implements IContributionAdapter {
  readonly sAdapterType = 'ShoutcastSourceAdapter';
  readonly sProtocol: TIngestProtocol = 'shoutcast';

  // --- Event handlers registered by the caller ---

  private fnFrameHandler: ((oFrame: TNormalizedAudioFrame) => void) | null = null;
  private fnSessionEventHandler: ((oEvent: TSessionLifecycleEvent) => void) | null = null;
  private fnErrorHandler: ((oError: Error) => void) | null = null;

  // --- Per-connection state ---
  // Reset on each new connection. sSessionId persists across reconnects
  // so the session manager can track them as one session.

  private oConfig: TStationIngestConfig | null = null;
  private bReady = false;

  private sSessionId: string | null = null;
  private sStartedAt: string | null = null;

  // nOffsetMs accumulates across reconnects — the clock does not reset.
  private nOffsetMs = 0;

  // nSequenceNo also continues across reconnects for monotonicity.
  private nSequenceNo = 0;

  // Tracks how many times the encoder has reconnected on this session.
  // The session manager in DynamoDB is the authoritative counter;
  // this local value is included in events for log correlation.
  private nReconnectCount = 0;

  // Held so fnDisconnect() can destroy the active socket.
  private oActiveRequest: IncomingMessage | null = null;
  // Guards session.ended emission so one connection leg cannot emit duplicate
  // terminal events when multiple close paths fire (destroy + end/error).
  private bSessionEndedForCurrentConnection = false;

  // --- Constructor dependencies ---

  private readonly oCredentialResolver: TCredentialResolver;

  /**
   * @param oCredentialResolver - Async function that turns a Secrets Manager
   *   ARN into the expected source password. Inject a stub in tests.
   * @param sNodeId - Unique identifier for this gateway process instance.
   *   Written into session.created events for traceability in multi-node deploys.
   */
  constructor(
    oCredentialResolver: TCredentialResolver,
    private readonly sNodeId: string,
  ) {
    this.oCredentialResolver = oCredentialResolver;
  }

  // --- IContributionAdapter handler registration ---

  fnOnFrame(fnHandler: (oFrame: TNormalizedAudioFrame) => void): void {
    this.fnFrameHandler = fnHandler;
  }

  fnOnSessionEvent(fnHandler: (oEvent: TSessionLifecycleEvent) => void): void {
    this.fnSessionEventHandler = fnHandler;
  }

  fnOnError(fnHandler: (oError: Error) => void): void {
    this.fnErrorHandler = fnHandler;
  }

  // --- IContributionAdapter lifecycle ---

  /**
   * Prepare this adapter to accept the next incoming SOURCE request.
   *
   * For Shoutcast, "connect" means the gateway is ready to receive an
   * inbound push from the encoder — we are the server, not the client.
   * The actual connection arrives via fnHandleSourceRequest().
   *
   * Calling fnConnect() a second time (e.g. after a dropped connection)
   * resets bReady without clearing sSessionId, so a reconnect continues
   * on the same session.
   */
  async fnConnect(oConfig: TStationIngestConfig): Promise<void> {
    this.oConfig = oConfig;
    this.bReady = true;
  }

  /**
   * Shut down the active source connection and emit session.ended.
   *
   * Safe to call even when no source is connected — it will no-op
   * if there is no active request.
   */
  async fnDisconnect(): Promise<void> {
    this.bReady = false;

    // Emit session.ended once for the current connection/session if it has not
    // already been emitted. This is idempotent by design.
    this.fnEmitSessionEnded('clean_disconnect');

    // Snapshot and clear active request first. This prevents late events from a
    // stale request being treated as the active stream.
    const oRequestToClose = this.oActiveRequest;
    this.oActiveRequest = null;

    if (oRequestToClose) {
      oRequestToClose.destroy();
    }

    // A manual disconnect is terminal for this adapter lifecycle. Reset session
    // state so a future fnConnect/fnHandleSourceRequest starts a new session ID
    // instead of reviving a previous one.
    this.fnResetSessionLifecycleState();
  }

  // --- Shoutcast-specific request entry point ---

  /**
   * Handle an incoming HTTP SOURCE request from the encoder.
   *
   * This method is NOT part of IContributionAdapter — it is Shoutcast-specific.
   * The HTTP server (server.ts, wired in step 4) calls this when it identifies
   * a SOURCE request destined for this station's mount path.
   *
   * What this method does:
   *   1. Validates the source password against Secrets Manager.
   *   2. Parses ICY headers to get codec, bitrate, and sample rate.
   *   3. Emits session.created (first connection) or session.reconnected.
   *   4. Acknowledges the encoder with HTTP 200.
   *   5. Streams audio bytes as TNormalizedAudioFrame objects until disconnect.
   *   6. Emits session.ended on clean close or error.
   *
   * @param oReq - The incoming HTTP request from Node's http module.
   * @param oRes - The server response object used to acknowledge the encoder.
   */
  async fnHandleSourceRequest(
    oReq: IncomingMessage,
    oRes: ServerResponse,
  ): Promise<void> {
    if (!this.oConfig || !this.bReady) {
      oRes.writeHead(503, { 'Content-Type': 'text/plain' });
      oRes.end('Adapter not ready');
      return;
    }

    // A station may only have one active source stream at a time. Reject
    // overlapping SOURCE requests to prevent two encoders writing into one
    // session timeline concurrently.
    if (this.oActiveRequest) {
      oRes.writeHead(409, { 'Content-Type': 'text/plain' });
      oRes.end('Source already connected');
      return;
    }

    // --- Step 1: Credential validation ---
    // Parse the password from the Authorization header before touching any
    // Secrets Manager state, so we fail fast on a malformed request.

    const sSuppliedPassword = fnParseSourcePassword(
      oReq.headers['authorization'] as string | undefined,
    );

    if (sSuppliedPassword === null) {
      oRes.writeHead(401, {
        'Content-Type': 'text/plain',
        'WWW-Authenticate': 'Basic realm="Shoutcast Source"',
      });
      oRes.end('Authorization header required');
      return;
    }

    let sExpectedPassword: string;
    try {
      sExpectedPassword = await this.oCredentialResolver(
        this.oConfig.sCredentialSecretArn,
      );
    } catch (oErr) {
      // Credential lookup failure is an internal error, not an auth failure.
      // Do not expose internal details in the response body.
      const oError = oErr instanceof Error ? oErr : new Error(String(oErr));
      this.fnErrorHandler?.(oError);
      oRes.writeHead(500, { 'Content-Type': 'text/plain' });
      oRes.end('Internal error');
      return;
    }

    if (sSuppliedPassword !== sExpectedPassword) {
      oRes.writeHead(401, {
        'Content-Type': 'text/plain',
        'WWW-Authenticate': 'Basic realm="Shoutcast Source"',
      });
      oRes.end('Invalid credential');
      return;
    }

    // --- Step 2: ICY header parsing ---

    const { nBitrateKbps, nSampleRateHz, nChannels, eCodec } =
      fnParseShoutcastHeaders(
        oReq.headers as Record<string, string | string[] | undefined>,
      );

    // --- Step 3: Session event ---

    const bIsReconnect = this.sSessionId !== null;

    if (!bIsReconnect) {
      // First connection for this adapter instance — create a fresh session.
      this.sSessionId = randomUUID();
      this.sStartedAt = new Date().toISOString();

      this.fnSessionEventHandler?.({
        eType: 'session.created',
        sSessionId: this.sSessionId,
        sStationId: this.oConfig.sStationId,
        sStartedAt: this.sStartedAt,
        sAdapterType: this.sAdapterType,
        sIngestProtocol: this.sProtocol,
        sIngestNodeId: this.sNodeId,
      });
    } else {
      // The encoder dropped and reconnected. The session manager (step 4)
      // will use this event to increment reconnect_count in DynamoDB.
      this.nReconnectCount += 1;

      this.fnSessionEventHandler?.({
        eType: 'session.reconnected',
        sSessionId: this.sSessionId!,
        sStationId: this.oConfig.sStationId,
        nReconnectCount: this.nReconnectCount,
        sOccurredAt: new Date().toISOString(),
      });
    }

    // --- Step 4: Acknowledge the encoder ---
    // The encoder waits for this response before it starts sending audio.
    // We must flush the headers immediately or BUTT will time out.

    oRes.writeHead(200, 'OK', {
      'icy-notice1': 'Radio Clipper Ingest',
      'icy-notice2': 'stream active',
      'Content-Type': 'text/html',
    });
    oRes.flushHeaders();

    // Track this request as the active source stream. Reset the end guard for
    // this specific connection leg.
    this.oActiveRequest = oReq;
    this.bSessionEndedForCurrentConnection = false;

    // --- Step 5: Stream audio as normalized frames ---
    // Each 'data' event is a Buffer of bytes from the encoder's audio stream.
    // We wrap it in a TNormalizedAudioFrame with timing derived from session
    // start time plus accumulated offset. This is the protocol boundary —
    // nothing downstream sees Buffer or any Shoutcast concept after this point.

    oReq.on('data', (oChunk: Buffer) => {
      if (!this.bReady || !this.sSessionId || !this.oConfig) return;

      const nDurationMs = fnEstimateFrameDurationMs(oChunk.byteLength, nBitrateKbps);

      // Derive the absolute wall-clock time of this frame's audio window.
      // sStartedAt is the session's UTC origin; nOffsetMs is the accumulated
      // audio time since that origin.
      const sFrameStartedAt = new Date(
        new Date(this.sStartedAt!).getTime() + this.nOffsetMs,
      ).toISOString();

      // Wrap the Buffer in a Uint8Array view — zero-copy, no allocation.
      // Uint8Array works in both Node.js services and any future browser
      // consumer of these contracts.
      const oData = new Uint8Array(
        oChunk.buffer,
        oChunk.byteOffset,
        oChunk.byteLength,
      );

      const oFrame: TNormalizedAudioFrame = {
        sSessionId: this.sSessionId,
        sStationId: this.oConfig.sStationId,
        nSequenceNo: this.nSequenceNo++,
        sFrameStartedAt,
        nOffsetMs: this.nOffsetMs,
        nDurationMs,
        oData,
        eCodec,
        nSampleRateHz,
        nChannels,
      };

      // Advance the offset before emitting so that if the handler
      // synchronously emits the next frame it gets the right offset.
      this.nOffsetMs += nDurationMs;

      this.fnFrameHandler?.(oFrame);
    });

    // --- Step 6: Handle disconnect and errors ---

    oReq.on('end', () => {
      // The encoder closed the connection cleanly (e.g. BUTT stopped).
      if (this.oActiveRequest !== oReq) return;
      this.oActiveRequest = null;
      this.fnEmitSessionEnded('clean_disconnect');
    });

    oReq.on('error', (oErr: Error) => {
      // Network error or abrupt disconnect.
      if (this.oActiveRequest !== oReq) return;
      this.oActiveRequest = null;
      this.fnEmitSessionEnded('error');

      this.fnErrorHandler?.(oErr);
    });
  }

  // --- Private helpers ---

  private fnEmitSessionEnded(eReason: 'clean_disconnect' | 'error'): void {
    if (this.bSessionEndedForCurrentConnection) return;
    if (!this.sSessionId || !this.oConfig) return;

    this.bSessionEndedForCurrentConnection = true;
    this.fnSessionEventHandler?.({
      eType: 'session.ended',
      sSessionId: this.sSessionId,
      sStationId: this.oConfig.sStationId,
      sEndedAt: new Date().toISOString(),
      eReason,
    });
  }

  private fnResetSessionLifecycleState(): void {
    this.sSessionId = null;
    this.sStartedAt = null;
    this.nOffsetMs = 0;
    this.nSequenceNo = 0;
    this.nReconnectCount = 0;
    this.bSessionEndedForCurrentConnection = false;
  }
}
