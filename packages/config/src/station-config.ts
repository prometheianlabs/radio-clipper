// Station ingest configuration validator.
//
// Called by the ingest gateway before it accepts a source connection.
// Reads a raw DynamoDB item (typed as unknown) and either returns a
// validated TStationIngestConfig or a list of human-readable errors.
//
// Why validate here rather than trusting DynamoDB?
// - A misconfigured station record should produce a clear error message,
//   not a runtime crash deep inside the adapter.
// - Validation runs once per connection attempt, so it is cheap.
// - This is the seam where we can enforce invariants (e.g. status === 'active')
//   before any Shoutcast-specific code runs.

import type {
  TStationIngestConfig,
  TIngestProtocol,
  TStationStatus,
  TEncoderType,
} from '@radio-clipper/contracts';

import { fnPass, fnFail, type TValidationResult } from './validation.js';

// The set of protocol values we actually accept. This list grows in later slices
// when Icecast and WebRTC adapters are added.
const KNOWN_PROTOCOLS: TIngestProtocol[] = ['shoutcast', 'icecast', 'webrtc_whip'];

const KNOWN_STATUSES: TStationStatus[] = ['active', 'disabled'];

const KNOWN_ENCODER_TYPES: TEncoderType[] = ['butt', 'ffmpeg', 'other'];

/**
 * Validate and narrow a raw DynamoDB station record to TStationIngestConfig.
 *
 * @param oRaw - The raw object read from DynamoDB (typed as unknown so the
 *               caller does not have to pre-cast it).
 * @returns TValidationResult — pass with the typed config, or fail with errors.
 */
export function fnValidateStationConfig(
  oRaw: unknown,
): TValidationResult<TStationIngestConfig> {
  const asErrors: string[] = [];

  // Guard: must be a plain object before we touch any fields.
  if (typeof oRaw !== 'object' || oRaw === null || Array.isArray(oRaw)) {
    return fnFail(['Station record is not an object']);
  }

  // Cast to a loose record so we can inspect individual fields.
  const oRecord = oRaw as Record<string, unknown>;

  // --- Required string fields ---
  // Each fnRequireString call adds to asErrors if the field is absent or empty.

  const sStationId = fnRequireString(oRecord, 'sStationId', asErrors);
  const sName = fnRequireString(oRecord, 'sName', asErrors);
  const sSlug = fnRequireString(oRecord, 'sSlug', asErrors);
  const sIngestEndpoint = fnRequireString(oRecord, 'sIngestEndpoint', asErrors);
  const sCredentialSecretArn = fnRequireString(oRecord, 'sCredentialSecretArn', asErrors);
  const sCreatedAt = fnRequireString(oRecord, 'sCreatedAt', asErrors);
  const sUpdatedAt = fnRequireString(oRecord, 'sUpdatedAt', asErrors);

  // --- Enum fields ---

  const eStatus = fnRequireEnum<TStationStatus>(
    oRecord,
    'eStatus',
    KNOWN_STATUSES,
    asErrors,
  );

  const ePrimaryIngestProtocol = fnRequireEnum<TIngestProtocol>(
    oRecord,
    'ePrimaryIngestProtocol',
    KNOWN_PROTOCOLS,
    asErrors,
  );

  const eEncoderType = fnRequireEnum<TEncoderType>(
    oRecord,
    'eEncoderType',
    KNOWN_ENCODER_TYPES,
    asErrors,
  );

  // --- Numeric fields ---

  const nRetentionDays = fnRequirePositiveInt(oRecord, 'nRetentionDays', asErrors);

  // --- Array of protocols ---

  const aFutureProtocolsEnabled = fnReadProtocolArray(
    oRecord,
    'aFutureProtocolsEnabled',
    asErrors,
  );

  // --- Business rule: refuse disabled stations before wiring up any connection ---

  if (eStatus === 'disabled') {
    asErrors.push(`Station "${sStationId ?? '?'}" is disabled — refusing connection`);
  }

  // If any field failed, surface all errors at once so the caller can log them together.
  if (asErrors.length > 0) {
    return fnFail(asErrors);
  }

  // All fields are known-good — the non-null assertions below are safe because
  // fnRequireString / fnRequireEnum / fnRequirePositiveInt only return undefined
  // when they add an error, and we already checked asErrors.length === 0 above.
  return fnPass<TStationIngestConfig>({
    sStationId: sStationId!,
    sName: sName!,
    sSlug: sSlug!,
    eStatus: eStatus!,
    ePrimaryIngestProtocol: ePrimaryIngestProtocol!,
    aFutureProtocolsEnabled: aFutureProtocolsEnabled ?? [],
    eEncoderType: eEncoderType!,
    sIngestEndpoint: sIngestEndpoint!,
    sCredentialSecretArn: sCredentialSecretArn!,
    nRetentionDays: nRetentionDays!,
    sCreatedAt: sCreatedAt!,
    sUpdatedAt: sUpdatedAt!,
  });
}

// --- Field-level helpers ---
// Each helper returns the typed value on success, or undefined on failure
// (while pushing a descriptive error into asErrors).

function fnRequireString(
  oRecord: Record<string, unknown>,
  sField: string,
  asErrors: string[],
): string | undefined {
  const vValue = oRecord[sField];
  if (typeof vValue !== 'string' || vValue.trim() === '') {
    asErrors.push(`Field "${sField}" must be a non-empty string (got ${JSON.stringify(vValue)})`);
    return undefined;
  }
  return vValue;
}

function fnRequireEnum<T extends string>(
  oRecord: Record<string, unknown>,
  sField: string,
  aAllowed: T[],
  asErrors: string[],
): T | undefined {
  const vValue = oRecord[sField];
  if (!aAllowed.includes(vValue as T)) {
    asErrors.push(
      `Field "${sField}" must be one of [${aAllowed.join(', ')}] (got ${JSON.stringify(vValue)})`,
    );
    return undefined;
  }
  return vValue as T;
}

function fnRequirePositiveInt(
  oRecord: Record<string, unknown>,
  sField: string,
  asErrors: string[],
): number | undefined {
  const vValue = oRecord[sField];
  if (typeof vValue !== 'number' || !Number.isInteger(vValue) || vValue < 1) {
    asErrors.push(`Field "${sField}" must be a positive integer (got ${JSON.stringify(vValue)})`);
    return undefined;
  }
  return vValue;
}

function fnReadProtocolArray(
  oRecord: Record<string, unknown>,
  sField: string,
  asErrors: string[],
): TIngestProtocol[] | undefined {
  const vValue = oRecord[sField];

  // An absent or undefined field is treated as an empty list — not an error.
  if (vValue === undefined || vValue === null) {
    return [];
  }

  if (!Array.isArray(vValue)) {
    asErrors.push(`Field "${sField}" must be an array (got ${JSON.stringify(vValue)})`);
    return undefined;
  }

  // Each element must be a known protocol. Collect all bad values before returning.
  const asInvalid: unknown[] = vValue.filter((v) => !KNOWN_PROTOCOLS.includes(v as TIngestProtocol));
  if (asInvalid.length > 0) {
    asErrors.push(
      `Field "${sField}" contains unknown protocols: ${JSON.stringify(asInvalid)}`,
    );
    return undefined;
  }

  return vValue as TIngestProtocol[];
}
