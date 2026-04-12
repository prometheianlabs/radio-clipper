// Ingest gateway environment variable schema.
//
// Call fnLoadGatewayEnv() once at process startup, before opening any connections.
// If any required variable is absent or invalid the function throws with a clear
// list of what is missing — the gateway exits immediately rather than starting in
// a broken state. This fail-fast pattern makes misconfigured deployments obvious
// in CloudWatch logs rather than silent until the first connection attempt.
//
// Variable ownership:
//   INGEST_PORT                 — TCP port the gateway HTTP server listens on
//   INGEST_NODE_ID              — unique string for this gateway instance (used in session records)
//   INGEST_CHUNK_BUCKET         — S3 bucket where rolling audio chunks are written
//   INGEST_SESSIONS_TABLE       — DynamoDB table name for live_sessions records
//   INGEST_CHUNKS_TABLE         — DynamoDB table name for audio_chunks records
//   INGEST_STATIONS_TABLE       — DynamoDB table name for stations records
//   INGEST_CHUNK_DURATION_MS    — fixed chunk window in milliseconds (e.g. 6000 for 6 s)
//   AWS_REGION                  — AWS region; used by the SDK for all service calls

/** Typed, validated configuration for one ingest gateway process. */
export type TGatewayEnv = {
  /** TCP port the HTTP server listens on. */
  nPort: number;
  /** Unique node identifier — written to live session records for traceability. */
  sNodeId: string;
  /** S3 bucket name for rolling chunk objects. */
  sChunkBucket: string;
  /** DynamoDB table name: live_sessions. */
  sSessionsTable: string;
  /** DynamoDB table name: audio_chunks. */
  sChunksTable: string;
  /** DynamoDB table name: stations. */
  sStationsTable: string;
  /**
   * Chunk window size in milliseconds. Must be a positive integer.
   * Pick one value per deployment and do not change it while a session is live —
   * changing mid-session corrupts sequence_no and offset math.
   */
  nChunkDurationMs: number;
  /** AWS region string, e.g. "us-east-1". */
  sAwsRegion: string;
};

/**
 * Read, validate, and return all required ingest gateway environment variables.
 *
 * Throws if any variable is missing or invalid, listing every problem at once
 * so operators can fix all issues in one deployment cycle rather than one at a time.
 *
 * @param oEnv - The environment object to read from. Defaults to process.env.
 *               Pass a plain object in tests to avoid touching real env vars.
 */
export function fnLoadGatewayEnv(
  oEnv: Record<string, string | undefined> = process.env,
): TGatewayEnv {
  const asErrors: string[] = [];

  // --- String fields ---

  const sNodeId = fnRequireEnvString('INGEST_NODE_ID', oEnv, asErrors);
  const sChunkBucket = fnRequireEnvString('INGEST_CHUNK_BUCKET', oEnv, asErrors);
  const sSessionsTable = fnRequireEnvString('INGEST_SESSIONS_TABLE', oEnv, asErrors);
  const sChunksTable = fnRequireEnvString('INGEST_CHUNKS_TABLE', oEnv, asErrors);
  const sStationsTable = fnRequireEnvString('INGEST_STATIONS_TABLE', oEnv, asErrors);
  const sAwsRegion = fnRequireEnvString('AWS_REGION', oEnv, asErrors);

  // --- Numeric fields ---

  const nPort = fnRequireEnvPort('INGEST_PORT', oEnv, asErrors);
  const nChunkDurationMs = fnRequireEnvPositiveInt('INGEST_CHUNK_DURATION_MS', oEnv, asErrors);

  // Surface all errors at once so the operator sees the full picture in one log line.
  if (asErrors.length > 0) {
    throw new Error(
      `Ingest gateway environment is invalid — fix these before starting:\n` +
        asErrors.map((s) => `  • ${s}`).join('\n'),
    );
  }

  return {
    nPort: nPort!,
    sNodeId: sNodeId!,
    sChunkBucket: sChunkBucket!,
    sSessionsTable: sSessionsTable!,
    sChunksTable: sChunksTable!,
    sStationsTable: sStationsTable!,
    nChunkDurationMs: nChunkDurationMs!,
    sAwsRegion: sAwsRegion!,
  };
}

// --- Field-level helpers ---

function fnRequireEnvString(
  sVar: string,
  oEnv: Record<string, string | undefined>,
  asErrors: string[],
): string | undefined {
  const sValue = oEnv[sVar];
  if (typeof sValue !== 'string' || sValue.trim() === '') {
    asErrors.push(`${sVar} is required but was ${sValue === undefined ? 'not set' : 'empty'}`);
    return undefined;
  }
  return sValue;
}

function fnRequireEnvPort(
  sVar: string,
  oEnv: Record<string, string | undefined>,
  asErrors: string[],
): number | undefined {
  const sValue = oEnv[sVar];
  if (sValue === undefined || sValue.trim() === '') {
    asErrors.push(`${sVar} is required but was not set`);
    return undefined;
  }
  const nValue = Number(sValue);
  // Valid TCP port range: 1–65535. Port 0 is valid for OS-assigned ports
  // but not appropriate for a production ingest listener.
  if (!Number.isInteger(nValue) || nValue < 1 || nValue > 65535) {
    asErrors.push(`${sVar} must be an integer between 1 and 65535 (got "${sValue}")`);
    return undefined;
  }
  return nValue;
}

function fnRequireEnvPositiveInt(
  sVar: string,
  oEnv: Record<string, string | undefined>,
  asErrors: string[],
): number | undefined {
  const sValue = oEnv[sVar];
  if (sValue === undefined || sValue.trim() === '') {
    asErrors.push(`${sVar} is required but was not set`);
    return undefined;
  }
  const nValue = Number(sValue);
  if (!Number.isInteger(nValue) || nValue < 1) {
    asErrors.push(`${sVar} must be a positive integer (got "${sValue}")`);
    return undefined;
  }
  return nValue;
}
