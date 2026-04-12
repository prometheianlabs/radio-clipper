// ChunkAssembler — accumulates audio frames into fixed-window chunks and persists them.
//
// The adapter emits one TNormalizedAudioFrame per network read event. Those frames
// are small and variably sized. The assembler buffers them until enough audio has
// accumulated to fill one chunk window (e.g. 6 000 ms), then:
//
//   1. Concatenates all buffered frame bytes into one Uint8Array.
//   2. Computes a SHA-256 checksum of the bytes.
//   3. Writes the bytes to S3 via IS3AudioStore.
//   4. Writes the chunk metadata to DynamoDB via IChunkStore.
//      This step is SKIPPED if the S3 write failed.
//   5. Emits the completed TAudioChunkMetadata to any registered handler.
//
// Timing rules (from DATA-MODEL.md and the implementation plan):
//   - chunk_started_at  = sFrameStartedAt of the FIRST frame in the window
//   - chunk_ended_at    = chunk_started_at + total accumulated duration
//   - start_offset_ms   = nOffsetMs of the FIRST frame
//   - end_offset_ms     = start_offset_ms + total accumulated duration
//   - sequence_no       = monotonically increasing, never reset during a session
//
// These values come from the frame metadata the adapter already computed —
// we do NOT re-derive them from wall clock or byte counts here. The adapter
// owns the timing; the assembler owns the windowing.
//
// What happens on session end (fnFlushRemaining):
//   Any frames buffered at the point of disconnect are flushed as a short final
//   chunk. It will be shorter than nChunkDurationMs. The export worker handles
//   short terminal chunks correctly because it queries by time overlap, not
//   by assuming full-length chunks.

import { createHash } from 'node:crypto';

import type { TNormalizedAudioFrame, TAudioChunkMetadata } from '@radio-clipper/contracts';
import type { IS3AudioStore } from './audio-store.js';
import type { IChunkStore } from './chunk-store.js';
import { fnBuildChunkS3Key } from './audio-store.js';

export type TChunkAssemblerOptions = {
  /**
   * Target chunk window in milliseconds. Fixed per deployment.
   * Must match INGEST_CHUNK_DURATION_MS from TGatewayEnv.
   * Recommended: 6000 (6 seconds).
   */
  nChunkDurationMs: number;
  /** S3 bucket name. From TGatewayEnv.sChunkBucket. */
  sChunkBucket: string;
};

export class ChunkAssembler {
  private readonly oAudioStore: IS3AudioStore;
  private readonly oChunkStore: IChunkStore;
  private readonly nChunkDurationMs: number;
  private readonly sChunkBucket: string;

  // Frame buffer — accumulates frames until the window is full.
  private aFrameBuffer: TNormalizedAudioFrame[] = [];
  // Running total of buffered audio time in ms.
  private nBufferedDurationMs = 0;

  // Monotonically increasing chunk counter for this session.
  // Intentionally not reset on reconnect so sequence_no stays strictly increasing
  // across the full session lifetime, not just each connection leg.
  private nSequenceNo = 0;

  // Optional handler called with each completed chunk.
  // The transcription worker will register here in a later slice.
  private fnChunkHandler: ((oChunk: TAudioChunkMetadata) => void) | null = null;

  // Optional error handler for S3/DynamoDB failures.
  private fnErrorHandler: ((oError: Error) => void) | null = null;

  constructor(
    oAudioStore: IS3AudioStore,
    oChunkStore: IChunkStore,
    oOptions: TChunkAssemblerOptions,
  ) {
    this.oAudioStore = oAudioStore;
    this.oChunkStore = oChunkStore;
    this.nChunkDurationMs = oOptions.nChunkDurationMs;
    this.sChunkBucket = oOptions.sChunkBucket;
  }

  /** Called with each completed TAudioChunkMetadata after both stores succeed. */
  fnOnChunk(fnHandler: (oChunk: TAudioChunkMetadata) => void): void {
    this.fnChunkHandler = fnHandler;
  }

  /** Called when an S3 or DynamoDB write fails. */
  fnOnError(fnHandler: (oError: Error) => void): void {
    this.fnErrorHandler = fnHandler;
  }

  /**
   * Accept one audio frame from the adapter.
   *
   * Buffers the frame, then flushes if the accumulated duration has reached
   * or exceeded the target window. Returns a promise so the caller can apply
   * backpressure if needed — in practice the adapter fires this without awaiting.
   */
  async fnIngestFrame(oFrame: TNormalizedAudioFrame): Promise<void> {
    this.aFrameBuffer.push(oFrame);
    this.nBufferedDurationMs += oFrame.nDurationMs;

    if (this.nBufferedDurationMs >= this.nChunkDurationMs) {
      await this.fnFlush();
    }
  }

  /**
   * Flush any remaining buffered frames as a final (possibly short) chunk.
   *
   * Call this when the adapter emits session.ended so the last few seconds
   * of audio are not silently discarded. Safe to call on an empty buffer —
   * it no-ops if there are no frames.
   */
  async fnFlushRemaining(): Promise<void> {
    if (this.aFrameBuffer.length > 0) {
      await this.fnFlush();
    }
  }

