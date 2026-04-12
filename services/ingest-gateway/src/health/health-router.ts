// Health router — HTTP request handlers for ingest health endpoints.
//
// Handles two routes (both read-only, no auth required for v1 — the health
// surface is internal to the VPC and not exposed to the public internet):
//
//   GET /health
//     Returns a summary of all stations the tracker knows about.
//     Used by load balancers and container health checks.
//
//   GET /health/stations/:stationId
//     Returns full health state for one station.
//     Used by the control API, Slice 04 producer console, and ops tooling.
//
// Response format is JSON. HTTP status codes:
//   200 — state found and returned
//   404 — no state for that stationId (session never started on this node)
//   405 — wrong HTTP method
//
// This router is intentionally thin — no framework, just Node.js built-ins.
// main.ts calls fnRouteHealthRequest() after checking the URL prefix.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { IngestHealthTracker } from './ingest-health-tracker.js';

// Matches /health/stations/some-station-id
// Capture group 1 = stationId
const RX_STATION_HEALTH = /^\/health\/stations\/([^/]+)\/?$/;

/**
 * Route one HTTP request to the appropriate health handler.
 *
 * Returns true if the request matched a health route (so main.ts knows
 * it does not need to try other routes). Returns false if the URL did
 * not match any health route at all.
 */
export function fnRouteHealthRequest(
  oReq: IncomingMessage,
  oRes: ServerResponse,
  oTracker: IngestHealthTracker,
): boolean {
  const sUrl = oReq.url ?? '/';
  const sMethod = oReq.method ?? 'GET';

  // GET /health — gateway-level liveness check
  if (sUrl === '/health' || sUrl === '/health/') {
    if (sMethod !== 'GET') {
      fnSendMethodNotAllowed(oRes);
      return true;
    }
    fnHandleGatewayHealth(oRes, oTracker);
    return true;
  }

  // GET /health/stations/:stationId
  const oMatch = RX_STATION_HEALTH.exec(sUrl);
  if (oMatch) {
    if (sMethod !== 'GET') {
      fnSendMethodNotAllowed(oRes);
      return true;
    }
    fnHandleStationHealth(oRes, oTracker, oMatch[1]);
    return true;
  }

  // URL did not match any health route.
  return false;
}

// --- Handlers ---

function fnHandleGatewayHealth(
  oRes: ServerResponse,
  oTracker: IngestHealthTracker,
): void {
  const aStations = oTracker.fnGetAllHealth();

  // Gateway is healthy if at least one station is online.
  // If no stations are known yet, we still return 200 — the process is up,
  // just waiting for a source connection.
  const bAnyOnline = aStations.some((o) => o.eStatus === 'online');

  fnSendJson(oRes, 200, {
    sStatus: bAnyOnline ? 'healthy' : 'idle',
    sCheckedAt: new Date().toISOString(),
    nStationCount: aStations.length,
    aStations: aStations.map((o) => ({
      sStationId: o.sStationId,
      eStatus: o.eStatus,
      sSessionId: o.sSessionId,
    })),
  });
}

function fnHandleStationHealth(
  oRes: ServerResponse,
  oTracker: IngestHealthTracker,
  sStationId: string,
): void {
  const oState = oTracker.fnGetHealth(sStationId);

  if (!oState) {
    fnSendJson(oRes, 404, {
      sError: 'No health state for this station on this node',
      sStationId,
    });
    return;
  }

  // Return the full state so ops tooling has everything it needs without
  // a second request. nSecondsSinceLastChunk is already fresh-calculated
  // by IngestHealthTracker.fnGetHealth at call time.
  fnSendJson(oRes, 200, {
    sStationId: oState.sStationId,
    eStatus: oState.eStatus,
    sSessionId: oState.sSessionId,
    sAdapterType: oState.sAdapterType,
    sIngestProtocol: oState.sIngestProtocol,
    sLastHeartbeatAt: oState.sLastHeartbeatAt,
    nReconnectCount: oState.nReconnectCount,
    oLatestChunk: oState.oLatestChunk,
    sLastErrorAt: oState.sLastErrorAt,
    sLastErrorMessage: oState.sLastErrorMessage,
    sCheckedAt: new Date().toISOString(),
  });
}

// --- Response helpers ---

function fnSendJson(oRes: ServerResponse, nStatus: number, oBody: unknown): void {
  const sBody = JSON.stringify(oBody, null, 2);
  oRes.writeHead(nStatus, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(sBody),
  });
  oRes.end(sBody);
}

function fnSendMethodNotAllowed(oRes: ServerResponse): void {
  fnSendJson(oRes, 405, { sError: 'Method not allowed' });
}
