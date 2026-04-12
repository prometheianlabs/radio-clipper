# Data Model

This plan uses **DynamoDB for metadata** and **S3 for media objects**.

## Storage split

### DynamoDB stores

- station configuration
- live session state
- chunk metadata
- transcript items
- clip jobs
- completed clip records
- audit events

### S3 stores

- rolling audio chunks
- monitor stream assets
- final clip exports
- temporary export artifacts if needed

## Table strategy

Use a small number of purpose-built tables.  
Do not force a single-table design in v1.

## 1. `stations`

Purpose:
- station identity
- ingest configuration
- retention policy
- protocol settings

Keys:
- `pk = station_id`

Fields:
- `station_id`
- `name`
- `slug`
- `status`
- `primary_ingest_protocol` (`shoutcast`)
- `future_protocols_enabled` (array)
- `encoder_type` (`butt`, `ffmpeg`, other)
- `ingest_endpoint`
- `credential_secret_arn`
- `retention_days`
- `created_at`
- `updated_at`

## 2. `live_sessions`

Purpose:
- current and historical contribution sessions

Keys:
- `pk = station_id`
- `sk = session_id`

Fields:
- `session_id`
- `station_id`
- `ingest_protocol`
- `adapter_type`
- `started_at`
- `ended_at`
- `status`
- `last_heartbeat_at`
- `monitor_delay_ms`
- `transcription_delay_ms`
- `reconnect_count`
- `ingest_node_id`

GSIs:
- `gsi1pk = session_id`
- `gsi2pk = status`

## 3. `audio_chunks`

Purpose:
- map exact audio windows to stored objects

Chunk window:
- fixed windows such as **6 to 8 seconds**
- pick one value and keep it consistent inside a deployment

Keys:
- `pk = session_id`
- `sk = chunk_started_at`

Fields:
- `chunk_id`
- `session_id`
- `station_id`
- `sequence_no`
- `chunk_started_at`
- `chunk_ended_at`
- `start_offset_ms`
- `end_offset_ms`
- `s3_key`
- `codec`
- `sample_rate_hz`
- `duration_ms`
- `byte_size`
- `checksum`

GSI:
- `gsi1pk = station_id`
- `gsi1sk = chunk_started_at`

## 4. `transcript_items`

Purpose:
- persist transcript tokens/items with timing

Keys:
- `pk = session_id`
- `sk = "{started_at}#{item_id}"`

Fields:
- `item_id`
- `session_id`
- `station_id`
- `result_id`
- `text`
- `normalized_text`
- `item_type`
- `started_at`
- `ended_at`
- `start_offset_ms`
- `end_offset_ms`
- `confidence`
- `is_partial`
- `is_stable`
- `created_at`
- `updated_at`

GSI:
- `gsi1pk = station_id`
- `gsi1sk = started_at`

## 5. `clip_jobs`

Purpose:
- queue-facing clip request state

Keys:
- `pk = station_id`
- `sk = clip_job_id`

Fields:
- `clip_job_id`
- `station_id`
- `session_id`
- `created_by_user_id`
- `status`
- `selected_text`
- `selection_started_at`
- `selection_ended_at`
- `padding_pre_ms`
- `padding_post_ms`
- `requested_format`
- `failure_reason`
- `retry_count`
- `created_at`
- `updated_at`

GSI:
- `gsi1pk = session_id`
- `gsi1sk = created_at`

## 6. `clips`

Purpose:
- completed or historical exports

Keys:
- `pk = station_id`
- `sk = clip_id`

Fields:
- `clip_id`
- `clip_job_id`
- `station_id`
- `session_id`
- `created_by_user_id`
- `title`
- `selected_text`
- `final_started_at`
- `final_ended_at`
- `duration_ms`
- `export_format`
- `export_s3_key`
- `created_at`

## 7. `audit_events`

Purpose:
- accountability and support

Keys:
- `pk = entity_scope`
- `sk = "{occurred_at}#{event_id}"`

Fields:
- `event_id`
- `entity_scope`
- `entity_id`
- `event_type`
- `actor_user_id`
- `metadata`
- `occurred_at`

## Critical query: chunk overlap

For clip export, the worker must find all chunks that overlap the selected clip window `[T1, T2]`.

Do **not** query only for chunks that start inside the range. That misses the chunk that started before `T1` but still overlaps it.

Correct export logic:

1. query chunks where `chunk_started_at <= T2`
2. keep only the chunks where `chunk_ended_at >= T1`
3. stitch all overlapping chunks
4. trim precisely to the padded final interval

This overlap rule is mandatory.
