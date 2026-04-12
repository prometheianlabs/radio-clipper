// Contribution adapter interface — the protocol-agnostic ingest boundary.
// Any source adapter (Shoutcast v1, Icecast later, WebRTC/WHIP later) must satisfy this interface.
// Downstream code — chunker, session manager, transcription worker — must depend only on these types.

import type { TChunkCodec } from './chunk.js';
import type { TIngestProtocol, TStationIngestConfig } from '../station.js';
import type { TSessionLifecycleEvent } from './session.js';

/**
 * One fixed audio window emitted by the adapter after it accepts and normalizes source audio.
 * Shoutcast-specific framing, headers, and metadata must not appear in this type.
 * Use Uint8Array so this type is safe in both Node.js and browser environments.
 */
export type TNormalizedAudioFrame = {
  sSessionId: string;
  sStationId: string;
  /** Monotonically increasing within a session. */
  nSequenceNo: number;
  /** ISO 8601 UTC. Absolute time this frame's audio window starts. */
  sFrameStartedAt: string;
  /** Milliseconds from session start to this frame's audio window start. */
  nOffsetMs: number;
  nDurationMs: number;
  /** Raw audio bytes in the frame's codec/format. */
  oData: Uint8Array;
  eCodec: TChunkCodec;
  nSampleRateHz: number;
  nChannels: number;
};

/**
 * Protocol-agnostic contribution adapter.
 * One adapter instance handles one live station connection.
 */
export interface IContributionAdapter {
  /** Human-readable class name, e.g. "ShoutcastSourceAdapter". */
  readonly sAdapterType: string;
  /** Protocol this adapter handles. */
  readonly sProtocol: TIngestProtocol;

  /**
   * Start accepting the source connection described by oConfig.
   * Rejects if the credential is invalid or the connection cannot be established.
   */
  fnConnect(oConfig: TStationIngestConfig): Promise<void>;

  /**
   * Shut down the connection cleanly and emit a session.ended event.
   */
  fnDisconnect(): Promise<void>;

  /** Register a handler for normalized audio frames. Called for every frame produced. */
  fnOnFrame(fnHandler: (oFrame: TNormalizedAudioFrame) => void): void;

  /** Register a handler for session lifecycle events. */
  fnOnSessionEvent(fnHandler: (oEvent: TSessionLifecycleEvent) => void): void;

  /** Register a handler for unrecoverable adapter errors. */
  fnOnError(fnHandler: (oError: Error) => void): void;
}
