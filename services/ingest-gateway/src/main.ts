// Ingest gateway — process entry point.
//
// Wires every component built in Slice 02 into one running service:
//
//   ShoutcastSourceAdapter   — accepts the encoder's HTTP SOURCE connection
//         ↓ frames
//   ChunkAssembler           — buffers frames, writes chunks to S3 + DynamoDB
//         ↓ session events
//   SessionManager           — writes live_sessions records, owns heartbeat clock
//         ↓ session events + chunk completions
//   IngestHealthTracker      — tracks in-memory health state
//         ↓
//   HTTP server              — serves /health and /health/stations/:stationId
//                              and routes SOURCE requests to the adapter
//
// Startup sequence:
//   1. Load and validate environment variables (fails fast if anything is missing).
//   2. Load station configuration from DynamoDB.  ← STUB in Slice 02; real lookup in Slice 04
//   3. Build all components with injected dependencies.
//   4. Wire event handlers so data flows through the pipeline.
//   5. Tell the adapter to accept connections.
//   6. Start the HTTP server.
//
// Shutdown:
//   SIGTERM or SIGINT flushes remaining buffered frames, ends the session
//   cleanly in DynamoDB, and closes the HTTP server before the process exits.

import { createServer } from 'node:http';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

import { fnLoadGatewayEnv, fnValidateStationConfig } from '@radio-clipper/config';

import { ShoutcastSourceAdapter } from './adapter/shoutcast-source-adapter.js';
import { SessionManager } from './session/session-manager.js';
import { DynamoSessionStore } from './session/session-store.js';
import { ChunkAssembler } from './chunk/chunk-assembler.js';
import { DynamoChunkStore } from './chunk/chunk-store.js';
import { S3AudioStore } from './chunk/audio-store.js';
import { IngestHealthTracker } from './health/ingest-health-tracker.js';
import { fnRouteHealthRequest } from './health/health-router.js';

// ---------------------------------------------------------------------------
// STUB: station config loader
// ---------------------------------------------------------------------------
// In Slice 04 this will call DynamoDB to load the station record by station ID.
// For now it reads a JSON blob from the STATION_CONFIG_JSON environment variable
// so Slice 02 can be run and tested without a populated DynamoDB stations table.
//
// Set the variable to a JSON string matching TStationIngestConfig, e.g.:
//   export STATION_CONFIG_JSON='{"sStationId":"station_001","sName":"Test",...}'
//
// Remove this function and replace its call site when the real loader exists.
function fnLoadStationConfigStub(): unknown {
  const sJson = process.env['STATION_CONFIG_JSON'];
  if (!sJson) {
    throw new Error(
      'STATION_CONFIG_JSON is not set. ' +
        'Provide a TStationIngestConfig JSON string until the DynamoDB loader exists.',
    );
  }
  try {
    return JSON.parse(sJson);
  } catch {
    throw new Error('STATION_CONFIG_JSON is not valid JSON');
  }
}
// ---------------------------------------------------------------------------

