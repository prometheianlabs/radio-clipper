// Validation check 8: SessionManager heartbeat bridge for in-memory health tracking.
//
// Goal:
//   Ensure timer-driven heartbeat writes emit session.heartbeat events that can
//   be forwarded to IngestHealthTracker (as done in main.ts).

import { describe, it, expect, vi, afterEach } from 'vitest';

import type { ISessionStore, TSessionCreateRecord } from '../session/session-store.js';
import { SessionManager } from '../session/session-manager.js';

type TStoreStub = ISessionStore & {
  nHeartbeatCalls: number;
  bFailHeartbeat: boolean;
};

function fnMakeStoreStub(): TStoreStub {
  return {
    nHeartbeatCalls: 0,
    bFailHeartbeat: false,

    async fnCreate(_oRecord: TSessionCreateRecord): Promise<void> {},
    async fnReconnect(): Promise<void> {},
    async fnEnd(): Promise<void> {},

    async fnHeartbeat(): Promise<void> {
      this.nHeartbeatCalls += 1;
      if (this.bFailHeartbeat) {
        throw new Error('heartbeat write failed');
      }
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('check 8 — session manager heartbeat bridge', () => {
  it('emits heartbeat events after successful timer-driven heartbeat writes', async () => {
    vi.useFakeTimers();

    const oStore = fnMakeStoreStub();
    const oManager = new SessionManager(oStore, { nHeartbeatIntervalMs: 1_000 });
    const aHeartbeatEvents: Array<{
      sSessionId: string;
      sStationId: string;
      sOccurredAt: string;
    }> = [];

    oManager.fnOnHeartbeatEvent((oEvent) => {
      aHeartbeatEvents.push({
        sSessionId: oEvent.sSessionId,
        sStationId: oEvent.sStationId,
        sOccurredAt: oEvent.sOccurredAt,
      });
    });

    await oManager.fnHandleEvent({
      eType: 'session.created',
      sSessionId: 'session_001',
      sStationId: 'station_001',
      sStartedAt: '2026-04-12T10:00:00.000Z',
      sAdapterType: 'ShoutcastSourceAdapter',
      sIngestProtocol: 'shoutcast',
      sIngestNodeId: 'node-1',
    });

    await vi.advanceTimersByTimeAsync(1_100);

    expect(oStore.nHeartbeatCalls).toBeGreaterThan(0);
    expect(aHeartbeatEvents.length).toBeGreaterThan(0);
    expect(aHeartbeatEvents[0].sSessionId).toBe('session_001');
    expect(aHeartbeatEvents[0].sStationId).toBe('station_001');
  });

  it('does not emit heartbeat events when heartbeat writes fail', async () => {
    vi.useFakeTimers();

    const oStore = fnMakeStoreStub();
    oStore.bFailHeartbeat = true;

    const oManager = new SessionManager(oStore, { nHeartbeatIntervalMs: 1_000 });
    const aHeartbeatEvents: Array<{ sSessionId: string }> = [];

    oManager.fnOnHeartbeatEvent((oEvent) => {
      aHeartbeatEvents.push({ sSessionId: oEvent.sSessionId });
    });

    await oManager.fnHandleEvent({
      eType: 'session.created',
      sSessionId: 'session_001',
      sStationId: 'station_001',
      sStartedAt: '2026-04-12T10:00:00.000Z',
      sAdapterType: 'ShoutcastSourceAdapter',
      sIngestProtocol: 'shoutcast',
      sIngestNodeId: 'node-1',
    });

    await vi.advanceTimersByTimeAsync(1_100);

    expect(oStore.nHeartbeatCalls).toBeGreaterThan(0);
    expect(aHeartbeatEvents).toHaveLength(0);
  });
});
