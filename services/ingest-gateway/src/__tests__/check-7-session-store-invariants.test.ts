// Validation check 7: live_sessions reconnect update preserves status invariants.
//
// Goal:
//   Reconnect transitions a record back to live state without leaving stale
//   terminal markers behind.
//
// Why this matters:
//   If reconnect sets status='live' but keeps ended_at populated, downstream
//   readers get contradictory session state.

import { describe, it, expect } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { DynamoSessionStore } from '../session/session-store.js';

describe('check 7 — session store reconnect invariants', () => {
  it('clears ended_at when reconnect transitions a session back to live', async () => {
    const aSentCommands: Array<{ input: Record<string, unknown> }> = [];

    // Minimal DocumentClient spy: capture command payloads without touching AWS.
    const oClient = {
      async send(oCommand: { input: Record<string, unknown> }): Promise<void> {
        aSentCommands.push(oCommand);
      },
    } as unknown as DynamoDBDocumentClient;

    const oStore = new DynamoSessionStore(oClient, 'live_sessions');

    await oStore.fnReconnect(
      'station_001',
      'session_abc',
      1,
      '2026-04-12T10:00:00.000Z',
    );

    expect(aSentCommands).toHaveLength(1);

    const oInput = aSentCommands[0].input;
    expect(oInput['UpdateExpression']).toContain('ended_at = :null');

    const oExpressionValues = oInput['ExpressionAttributeValues'] as Record<string, unknown>;
    expect(oExpressionValues[':null']).toBeNull();
    expect(oExpressionValues[':live']).toBe('live');
  });
});
