// Validation checks 4 & 5: chunk assembly and the S3 → DynamoDB write pipeline.
//
// Check 4: ChunkAssembler produces deterministic fixed-window chunks with
//          monotonically increasing sequence_no and correct timing fields.
//
// Check 5: S3 write happens before DynamoDB write; DynamoDB write is skipped
//          if S3 fails; orphan logging fires if DynamoDB fails after S3 succeeds.
//
// All AWS calls are replaced with in-memory stubs.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TNormalizedAudioFrame, TAudioChunkMetadata } from '@radio-clipper/contracts';
import { ChunkAssembler } from '../chunk/chunk-assembler.js';
import type { IS3AudioStore, TChunkWriteRequest } from '../chunk/audio-store.js';
import type { IChunkStore } from '../chunk/chunk-store.js';

// --- Stubs ---

// In-memory IS3AudioStore. Records every call so tests can assert on them.
function fnMakeS3Stub(bShouldFail = false): IS3AudioStore & {
  aCalls: TChunkWriteRequest[];
} {
  const stub = {
    aCalls: [] as TChunkWriteRequest[],
    async fnPutChunk(oRequest: TChunkWriteRequest): Promise<void> {
      if (bShouldFail) throw new Error('S3 write failed (stub)');
      stub.aCalls.push({ ...oRequest });
    },
  };
  return stub;
}

// In-memory IChunkStore. Records every call.
function fnMakeChunkStoreStub(bShouldFail = false): IChunkStore & {
  aCalls: TAudioChunkMetadata[];
} {
  const stub = {
    aCalls: [] as TAudioChunkMetadata[],
    async fnCreate(oMetadata: TAudioChunkMetadata): Promise<void> {
      if (bShouldFail) throw new Error('DynamoDB write failed (stub)');
      stub.aCalls.push({ ...oMetadata });
    },
  };
  return stub;
}

// Build a TNormalizedAudioFrame with explicit timing so tests control exactly
// how many frames fill a window.
function fnMakeFrame(
  nSequenceNo: number,
  nOffsetMs: number,
  nDurationMs: number,
  nBytes = 1600,
): TNormalizedAudioFrame {
  const sFrameStartedAt = new Date(
    new Date('2026-04-12T10:00:00.000Z').getTime() + nOffsetMs,
  ).toISOString();

  return {
    sSessionId: 'sess-001',
    sStationId: 'station_001',
    nSequenceNo,
    sFrameStartedAt,
    nOffsetMs,
    nDurationMs,
    oData: new Uint8Array(nBytes),
    eCodec: 'mp3',
    nSampleRateHz: 44100,
    nChannels: 2,
  };
}

// --- Check 4: chunk assembly ---

describe('check 4 — chunk assembly', () => {
  // Use 200ms chunk windows. Each frame is 100ms. Two frames fill one chunk.
  const N_CHUNK_MS = 200;
  const N_FRAME_MS = 100;

  let oS3: ReturnType<typeof fnMakeS3Stub>;
  let oStore: ReturnType<typeof fnMakeChunkStoreStub>;
  let oAssembler: ChunkAssembler;
  let aCompletedChunks: TAudioChunkMetadata[];

  beforeEach(() => {
    oS3 = fnMakeS3Stub();
    oStore = fnMakeChunkStoreStub();
    aCompletedChunks = [];
    oAssembler = new ChunkAssembler(oS3, oStore, {
      nChunkDurationMs: N_CHUNK_MS,
      sChunkBucket: 'test-bucket',
    });
    oAssembler.fnOnChunk((c) => aCompletedChunks.push(c));
  });

  it('does not flush until the target window is filled', async () => {
    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    // One frame of 100ms — window needs 200ms, should not flush yet
    expect(aCompletedChunks).toHaveLength(0);
    expect(oS3.aCalls).toHaveLength(0);
  });

  it('flushes exactly one chunk when the window is filled', async () => {
    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    await oAssembler.fnIngestFrame(fnMakeFrame(1, N_FRAME_MS, N_FRAME_MS));
    // Two frames × 100ms = 200ms — should flush one chunk
    expect(aCompletedChunks).toHaveLength(1);
  });

  it('sequence_no starts at 0 and increments monotonically', async () => {
    // Fill four frames → two complete chunks
    for (let i = 0; i < 4; i++) {
      await oAssembler.fnIngestFrame(fnMakeFrame(i, i * N_FRAME_MS, N_FRAME_MS));
    }
    expect(aCompletedChunks).toHaveLength(2);
    expect(aCompletedChunks[0].nSequenceNo).toBe(0);
    expect(aCompletedChunks[1].nSequenceNo).toBe(1);
  });

  it('chunk_started_at matches the first frame in the window', async () => {
    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    await oAssembler.fnIngestFrame(fnMakeFrame(1, N_FRAME_MS, N_FRAME_MS));

    const oChunk = aCompletedChunks[0];
    // chunk_started_at must equal the first frame's sFrameStartedAt
    expect(oChunk.sChunkStartedAt).toBe('2026-04-12T10:00:00.000Z');
  });

  it('chunk_ended_at = chunk_started_at + total duration', async () => {
    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    await oAssembler.fnIngestFrame(fnMakeFrame(1, N_FRAME_MS, N_FRAME_MS));

    const oChunk = aCompletedChunks[0];
    const nExpectedEndMs =
      new Date(oChunk.sChunkStartedAt).getTime() + oChunk.nDurationMs;
    expect(new Date(oChunk.sChunkEndedAt).getTime()).toBe(nExpectedEndMs);
  });

  it('start_offset_ms and end_offset_ms are derived from frame offsets', async () => {
    // Start second chunk at a non-zero offset to verify propagation
    for (let i = 0; i < 4; i++) {
      await oAssembler.fnIngestFrame(fnMakeFrame(i, i * N_FRAME_MS, N_FRAME_MS));
    }
    const oChunk2 = aCompletedChunks[1];
    expect(oChunk2.nStartOffsetMs).toBe(N_CHUNK_MS);      // 200ms
    expect(oChunk2.nEndOffsetMs).toBe(N_CHUNK_MS * 2);    // 400ms
  });

  it('total byte_size equals the sum of all frame bytes in the window', async () => {
    const nBytesPerFrame = 1600;
    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS, nBytesPerFrame));
    await oAssembler.fnIngestFrame(fnMakeFrame(1, N_FRAME_MS, N_FRAME_MS, nBytesPerFrame));

    expect(aCompletedChunks[0].nByteSize).toBe(nBytesPerFrame * 2);
  });

  it('checksum is a 64-character hex string (SHA-256)', async () => {
    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    await oAssembler.fnIngestFrame(fnMakeFrame(1, N_FRAME_MS, N_FRAME_MS));

    expect(aCompletedChunks[0].sChecksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fnFlushRemaining flushes a partial window on session end', async () => {
    // Push one frame (100ms) — below the 200ms threshold
    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    expect(aCompletedChunks).toHaveLength(0);

    // Session ends — partial chunk should still be written
    await oAssembler.fnFlushRemaining();
    expect(aCompletedChunks).toHaveLength(1);
    expect(aCompletedChunks[0].nDurationMs).toBe(N_FRAME_MS);
  });

  it('fnFlushRemaining is a no-op on an empty buffer', async () => {
    await oAssembler.fnFlushRemaining();
    expect(aCompletedChunks).toHaveLength(0);
    expect(oS3.aCalls).toHaveLength(0);
  });
});

