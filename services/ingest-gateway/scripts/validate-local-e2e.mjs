import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as fnSleep } from 'node:timers/promises';
const S_GATEWAY_ROOT = fileURLToPath(new URL('..', import.meta.url));
const S_TSX_BIN = fileURLToPath(new URL('../node_modules/.bin/tsx', import.meta.url));


const N_PORT = await fnFindFreePort();
const N_CHUNK_DURATION_MS = 500;
const S_PASSWORD = 'testpassword1234';
const S_STATION_ID = 'station_001';

const oGatewayEnv = {
  ...process.env,
  INGEST_PORT: String(N_PORT),
  INGEST_NODE_ID: 'local-proof-node',
  INGEST_CHUNK_BUCKET: 'local-proof-bucket',
  INGEST_SESSIONS_TABLE: 'local-proof-sessions',
  INGEST_CHUNKS_TABLE: 'local-proof-chunks',
  INGEST_STATIONS_TABLE: 'local-proof-stations',
  INGEST_CHUNK_DURATION_MS: String(N_CHUNK_DURATION_MS),
  AWS_REGION: 'us-east-1',
  INGEST_USE_IN_MEMORY_STORES: '1',
  SOURCE_PASSWORD: S_PASSWORD,
  STATION_CONFIG_JSON: JSON.stringify({
    sStationId: S_STATION_ID,
    sName: 'Local Proof Station',
    sSlug: 'local-proof',
    eStatus: 'active',
    ePrimaryIngestProtocol: 'shoutcast',
    aFutureProtocolsEnabled: [],
    eEncoderType: 'butt',
    sIngestEndpoint: `localhost:${N_PORT}`,
    sCredentialSecretArn: 'arn:aws:secretsmanager:us-east-1:000000000000:secret:local-proof',
    nRetentionDays: 7,
    sCreatedAt: '2026-04-12T00:00:00Z',
    sUpdatedAt: '2026-04-12T00:00:00Z',
  }),
};

