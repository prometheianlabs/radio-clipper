// Audio chunk metadata — mirrors the `audio_chunks` DynamoDB table.
// A chunk is one fixed-window segment of a live session's audio, written to S3.
// Chunk timing is derived from absolute UTC plus session offset, never from arrival clock.

export type TChunkCodec = 'mp3' | 'aac' | 'opus';

export type TAudioChunkMetadata = {
  sChunkId: string;
  sSessionId: string;
  sStationId: string;
  /** Monotonically increasing within a session. Used for ordering and gap detection. */
  nSequenceNo: number;
  /** ISO 8601 UTC. Start of the audio window this chunk covers. */
  sChunkStartedAt: string;
  /** ISO 8601 UTC. End of the audio window this chunk covers. */
  sChunkEndedAt: string;
  /** Milliseconds from session start to chunk start. */
  nStartOffsetMs: number;
  /** Milliseconds from session start to chunk end. */
  nEndOffsetMs: number;
  /** S3 object key for the stored audio data. */
  sS3Key: string;
  eCodec: TChunkCodec;
  nSampleRateHz: number;
  nDurationMs: number;
  nByteSize: number;
  /** SHA-256 hex digest of the chunk bytes, verified after S3 write. */
  sChecksum: string;
};