  // --- Private ---

  private async fnFlush(): Promise<void> {
    // Move the buffered frames into a local variable and reset the buffer
    // before any async work. This way new frames arriving during the write
    // go into a fresh buffer and are not included in this chunk.
    const aFrames = this.aFrameBuffer.splice(0);
    this.nBufferedDurationMs = 0;

    if (aFrames.length === 0) return;

    const oFirst = aFrames[0];

    // --- Timing ---
    // Sum durations across all frames to get the exact window size.
    // Do not re-derive from wall clock — preserve the timing the adapter computed.
    const nTotalDurationMs = aFrames.reduce((nSum, oF) => nSum + oF.nDurationMs, 0);

    const sChunkStartedAt = oFirst.sFrameStartedAt;
    const sChunkEndedAt = new Date(
      new Date(sChunkStartedAt).getTime() + nTotalDurationMs,
    ).toISOString();

    const nStartOffsetMs = oFirst.nOffsetMs;
    const nEndOffsetMs = nStartOffsetMs + nTotalDurationMs;

    const nSequenceNo = this.nSequenceNo++;

    // --- Chunk ID ---
    // Format: {session_id}_{sequence_no_padded}
    // Readable in logs and sortable by sequence without parsing timestamps.
    const sChunkId = `${oFirst.sSessionId}_${String(nSequenceNo).padStart(6, '0')}`;

    // --- Concatenate bytes ---
    const oData = fnConcatFrames(aFrames);

    // --- Checksum ---
    // SHA-256 hex of the raw bytes. Verified on read by the export worker
    // to detect silent corruption or truncated S3 objects.
    const sChecksum = createHash('sha256').update(oData).digest('hex');

    // --- S3 key ---
    const sS3Key = fnBuildChunkS3Key(
      oFirst.sStationId,
      oFirst.sSessionId,
      nSequenceNo,
      oFirst.eCodec,
    );

    // --- S3 write ---
    // This MUST succeed before we attempt the DynamoDB write.
    // If it fails, we log the error and return without writing metadata.
    // The frames are gone — acceptable for v1 (noted as a known risk in the plan).
    try {
      await this.oAudioStore.fnPutChunk({
        sBucket: this.sChunkBucket,
        sKey: sS3Key,
        oData,
        eCodec: oFirst.eCodec,
      });
    } catch (oErr) {
      this.fnEmitError(fnWrapError(`S3 write failed for chunk ${sChunkId}`, oErr));
      // Do not fall through to the DynamoDB write.
      return;
    }

    // --- DynamoDB write ---
    // Only reached if S3 succeeded. If this fails, the S3 object is an orphan.
    // The error is logged with the S3 key so an operator can recover the record.
    const oMetadata: TAudioChunkMetadata = {
      sChunkId,
      sSessionId: oFirst.sSessionId,
      sStationId: oFirst.sStationId,
      nSequenceNo,
      sChunkStartedAt,
      sChunkEndedAt,
      nStartOffsetMs,
      nEndOffsetMs,
      sS3Key,
      eCodec: oFirst.eCodec,
      nSampleRateHz: oFirst.nSampleRateHz,
      nDurationMs: nTotalDurationMs,
      nByteSize: oData.byteLength,
      sChecksum,
    };

    try {
      await this.oChunkStore.fnCreate(oMetadata);
    } catch (oErr) {
      // Log S3 key explicitly so the orphaned object can be found and the
      // metadata row can be reconstructed manually if needed.
      this.fnEmitError(
        fnWrapError(
          `DynamoDB write failed for chunk ${sChunkId} (S3 object ${sS3Key} was written — manual recovery may be needed)`,
          oErr,
        ),
      );
      // Do not call fnChunkHandler — downstream components should only
      // process chunks that have been fully persisted in both stores.
      return;
    }

    // --- Emit completed chunk ---
    // Both writes succeeded. Notify any downstream handler (e.g. transcription
    // worker stub in a later slice).
    this.fnChunkHandler?.(oMetadata);
  }

  private fnEmitError(oError: Error): void {
    if (this.fnErrorHandler) {
      this.fnErrorHandler(oError);
    } else {
      console.error('[ChunkAssembler]', oError.message);
    }
  }
}

// --- Module-level helpers ---

/**
 * Concatenate the data bytes from an array of frames into one Uint8Array.
 *
 * Allocates a single buffer of the total size and copies each frame's
 * data into it. One allocation is cheaper than repeated concatenation
 * with temporary arrays.
 */
function fnConcatFrames(aFrames: TNormalizedAudioFrame[]): Uint8Array {
  const nTotal = aFrames.reduce((nSum, oF) => nSum + oF.oData.byteLength, 0);
  const oOut = new Uint8Array(nTotal);
  let nOffset = 0;
  for (const oFrame of aFrames) {
    oOut.set(oFrame.oData, nOffset);
    nOffset += oFrame.oData.byteLength;
  }
  return oOut;
}

function fnWrapError(sContext: string, oErr: unknown): Error {
  const sMessage = oErr instanceof Error ? oErr.message : String(oErr);
  return new Error(`${sContext}: ${sMessage}`);
}
