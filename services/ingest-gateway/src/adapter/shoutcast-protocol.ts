// Shoutcast v1 source protocol parsing.
//
// INTERNAL — nothing in this file is exported beyond the ingest-gateway service.
// The adapter uses these helpers to extract auth and audio parameters from an
// incoming HTTP SOURCE request. Once parsed, all downstream code works with
// protocol-agnostic types from @radio-clipper/contracts.
//
// Shoutcast source connection flow (from a BUTT encoder):
//   1. Encoder opens TCP connection to the ingest gateway port.
//   2. Sends an HTTP/1.0 request with the non-standard SOURCE method:
//        SOURCE /stream HTTP/1.0
//        Authorization: Basic <base64(":password")>
//        Content-Type: audio/mpeg
//        icy-name: My Station
//        icy-br: 128
//        icy-sr: 44100
//   3. Gateway authenticates and replies:  HTTP/1.0 200 OK
//   4. Encoder starts streaming audio bytes as the request body.
//
// Node.js's built-in http module accepts the SOURCE method via the 'request'
// event — no special handling needed for the method name itself.

import type { TChunkCodec } from '@radio-clipper/contracts';

// Parsed values from the ICY headers sent by the source encoder.
// All fields have safe defaults so a misconfigured encoder degrades gracefully.
export type TShoutcastSourceInfo = {
  /** Bitrate in kilobits per second. Derived from icy-br header. Default: 128. */
  nBitrateKbps: number;
  /** Sample rate in Hz. Derived from icy-sr header. Default: 44100. */
  nSampleRateHz: number;
  /** Channel count. Derived from icy-channels header. Default: 2 (stereo). */
  nChannels: number;
  /** Audio codec inferred from Content-Type header. Default: mp3. */
  eCodec: TChunkCodec;
  /** Station display name from icy-name header. May be empty. */
  sStationName: string;
};

/**
 * Extract the source password from an HTTP Authorization header.
 *
 * Shoutcast encoders send Basic auth with an empty username:
 *   Authorization: Basic <base64(":password")>
 *
 * Some encoders use "source" as the username:
 *   Authorization: Basic <base64("source:password")>
 *
 * We accept both. The password is everything after the first colon.
 * Returns null if the header is absent or malformed.
 *
 * @param sAuthHeader - Raw value of the Authorization header.
 */
export function fnParseSourcePassword(sAuthHeader: string | undefined): string | null {
  if (!sAuthHeader || !sAuthHeader.startsWith('Basic ')) {
    return null;
  }

  // Slice off "Basic " and decode the base64 payload.
  const sDecoded = Buffer.from(sAuthHeader.slice(6), 'base64').toString('utf8');

  // Everything after the first colon is the password.
  // If there is no colon, treat the entire string as the password
  // (some legacy encoders omit the username entirely).
  const nColonIndex = sDecoded.indexOf(':');
  return nColonIndex === -1 ? sDecoded : sDecoded.slice(nColonIndex + 1);
}

/**
 * Parse ICY metadata headers sent by the source encoder.
 *
 * Node.js lowercases all incoming HTTP header names, so we read
 * "icy-br" not "icy-BR". Missing headers fall back to safe defaults
 * rather than failing — a misbehaving encoder should still produce
 * audio, just with less-accurate timing metadata.
 *
 * @param oHeaders - The raw headers object from an IncomingMessage.
 */
export function fnParseShoutcastHeaders(
  oHeaders: Record<string, string | string[] | undefined>,
): TShoutcastSourceInfo {
  const nBitrateKbps = fnParseIntHeader(oHeaders['icy-br'], 128);
  const nSampleRateHz = fnParseIntHeader(oHeaders['icy-sr'], 44100);
  const nChannels = fnParseIntHeader(oHeaders['icy-channels'], 2);

  const sContentType = fnFirstString(oHeaders['content-type']) ?? 'audio/mpeg';
  const eCodec = fnDetectCodec(sContentType);

  const sStationName = fnFirstString(oHeaders['icy-name']) ?? '';

  return { nBitrateKbps, nSampleRateHz, nChannels, eCodec, sStationName };
}

/**
 * Infer the codec from a Content-Type value.
 *
 * Shoutcast encoders typically send audio/mpeg for MP3 streams.
 * AAC streams may use audio/aac or audio/aacp (AAC+).
 * Opus over Ogg uses audio/ogg.
 *
 * Defaults to mp3 for any unrecognised value — the most common case.
 */
export function fnDetectCodec(sContentType: string): TChunkCodec {
  const sLower = sContentType.toLowerCase();
  if (sLower.includes('aac') || sLower.includes('mp4a') || sLower.includes('aacp')) {
    return 'aac';
  }
  if (sLower.includes('opus') || sLower.includes('ogg')) {
    return 'opus';
  }
  return 'mp3';
}

/**
 * Estimate the duration of an audio buffer given its byte length and bitrate.
 *
 * Formula:
 *   durationMs = (bytes × 8 bits/byte) / (bitrateKbps × 1000 bits/ms)
 *              = (bytes × 8) / bitrateKbps
 *
 * This is an approximation — MP3 uses variable frame sizes and the bitrate
 * header value is nominal. For the purposes of chunk timing it is accurate
 * enough; sub-millisecond drift accumulates slowly across a session.
 *
 * Returns 0 if bitrateKbps is zero to avoid division by zero.
 */
export function fnEstimateFrameDurationMs(nBytes: number, nBitrateKbps: number): number {
  if (nBitrateKbps <= 0 || nBytes <= 0) return 0;
  return Math.round((nBytes * 8) / nBitrateKbps);
}

// --- Private helpers ---

// Pull a safe integer out of a header value that may be a string, array, or undefined.
function fnParseIntHeader(
  vHeader: string | string[] | undefined,
  nDefault: number,
): number {
  const sRaw = fnFirstString(vHeader);
  if (!sRaw) return nDefault;
  const nParsed = parseInt(sRaw, 10);
  return Number.isFinite(nParsed) && nParsed > 0 ? nParsed : nDefault;
}

// Node.js allows duplicate headers, which arrive as string[].
// We always want the first value.
function fnFirstString(vHeader: string | string[] | undefined): string | undefined {
  if (Array.isArray(vHeader)) return vHeader[0];
  return vHeader;
}