const oChild = spawn(
  S_TSX_BIN,
  ['src/main.ts'],
  {
    cwd: S_GATEWAY_ROOT,
    env: oGatewayEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let sStdout = '';
let sStderr = '';
oChild.stdout.on('data', (oChunk) => {
  sStdout += oChunk.toString();
  process.stdout.write(oChunk);
});
oChild.stderr.on('data', (oChunk) => {
  sStderr += oChunk.toString();
  process.stderr.write(oChunk);
});

try {
  await fnWaitForGatewayReady();

  const oInitialHealth = await fnGetJson('/health');
  assert.equal(oInitialHealth.sStatus, 'idle');

  const oFirstSource = await fnOpenSourceStream();
  await fnWriteAudioForMs(oFirstSource.oRequest, 900);
  await fnSleep(200);

  const oOnlineHealth = await fnGetJson(`/health/stations/${S_STATION_ID}`);
  assert.equal(oOnlineHealth.eStatus, 'online');
  assert.equal(typeof oOnlineHealth.sSessionId, 'string');
  assert.equal(oOnlineHealth.nReconnectCount, 0);
  assert.equal(oOnlineHealth.sAdapterType, 'ShoutcastSourceAdapter');
  assert.equal(oOnlineHealth.sIngestProtocol, 'shoutcast');
  assert.ok(oOnlineHealth.oLatestChunk);
  assert.equal(oOnlineHealth.oLatestChunk.nDurationMs, N_CHUNK_DURATION_MS);

  const sSessionId = oOnlineHealth.sSessionId;

  oFirstSource.oRequest.end();
  await fnSleep(200);

  const oOfflineAfterFirstDisconnect = await fnGetJson(`/health/stations/${S_STATION_ID}`);
  assert.equal(oOfflineAfterFirstDisconnect.eStatus, 'offline');

  const oSecondSource = await fnOpenSourceStream();
  await fnWriteAudioForMs(oSecondSource.oRequest, 900);
  await fnSleep(200);

  const oReconnectHealth = await fnGetJson(`/health/stations/${S_STATION_ID}`);
  assert.equal(oReconnectHealth.eStatus, 'online');
  assert.equal(oReconnectHealth.sSessionId, sSessionId);
  assert.equal(oReconnectHealth.nReconnectCount, 1);
  assert.ok(oReconnectHealth.oLatestChunk);
  assert.ok(oReconnectHealth.oLatestChunk.nSequenceNo >= 1);

  oSecondSource.oRequest.end();
  await fnSleep(200);

  const oOfflineAfterFinalDisconnect = await fnGetJson(`/health/stations/${S_STATION_ID}`);
  assert.equal(oOfflineAfterFinalDisconnect.eStatus, 'offline');

  const oEvidence = {
    sCheckedAt: new Date().toISOString(),
    sGatewayStatus: oInitialHealth.sStatus,
    oFirstConnection: {
      eStatus: oOnlineHealth.eStatus,
      sSessionId,
      nReconnectCount: oOnlineHealth.nReconnectCount,
      nLatestChunkSequenceNo: oOnlineHealth.oLatestChunk.nSequenceNo,
      nLatestChunkDurationMs: oOnlineHealth.oLatestChunk.nDurationMs,
    },
    oAfterFirstDisconnect: {
      eStatus: oOfflineAfterFirstDisconnect.eStatus,
      sSessionId: oOfflineAfterFirstDisconnect.sSessionId,
    },
    oReconnect: {
      eStatus: oReconnectHealth.eStatus,
      sSessionId: oReconnectHealth.sSessionId,
      nReconnectCount: oReconnectHealth.nReconnectCount,
      nLatestChunkSequenceNo: oReconnectHealth.oLatestChunk.nSequenceNo,
    },
    oAfterFinalDisconnect: {
      eStatus: oOfflineAfterFinalDisconnect.eStatus,
      sSessionId: oOfflineAfterFinalDisconnect.sSessionId,
    },
  };

  console.log('\n[validate:local] Evidence');
  console.log(JSON.stringify(oEvidence, null, 2));
} finally {
  if (!oChild.killed) {
    oChild.kill('SIGINT');
  }
  await new Promise((resolve) => oChild.once('exit', resolve));
}

if (oChild.exitCode && oChild.exitCode !== 0) {
  throw new Error(`Gateway exited with code ${oChild.exitCode}\n${sStdout}\n${sStderr}`);
}

async function fnWaitForGatewayReady() {
  const nDeadline = Date.now() + 10_000;
  while (Date.now() < nDeadline) {
    try {
      const oHealth = await fnGetJson('/health');
      if (oHealth.sStatus === 'idle' || oHealth.sStatus === 'healthy') {
        return;
      }
    } catch {}
    await fnSleep(100);
  }
  throw new Error(`Gateway did not become ready in time\n${sStdout}\n${sStderr}`);
}

async function fnOpenSourceStream() {
  const sAuth = `Basic ${Buffer.from(`:${S_PASSWORD}`).toString('base64')}`;

  return await new Promise((resolve, reject) => {
    const oRequest = request(
      {
        host: '127.0.0.1',
        port: N_PORT,
        path: '/stream',
        method: 'PUT',
        headers: {
          authorization: sAuth,
          'content-type': 'audio/mpeg',
          'icy-br': '128',
          'icy-sr': '44100',
          'icy-name': 'Local Proof Source',
        },
      },
      (oResponse) => {
        if (oResponse.statusCode !== 200) {
          reject(new Error(`Source connection failed with status ${oResponse.statusCode}`));
          return;
        }
        resolve({ oRequest, oResponse });
      },
    );

    oRequest.on('error', reject);
    oRequest.flushHeaders();
  });
}

async function fnWriteAudioForMs(oRequest, nDurationMs) {
  const nFrameDurationMs = 100;
  const nFrameBytes = 1600;
  const nFrames = Math.ceil(nDurationMs / nFrameDurationMs);

  for (let i = 0; i < nFrames; i += 1) {
    oRequest.write(Buffer.alloc(nFrameBytes, i));
    await fnSleep(nFrameDurationMs);
  }
}

async function fnGetJson(sPath) {
  return await new Promise((resolve, reject) => {
    const oRequest = request(
      {
        host: '127.0.0.1',
        port: N_PORT,
        path: sPath,
        method: 'GET',
      },
      (oResponse) => {
        let sBody = '';
        oResponse.setEncoding('utf8');
        oResponse.on('data', (sChunk) => {
          sBody += sChunk;
        });
        oResponse.on('end', () => {
          if ((oResponse.statusCode ?? 500) >= 400) {
            reject(new Error(`GET ${sPath} failed with status ${oResponse.statusCode}: ${sBody}`));
            return;
          }
          resolve(JSON.parse(sBody));
        });
      },
    );

    oRequest.on('error', reject);
    oRequest.end();
  });
}

async function fnFindFreePort() {
  return await new Promise((resolve, reject) => {
    const oServer = createServer();

    oServer.once('error', reject);
    oServer.listen(0, '127.0.0.1', () => {
      const oAddress = oServer.address();
      if (!oAddress || typeof oAddress === 'string') {
        reject(new Error('Could not resolve a free port for local validation'));
        return;
      }

      const nPort = oAddress.port;
      oServer.close((oErr) => {
        if (oErr) {
          reject(oErr);
          return;
        }
        resolve(nPort);
      });
    });
  });
}