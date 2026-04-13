# BUTT Operator Setup — Shoutcast Ingest

This note tells a station operator exactly how to configure BUTT (Broadcast Using This Tool)
to connect to the Radio Clipper ingest gateway using the Shoutcast v1 source protocol.

BUTT is the recommended encoder for testing and for stations that do not already have
a dedicated encoder. Download it from https://danielnoethen.de/butt/

---

## What you need before you start

| Item | Where to find it |
|---|---|
| Ingest gateway hostname or IP | CloudFormation stack outputs → `IngestGatewayEndpoint`; in local dev use `localhost` |
| Ingest port | `INGEST_PORT` environment variable; default recommendation is `8000` |
| Source password | AWS Secrets Manager → the ARN in the station's `credential_secret_arn` field; in local dev use `SOURCE_PASSWORD` env var |
| Station ID | The `sStationId` value in the station's DynamoDB record |

---

## BUTT settings

Open BUTT → Settings → Main tab.

### Server block

| Field | Value |
|---|---|
| Type | **Shoutcast** |
| Address | Ingest gateway hostname or IP |
| Port | Ingest port (e.g. `8000`) |
| Password | Source password from Secrets Manager |

Leave the **Mount** field empty or set it to `/stream`. The ingest gateway accepts
any mount path on a SOURCE request — the station is identified by the credential,
not the path.

### Audio block

| Field | Recommended value | Notes |
|---|---|---|
| Codec | **MP3** | AAC is also accepted; MP3 is the most reliable with BUTT |
| Bitrate | **128 kbps** | Higher is fine; this value determines timing precision |
| Samplerate | **44100 Hz** | 48000 Hz is also accepted |
| Channel | **Stereo** | Mono is accepted |

The gateway reads the `icy-br` and `icy-sr` headers BUTT sends and uses them to
calculate per-frame audio duration. If these headers are wrong the chunk timing
will drift. Use the values above for predictable results.

### Stream info block (optional)

| Field | Value |
|---|---|
| Name | Anything — the gateway logs it but does not use it for routing |
| Genre | Anything |
| Description | Anything |

---

## Auto-reconnect settings

Open BUTT → Settings → Advanced tab.

| Setting | Value |
|---|---|
| Reconnect on connection loss | **On** |
| Reconnect timeout | **5 seconds** (or less) |

When BUTT loses its connection and reconnects, the ingest gateway:

1. Accepts the new SOURCE request on the same station credential.
2. Continues the **same session** — does not create a new one.
3. Increments `reconnect_count` on the `live_sessions` record.
4. Continues emitting audio chunks with monotonically increasing `sequence_no`
   and `start_offset_ms` values — the timing clock does not reset.

This means a short dropout followed by reconnect does **not** corrupt the
session record or the chunk timeline. The produced clip can still cover audio
that spans a reconnect boundary as long as both sides have corresponding chunks.

---

## Connecting in local development (no AWS)

For local development without real AWS credentials, the gateway has two stubs
that replace the real AWS lookups, plus an explicit in-memory local mode for
session and chunk persistence. Set these environment variables before
starting the gateway:

```bash
# Required by all startup paths
export INGEST_PORT=8000
export INGEST_NODE_ID=dev-node-1
export INGEST_CHUNK_BUCKET=local-stub
export INGEST_SESSIONS_TABLE=local-stub
export INGEST_CHUNKS_TABLE=local-stub
export INGEST_STATIONS_TABLE=local-stub
export INGEST_CHUNK_DURATION_MS=6000
export AWS_REGION=us-east-1
export INGEST_USE_IN_MEMORY_STORES=1

# Station config stub — replace field values with your test station
export STATION_CONFIG_JSON='{"sStationId":"station_001","sName":"Test Station","sSlug":"test","eStatus":"active","ePrimaryIngestProtocol":"shoutcast","aFutureProtocolsEnabled":[],"eEncoderType":"butt","sIngestEndpoint":"localhost:8000","sCredentialSecretArn":"arn:aws:secretsmanager:us-east-1:000000000000:secret:stub","nRetentionDays":7,"sCreatedAt":"2026-01-01T00:00:00Z","sUpdatedAt":"2026-01-01T00:00:00Z"}'

# Credential stub — must match the password entered in BUTT
export SOURCE_PASSWORD=testpassword1234
```

Then start the gateway:

```bash
cd services/ingest-gateway
node --experimental-strip-types src/main.ts
```

Or run the automated local proof path:

```bash
cd services/ingest-gateway
npm run validate:local
```

That script starts the real gateway in in-memory local mode, pushes a simulated
source stream through `/stream`, verifies chunk creation and reconnect behavior,
and prints JSON evidence you can paste into validation notes.

Configure BUTT with:
- Address: `localhost`
- Port: `8000`
- Password: `testpassword1234`

Click **Connect** in BUTT. The terminal should show the session created log line.

Check the health endpoint to confirm the session is active:

```bash
curl http://localhost:8000/health/stations/station_001
```

Expected response shape:

```json
{
  "sStationId": "station_001",
  "eStatus": "online",
  "sSessionId": "...",
  "sAdapterType": "ShoutcastSourceAdapter",
  "sIngestProtocol": "shoutcast",
  "sLastHeartbeatAt": "...",
  "nReconnectCount": 0,
  "oLatestChunk": null,
  "sCheckedAt": "..."
}
```

`oLatestChunk` will be null until the first full chunk window (6 s by default) is flushed.
After 6 seconds of connected audio it will show:

```json
"oLatestChunk": {
  "nSequenceNo": 0,
  "sChunkStartedAt": "...",
  "sChunkEndedAt": "...",
  "nDurationMs": 6000,
  "nSecondsSinceLastChunk": 1
}
```

---

## Validation checklist for Slice 02 sign-off

Run these checks against a real or simulated source before marking Slice 02 done.

- [ ] BUTT connects and the gateway logs `session.created`
- [ ] Health endpoint returns `eStatus: "online"` and a non-null `sSessionId`
- [ ] After 6+ seconds `oLatestChunk` shows a non-null entry with correct `nDurationMs`
- [ ] Disconnect BUTT and reconnect — health shows `nReconnectCount: 1`, session ID is unchanged
- [ ] Stop BUTT — health shows `eStatus: "offline"`
- [ ] Reconnect again — health shows `eStatus: "online"`, `nReconnectCount: 2`

With real AWS credentials, also verify:
- [ ] `live_sessions` DynamoDB item exists with correct fields after connection
- [ ] `audio_chunks` DynamoDB items appear with monotonic `sequence_no`
- [ ] S3 objects exist at the expected key prefix `chunks/{stationId}/{sessionId}/`
- [ ] `live_sessions` item has `status: ended` after BUTT stops

---

## Troubleshooting

**BUTT shows "Connection refused"**
The gateway is not running or is on a different port. Check `INGEST_PORT` and that
`main.ts` started without errors.

**BUTT shows "Invalid password"**
The `SOURCE_PASSWORD` env var does not match the password entered in BUTT.
They must be identical.

**Health endpoint shows `eStatus: offline` immediately after connecting**
The adapter received and rejected the SOURCE request. Check the gateway terminal
for the specific error (auth failure, adapter not ready, etc.).

**`oLatestChunk` stays null after 10+ seconds**
The chunk window has not been filled. Verify audio is actually flowing in BUTT
(the VU meter should be moving). Also check `INGEST_CHUNK_DURATION_MS` — if it
is very large the first chunk will take longer to flush.
