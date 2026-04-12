// Public surface of @radio-clipper/config.
//
// Two entry points for Slice 02:
//
//   fnValidateStationConfig — call before accepting a source connection.
//                             Takes a raw DynamoDB item, returns a typed
//                             TStationIngestConfig or a list of errors.
//
//   fnLoadGatewayEnv        — call once at gateway process startup.
//                             Reads process.env, throws if anything is missing.
//
// The TValidationResult type is re-exported so callers can type their
// own error-handling code without re-importing from validation.ts directly.

export { fnValidateStationConfig } from './station-config.js';
export { fnLoadGatewayEnv, type TGatewayEnv } from './gateway-env.js';
export { type TValidationResult } from './validation.js';
