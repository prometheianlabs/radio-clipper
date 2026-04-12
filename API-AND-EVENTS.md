# API and Live Events

This is a contract outline, not a final OpenAPI document.

## Auth model

- users sign in through Amplify Auth
- Cognito issues JWTs
- REST and SSE endpoints validate Cognito access tokens or ID tokens as required
- role checks are based on Cognito groups

## API areas

### Stations

- `GET /stations`
- `GET /stations/:stationId`
- `GET /stations/:stationId/health`

### Live sessions

- `GET /stations/:stationId/live-session`
- `GET /sessions/:sessionId`
- `GET /sessions/:sessionId/transcript`
- `GET /sessions/:sessionId/chunks`

### Clips

- `POST /clips`
- `GET /clips/:clipId`
- `GET /stations/:stationId/clips`
- `POST /clips/:clipId/retry`

### Admin

- `GET /admin/stations`
- `GET /admin/stations/:stationId/diagnostics`
- `POST /admin/stations/:stationId/rotate-credential`
- `POST /admin/stations/:stationId/disable`
- `POST /admin/stations/:stationId/enable`

## Clip creation request

`POST /clips`

```json
{
  "stationId": "station_001",
  "sessionId": "sess_2026_04_12_a",
  "title": "Morning show quote",
  "selectedText": "we are opening phones after the break",
  "selectionStartedAt": "2026-04-12T15:18:23.420Z",
  "selectionEndedAt": "2026-04-12T15:18:29.880Z",
  "paddingPreMs": 1500,
  "paddingPostMs": 1000,
  "exportFormat": "mp3"
}
```

## Live updates

Use **SSE** for live server-to-client updates.

Connection endpoint:

`GET /events/stream`

The client opens one authenticated SSE connection after sign-in.

## Event envelope

```json
{
  "type": "transcript.final",
  "stationId": "station_001",
  "sessionId": "sess_2026_04_12_a",
  "occurredAt": "2026-04-12T15:18:23.100Z",
  "payload": {}
}
```

## Event types

### Stream events

- `stream.connected`
- `stream.disconnected`
- `stream.reconnecting`
- `stream.heartbeat`
- `stream.protocol`  
  payload includes current adapter and protocol

### Transcription events

- `transcript.partial`
- `transcript.final`
- `transcript.delay.updated`

### Clip events

- `clip.queued`
- `clip.processing`
- `clip.completed`
- `clip.failed`

### Admin events

- `station.credential.rotated`
- `station.disabled`
- `station.enabled`

## UI contract rules

- partial transcript text is not selectable
- finalized transcript items are the only authoritative basis for clipping
- the frontend must preserve selection state while new transcript items arrive
- the UI must not care whether the source arrived through Shoutcast, Icecast, or WebRTC once the live session exists
