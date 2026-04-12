// Shared validation result type used by every validator in this package.
//
// Returns a discriminated union so callers can pattern-match on bValid
// without catching exceptions. This keeps error handling explicit and
// visible at the call site rather than hidden in try/catch blocks.
//
// Usage:
//   const oResult = fnValidateStationConfig(oRawRecord);
//   if (!oResult.bValid) {
//     logger.error('Station config rejected', { asErrors: oResult.asErrors });
//     return;
//   }
//   // oResult.oValue is TStationIngestConfig here

export type TValidationResult<T> =
  | { bValid: true; oValue: T }
  | { bValid: false; asErrors: string[] };

// Convenience helper — wraps a passing value.
export function fnPass<T>(oValue: T): TValidationResult<T> {
  return { bValid: true, oValue };
}

// Convenience helper — wraps one or more error messages.
export function fnFail<T>(asErrors: string[]): TValidationResult<T> {
  return { bValid: false, asErrors };
}
