// Validation check 1: source credential validation and station config validation.
//
// Covers:
//   - fnParseSourcePassword correctly decodes Basic auth headers
//   - fnValidateStationConfig accepts valid records and rejects bad ones
//   - Disabled stations are refused before any connection is accepted

import { describe, it, expect } from 'vitest';
import { fnParseSourcePassword } from '../adapter/shoutcast-protocol.js';
import { fnValidateStationConfig } from '@radio-clipper/config';

// --- Shared test fixture ---

function fnBaseStation(): Record<string, unknown> {
  return {
    sStationId: 'station_001',
    sName: 'Test Station',
    sSlug: 'test-station',
    eStatus: 'active',
    ePrimaryIngestProtocol: 'shoutcast',
    aFutureProtocolsEnabled: [],
    eEncoderType: 'butt',
    sIngestEndpoint: 'localhost:8000',
    sCredentialSecretArn: 'arn:aws:secretsmanager:us-east-1:000:secret:test',
    nRetentionDays: 7,
    sCreatedAt: '2026-04-12T00:00:00Z',
    sUpdatedAt: '2026-04-12T00:00:00Z',
  };
}

// --- Credential parsing ---

describe('fnParseSourcePassword', () => {
  it('decodes a standard empty-username Basic auth header', () => {
    // BUTT sends ":password" encoded — no username, colon separator
    const sHeader = `Basic ${Buffer.from(':testpassword').toString('base64')}`;
    expect(fnParseSourcePassword(sHeader)).toBe('testpassword');
  });

  it('decodes a source:password Basic auth header', () => {
    // Some encoders use "source" as the username
    const sHeader = `Basic ${Buffer.from('source:testpassword').toString('base64')}`;
    expect(fnParseSourcePassword(sHeader)).toBe('testpassword');
  });

  it('returns null when the Authorization header is absent', () => {
    expect(fnParseSourcePassword(undefined)).toBeNull();
  });

  it('returns null when the header is not Basic auth', () => {
    expect(fnParseSourcePassword('Bearer sometoken')).toBeNull();
  });

  it('handles a password with special characters', () => {
    const sPassword = 'p@ssw0rd!#$%';
    const sHeader = `Basic ${Buffer.from(`:${sPassword}`).toString('base64')}`;
    expect(fnParseSourcePassword(sHeader)).toBe(sPassword);
  });
});

// --- Station config validation ---

describe('fnValidateStationConfig', () => {
  it('accepts a fully valid station record', () => {
    const oResult = fnValidateStationConfig(fnBaseStation());
    expect(oResult.bValid).toBe(true);
    if (oResult.bValid) {
      expect(oResult.oValue.sStationId).toBe('station_001');
      expect(oResult.oValue.ePrimaryIngestProtocol).toBe('shoutcast');
    }
  });

  it('rejects a null input', () => {
    const oResult = fnValidateStationConfig(null);
    expect(oResult.bValid).toBe(false);
  });

  it('rejects a record with a missing required field', () => {
    const oRaw = fnBaseStation();
    delete oRaw['sStationId'];
    const oResult = fnValidateStationConfig(oRaw);
    expect(oResult.bValid).toBe(false);
    if (!oResult.bValid) {
      expect(oResult.asErrors.some((s) => s.includes('sStationId'))).toBe(true);
    }
  });

  it('rejects an unknown ingest protocol', () => {
    const oRaw = { ...fnBaseStation(), ePrimaryIngestProtocol: 'rtmp' };
    const oResult = fnValidateStationConfig(oRaw);
    expect(oResult.bValid).toBe(false);
    if (!oResult.bValid) {
      expect(oResult.asErrors.some((s) => s.includes('ePrimaryIngestProtocol'))).toBe(true);
    }
  });

  it('rejects a non-positive retention days value', () => {
    const oRaw = { ...fnBaseStation(), nRetentionDays: 0 };
    const oResult = fnValidateStationConfig(oRaw);
    expect(oResult.bValid).toBe(false);
  });

  it('rejects a disabled station and names it in the error', () => {
    const oRaw = { ...fnBaseStation(), eStatus: 'disabled' };
    const oResult = fnValidateStationConfig(oRaw);
    expect(oResult.bValid).toBe(false);
    if (!oResult.bValid) {
      // The error message should name the station so operators can diagnose quickly
      expect(oResult.asErrors.some((s) => s.includes('station_001'))).toBe(true);
    }
  });

  it('returns all errors at once, not just the first one', () => {
    // Remove multiple required fields to confirm batch error reporting
    const oResult = fnValidateStationConfig({
      eStatus: 'active',
      ePrimaryIngestProtocol: 'shoutcast',
      eEncoderType: 'butt',
      nRetentionDays: 7,
      // Missing: sStationId, sName, sSlug, sIngestEndpoint, sCredentialSecretArn, dates
    });
    expect(oResult.bValid).toBe(false);
    if (!oResult.bValid) {
      expect(oResult.asErrors.length).toBeGreaterThan(1);
    }
  });
});