// --- Check 5: S3 → DynamoDB write ordering ---

describe('check 5 — S3 write before DynamoDB write', () => {
  const N_CHUNK_MS = 200;
  const N_FRAME_MS = 100;

  it('writes S3 first, then DynamoDB', async () => {
    const aWriteOrder: string[] = [];

    const oS3: IS3AudioStore = {
      async fnPutChunk() { aWriteOrder.push('s3'); },
    };
    const oStore: IChunkStore = {
      async fnCreate() { aWriteOrder.push('dynamo'); },
    };

    const oAssembler = new ChunkAssembler(oS3, oStore, {
      nChunkDurationMs: N_CHUNK_MS,
      sChunkBucket: 'test-bucket',
    });

    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    await oAssembler.fnIngestFrame(fnMakeFrame(1, N_FRAME_MS, N_FRAME_MS));

    expect(aWriteOrder).toEqual(['s3', 'dynamo']);
  });

  it('skips DynamoDB write when S3 fails', async () => {
    const oS3 = fnMakeS3Stub(/* bShouldFail */ true);
    const oStore = fnMakeChunkStoreStub();
    const aErrors: string[] = [];

    const oAssembler = new ChunkAssembler(oS3, oStore, {
      nChunkDurationMs: N_CHUNK_MS,
      sChunkBucket: 'test-bucket',
    });
    oAssembler.fnOnError((e) => aErrors.push(e.message));

    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    await oAssembler.fnIngestFrame(fnMakeFrame(1, N_FRAME_MS, N_FRAME_MS));

    // S3 failed — DynamoDB must NOT have been called
    expect(oStore.aCalls).toHaveLength(0);
    // Error should have been reported
    expect(aErrors.length).toBeGreaterThan(0);
    expect(aErrors[0]).toContain('S3 write failed');
  });

  it('reports an error when DynamoDB fails after a successful S3 write', async () => {
    const oS3 = fnMakeS3Stub();
    const oStore = fnMakeChunkStoreStub(/* bShouldFail */ true);
    const aErrors: string[] = [];
    const aCompletedChunks: TAudioChunkMetadata[] = [];

    const oAssembler = new ChunkAssembler(oS3, oStore, {
      nChunkDurationMs: N_CHUNK_MS,
      sChunkBucket: 'test-bucket',
    });
    oAssembler.fnOnError((e) => aErrors.push(e.message));
    oAssembler.fnOnChunk((c) => aCompletedChunks.push(c));

    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    await oAssembler.fnIngestFrame(fnMakeFrame(1, N_FRAME_MS, N_FRAME_MS));

    // S3 succeeded — error came from DynamoDB
    expect(oS3.aCalls).toHaveLength(1);
    expect(aErrors.length).toBeGreaterThan(0);
    // Error message should mention the S3 key so the orphan is recoverable
    expect(aErrors[0]).toContain('chunks/station_001/sess-001/');
    // Chunk should NOT be emitted downstream — it is not fully persisted
    expect(aCompletedChunks).toHaveLength(0);
  });

  it('S3 key follows the expected format for clip export queries', async () => {
    const oS3 = fnMakeS3Stub();
    const oStore = fnMakeChunkStoreStub();

    const oAssembler = new ChunkAssembler(oS3, oStore, {
      nChunkDurationMs: N_CHUNK_MS,
      sChunkBucket: 'test-bucket',
    });

    await oAssembler.fnIngestFrame(fnMakeFrame(0, 0, N_FRAME_MS));
    await oAssembler.fnIngestFrame(fnMakeFrame(1, N_FRAME_MS, N_FRAME_MS));

    // Key must be: chunks/{stationId}/{sessionId}/{padded_seq}.{ext}
    expect(oS3.aCalls[0].sKey).toMatch(
      /^chunks\/station_001\/sess-001\/000000\.mp3$/,
    );
  });
});
