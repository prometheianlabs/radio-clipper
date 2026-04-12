// DynamoDB chunk store — writes audio_chunks metadata records.
//
// IChunkStore defines the single write operation the assembler needs.
// DynamoChunkStore is the production implementation.
//
// This write MUST only happen after the S3 audio write succeeds.
// The assembler enforces that ordering — this store does not check it.
//
// DynamoDB table: audio_chunks
//   pk  = session_id        (string)
//   sk  = chunk_started_at  (ISO 8601 string)
//   GSI gsi1: pk = station_id, sk = chunk_started_at
//             — query all chunks for a station within a time window
//
// The clip export worker uses this table to find every chunk that overlaps
// a requested clip window. See DATA-MODEL.md for the overlap query rules.

import {
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

import type { TAudioChunkMetadata } from '@radio-clipper/contracts';

/**
 * The one write operation the assembler needs.
 * Inject a stub in tests to avoid real DynamoDB calls.
 */
export interface IChunkStore {
  /**
   * Persist chunk metadata after a successful S3 write.
   * Throws on failure — the assembler logs the error and the S3 key
   * so the orphaned object can be recovered manually if needed.
   */
  fnCreate(oMetadata: TAudioChunkMetadata): Promise<void>;
}

/**
 * Production IChunkStore backed by DynamoDB via the AWS SDK DocumentClient.
 *
 * Construct once per gateway process:
 *   const oClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
 *   const oChunkStore = new DynamoChunkStore(oClient, sTableName);
 */
export class DynamoChunkStore implements IChunkStore {
  private readonly oClient: DynamoDBDocumentClient;
  private readonly sTableName: string;

  constructor(oClient: DynamoDBDocumentClient, sTableName: string) {
    this.oClient = oClient;
    this.sTableName = sTableName;
  }

  /**
   * Write one audio_chunks item.
   *
   * Uses attribute_not_exists guard so a duplicate chunk write fails loudly
   * rather than silently overwriting a valid record. Duplicates would indicate
   * a bug in the assembler's sequence number management.
   */
  async fnCreate(oMetadata: TAudioChunkMetadata): Promise<void> {
    await this.oClient.send(
      new PutCommand({
        TableName: this.sTableName,
        Item: {
          // DynamoDB primary key
          session_id:       oMetadata.sSessionId,
          chunk_started_at: oMetadata.sChunkStartedAt,

          // GSI projection — duplicated for the station-level time-window query
          gsi1_pk: oMetadata.sStationId,
          gsi1_sk: oMetadata.sChunkStartedAt,

          // Identity
          chunk_id:   oMetadata.sChunkId,
          station_id: oMetadata.sStationId,

          // Timing — these values are what the clip export overlap query uses
          chunk_ended_at:  oMetadata.sChunkEndedAt,
          start_offset_ms: oMetadata.nStartOffsetMs,
          end_offset_ms:   oMetadata.nEndOffsetMs,
          duration_ms:     oMetadata.nDurationMs,

          // Sequence
          sequence_no: oMetadata.nSequenceNo,

          // Audio properties
          s3_key:        oMetadata.sS3Key,
          codec:         oMetadata.eCodec,
          sample_rate_hz: oMetadata.nSampleRateHz,
          byte_size:     oMetadata.nByteSize,
          checksum:      oMetadata.sChecksum,
        },
        // Guard against duplicate writes — each chunk_started_at should be unique
        // within a session. A collision means the assembler has a timing bug.
        ConditionExpression:
          'attribute_not_exists(session_id) AND attribute_not_exists(chunk_started_at)',
      }),
    );
  }
}