async function fnMain(): Promise<void> {
  // --- Step 1: Environment ---
  // Throws with a full list of missing variables if anything is wrong.
  const oEnv = fnLoadGatewayEnv();

  // --- Step 2: Station config ---
  const oRawConfig = fnLoadStationConfigStub();
  const oConfigResult = fnValidateStationConfig(oRawConfig);
  if (!oConfigResult.bValid) {
    throw new Error(
      'Station config is invalid:\n' +
        oConfigResult.asErrors.map((s) => `  • ${s}`).join('\n'),
    );
  }
  const oStationConfig = oConfigResult.oValue;
  console.log(`[main] Station config loaded: ${oStationConfig.sStationId}`);

  // --- Step 3: AWS clients ---
  const oDynamo = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: oEnv.sAwsRegion }),
  );
  const oS3 = new S3Client({ region: oEnv.sAwsRegion });

  // --- Step 4: Build components ---

  // Adapter — credential resolver calls Secrets Manager in production.
  // The resolver is async so tests can inject a synchronous stub:
  //   new ShoutcastSourceAdapter(async () => 'testpassword', 'node-test')
  const oAdapter = new ShoutcastSourceAdapter(
    async (sArn) => fnResolveSecretStub(sArn),
    oEnv.sNodeId,
  );

  const oSessionStore = new DynamoSessionStore(oDynamo, oEnv.sSessionsTable);
  const oSessionManager = new SessionManager(oSessionStore, {
    nHeartbeatIntervalMs: 20_000,
  });

  const oChunkStore = new DynamoChunkStore(oDynamo, oEnv.sChunksTable);
  const oAudioStore = new S3AudioStore(oS3);
  const oAssembler = new ChunkAssembler(oAudioStore, oChunkStore, {
    nChunkDurationMs: oEnv.nChunkDurationMs,
    sChunkBucket: oEnv.sChunkBucket,
  });

  const oHealthTracker = new IngestHealthTracker();

  // --- Step 5: Wire event handlers ---
  //
  // Each handler is registered once here. The pipeline is:
  //   adapter frame events   → assembler
  //   adapter session events → session manager (writes DynamoDB)
  //   adapter session events → health tracker  (updates in-memory state)
  //   assembler chunk events → health tracker
  //   errors from all three  → health tracker + stderr

  oAdapter.fnOnFrame((oFrame) => {
    // Fire-and-forget — the adapter does not wait for the chunk write to finish
    // before continuing to accept frames. Errors surface via fnOnError below.
    void oAssembler.fnIngestFrame(oFrame);
  });

  oAdapter.fnOnSessionEvent((oEvent) => {
    void oSessionManager.fnHandleEvent(oEvent);
    oHealthTracker.fnHandleSessionEvent(oEvent);
  });

  oAdapter.fnOnError((oErr) => {
    oHealthTracker.fnHandleError(oStationConfig.sStationId, oErr);
    console.error('[adapter]', oErr.message);
  });

  oAssembler.fnOnChunk((oChunk) => {
    oHealthTracker.fnHandleChunkCompleted(oChunk);
  });

  oAssembler.fnOnError((oErr) => {
    oHealthTracker.fnHandleError(oStationConfig.sStationId, oErr);
    console.error('[assembler]', oErr.message);
  });

  oSessionManager.fnOnError((oErr) => {
    oHealthTracker.fnHandleError(oStationConfig.sStationId, oErr);
    console.error('[session-manager]', oErr.message);
  });

  // SessionManager owns the timer-based heartbeat writes. Forward successful
  // heartbeat events into the in-memory tracker so /health mirrors live state.
  oSessionManager.fnOnHeartbeatEvent((oHeartbeatEvent) => {
    oHealthTracker.fnHandleSessionEvent(oHeartbeatEvent);
  });

  // Tell the adapter this station's config so it is ready to accept connections.
  await oAdapter.fnConnect(oStationConfig);
  console.log(`[main] Adapter ready for ${oStationConfig.sStationId}`);

  // --- Step 6: HTTP server ---

  const oServer = createServer((oReq, oRes) => {
    const sMethod = oReq.method ?? '';
    const sUrl = oReq.url ?? '/';

    // Health routes — read-only, no auth.
    if (fnRouteHealthRequest(oReq, oRes, oHealthTracker)) return;

    // Shoutcast source connection — encoder pushes audio here.
    // The SOURCE method is a non-standard HTTP verb used by Shoutcast encoders.
    // Node.js's built-in http module accepts it via the 'request' event.
    if (sMethod === 'SOURCE') {
      // v1: one station, one mount path. Multi-station routing comes later.
      void oAdapter.fnHandleSourceRequest(oReq, oRes);
      return;
    }

    // PUT /stream is used by some encoders in Shoutcast-compatibility mode.
    if (sMethod === 'PUT' && sUrl.startsWith('/stream')) {
      void oAdapter.fnHandleSourceRequest(oReq, oRes);
      return;
    }

    // Anything else is not handled by this service.
    oRes.writeHead(404, { 'Content-Type': 'text/plain' });
    oRes.end('Not found');
  });

  oServer.listen(oEnv.nPort, () => {
    console.log(`[main] Ingest gateway listening on port ${oEnv.nPort}`);
    console.log(`[main] Health: http://localhost:${oEnv.nPort}/health`);
    console.log(
      `[main] Station health: http://localhost:${oEnv.nPort}/health/stations/${oStationConfig.sStationId}`,
    );
  });

  // --- Graceful shutdown ---
  // Flush remaining frames before exit so the last seconds of audio are not lost.

  const fnShutdown = async (sSignal: string): Promise<void> => {
    console.log(`[main] ${sSignal} received — shutting down`);

    // Stop accepting new connections.
    oServer.close();

    // Disconnect the adapter — emits session.ended which the session manager writes.
    await oAdapter.fnDisconnect();

    // Flush any frames that did not fill a complete chunk window.
    await oAssembler.fnFlushRemaining();

    console.log('[main] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void fnShutdown('SIGTERM'));
  process.on('SIGINT', () => void fnShutdown('SIGINT'));
}

// ---------------------------------------------------------------------------
// STUB: Secrets Manager credential resolver
// ---------------------------------------------------------------------------
// In production this calls AWS Secrets Manager using the ARN from the station
// config. For Slice 02 development, set SOURCE_PASSWORD in the environment.
// Replace with the real SDK call before connecting a real encoder.
async function fnResolveSecretStub(sArn: string): Promise<string> {
  const sPassword = process.env['SOURCE_PASSWORD'];
  if (!sPassword) {
    throw new Error(
      `SOURCE_PASSWORD env var is not set. ` +
        `Set it to the expected source password until the Secrets Manager resolver exists. ` +
        `(ARN: ${sArn})`,
    );
  }
  return sPassword;
}
// ---------------------------------------------------------------------------

// Start the process. Any unhandled startup error exits with a non-zero code
// and a clear message rather than hanging or silently failing.
fnMain().catch((oErr: unknown) => {
  console.error(
    '[main] Fatal startup error:',
    oErr instanceof Error ? oErr.message : String(oErr),
  );
  process.exit(1);
});
