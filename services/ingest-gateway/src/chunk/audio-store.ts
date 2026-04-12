// S3 audio store — writes raw chunk bytes to S3.
//
// IS3AudioStore defines the single write operation the assembler needs.
// S3AudioStore is the production implementation using the AWS SDK.
//
// Why separate from the chunk metadata store?
// The two writes have different failure modes and different AWS services.
// Keeping them separate makes each independently swappable in tests and
// makes the failure path in the assembler explicit:
//   S3 write succeeds → DynamoDB write starts
//   S3 write fails    → DynamoDB write is skipped (guardrail from the plan)
//
// S3 key layout:
//   chunks/{station_id}/{session_id}/{sequence_no_padded}.{ext}
//
// Example:
//   chunks/station_001/550e8400-e29b-41d4-a716.../000042.mp3
//
// The leading zeros on sequence_no make lexicographic and numeric sort
// order identical, which matters for any tooling that lists objects by key.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { TChunkCodec } from '@radio-clipper/contracts';

/** Everything needed to describe one chunk write to S3. */
export type TChunkWriteRequest = {
  /** Destination S3 bucket. Comes from TGatewayEnv.sChunkBucket. */
  sBucket: string;
  /** Full S3 object key, including prefix and filename. */
  sKey: string;
  /** Raw audio bytes to store. */
  oData: Uint8Array;
  /** Used to set the correct Content-Type header on the S3 object. */
  eCodec: TChunkCodec;
};

/**
 * The one write operation the assembler needs from a storage backend.
 * Inject a stub in tests — no S3 bucket or AWS credentials required.
 */
export interface IS3AudioStore {
  fnPutChunk(oRequest: TChunkWriteRequest): Promise<void>;
}

/**
 * Production IS3AudioStore backed by the AWS SDK S3Client.
 *
 * Construct once per gateway process:
 *   const oS3 = new S3Client({ region: sAwsRegion });
 *   const oAudioStore = new S3AudioStore(oS3);
 */
export class S3AudioStore implements IS3AudioStore {
  private readonly oClient: S3Client;

  constructor(oClient: S3Client) {
    this.oClient = oClient;
  }

  /**
   * Write chunk bytes to S3 with the correct Content-Type for the codec.
   *
   * Throws on any S3 error — the assembler catches this and skips the
   * DynamoDB metadata write, keeping the two stores in sync.
   */
  async fnPutChunk(oRequest: TChunkWriteRequest): Promise<void> {
    await this.oClient.send(
      new PutObjectCommand({
        Bucket: oRequest.sBucket,
        Key: oRequest.sKey,
        Body: oRequest.oData,
        ContentType: fnCodecToContentType(oRequest.eCodec),
        // ContentLength lets S3 validate the upload without reading the stream twice.
        ContentLength: oRequest.oData.byteLength,
      }),
    );
  }
}

// --- Helpers ---

/**
 * Build the S3 key for one chunk.
 *
 * Exported so the assembler and any future tooling use the same format.
 * Changing this format breaks existing object paths — treat it as a schema.
 */
export function fnBuildChunkS3Key(
  sStationId: string,
  sSessionId: string,
  nSequenceNo: number,
  eCodec: TChunkCodec,
): string {
  // Zero-pad sequence number to 6 digits so lexicographic order matches
  // numeric order up to 999,999 chunks per session (~69 days at 6 s chunks).
  const sSeq = String(nSequenceNo).padStart(6, '0');
  const sExt = fnCodecToExtension(eCodec);
  return `chunks/${sStationId}/${sSessionId}/${sSeq}.${sExt}`;
}

function fnCodecToContentType(eCodec: TChunkCodec): string {
  switch (eCodec) {
    case 'mp3':  return 'audio/mpeg';
    case 'aac':  return 'audio/aac';
    case 'opus': return 'audio/ogg; codecs=opus';
  }
}

function fnCodecToExtension(eCodec: TChunkCodec): string {
  switch (eCodec) {
    case 'mp3':  return 'mp3';
    case 'aac':  return 'aac';
    case 'opus': return 'opus';
  }
}
