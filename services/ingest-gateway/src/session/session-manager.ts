// SessionManager — processes adapter lifecycle events and owns the heartbeat clock.
//
// The adapter (ShoutcastSourceAdapter) emits TSessionLifecycleEvent objects
// whenever something meaningful happens to the connection. SessionManager
// listens to those events and translates them into DynamoDB writes via ISessionStore.
//
// The manager also runs its own periodic heartbeat timer. This is separate from
// the adapter because the heartbeat is about proving the session is still alive
// in DynamoDB — it has nothing to do with audio frame arrival. A station could
// theoretically stop sending audio while staying connected; the heartbeat would
// still fire and update last_heartbeat_at.
//
// Wiring example (expanded in server.ts, step 6):
//
//   const oManager = new SessionManager(oStore, { nHeartbeatIntervalMs: 20_000 });
//   oAdapter.fnOnSessionEvent((oEvent) => void oManager.fnHandleEvent(oEvent));
//   oAdapter.fnOnError((oErr) => oManager.fnHandleError(oErr));
//   await oAdapter.fnConnect(oStationConfig);
//
// Error handling philosophy:
//   Store errors (DynamoDB failures) are caught here and passed to the registered
//   error handler. They do not throw back to the adapter — a DynamoDB hiccup must
//   not kill the audio pipeline. The error is logged and the session continues.
//   If the error handler is not set, errors are written to stderr as a fallback.

import type {
  TSessionHeartbeatEvent,
  TSessionLifecycleEvent,
} from '@radio-clipper/contracts';
import type { ISessionStore, TSessionCreateRecord } from './session-store.js';

export type TSessionManagerOptions = {
  /**
   * How often (in ms) the manager writes a heartbeat to DynamoDB.
   * Should be well under the operator's session-timeout threshold.
   * Recommended: 20_000 (20 seconds).
   */
  nHeartbeatIntervalMs: number;
};

export class SessionManager {
  private readonly oStore: ISessionStore;
  private readonly nHeartbeatIntervalMs: number;

  // Active session state. Null when no session is live.
  private sCurrentStationId: string | null = null;
  private sCurrentSessionId: string | null = null;

  // The setInterval handle. Cleared when a session ends.
  private oHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // Optional error handler — set by the caller to route errors to their logger.
  private fnErrorHandler: ((oError: Error) => void) | null = null;
  // Optional heartbeat event handler so other components (for example health
  // tracking) can observe successful heartbeat writes without polling DynamoDB.
  private fnHeartbeatEventHandler:
    ((oEvent: TSessionHeartbeatEvent) => void) | null = null;

  constructor(oStore: ISessionStore, oOptions: TSessionManagerOptions) {
    this.oStore = oStore;
    this.nHeartbeatIntervalMs = oOptions.nHeartbeatIntervalMs;
  }

  /**
   * Register a handler for store errors and unexpected state.
   * If not set, errors fall back to console.error.
   */
  fnOnError(fnHandler: (oError: Error) => void): void {
    this.fnErrorHandler = fnHandler;
  }

  /**
   * Register a handler that receives session.heartbeat events after the
   * heartbeat write succeeds.
   */
  fnOnHeartbeatEvent(fnHandler: (oEvent: TSessionHeartbeatEvent) => void): void {
    this.fnHeartbeatEventHandler = fnHandler;
  }

  /**
   * Process one session lifecycle event from the adapter.
   *
   * This is the single entry point the adapter's fnOnSessionEvent callback
   * should point to. All state transitions happen here.
   *
   * Returns a promise so the caller can await it in tests. In production the
   * adapter fires this without awaiting — errors are routed to fnOnError.
   */
  async fnHandleEvent(oEvent: TSessionLifecycleEvent): Promise<void> {
    switch (oEvent.eType) {
      case 'session.created':
        await this.fnOnSessionCreated(oEvent);
        break;

      case 'session.heartbeat':
        // The adapter can emit heartbeat events, but the manager also fires
        // its own timer. Both paths call the same store method — no harm in
        // processing both.
        await this.fnOnHeartbeat(oEvent.sSessionId, oEvent.sStationId, oEvent.sOccurredAt);
        break;

      case 'session.reconnected':
        await this.fnOnSessionReconnected(oEvent);
        break;

      case 'session.ended':
        await this.fnOnSessionEnded(oEvent);
        break;
    }
  }

  /**
   * Surface an adapter-level error (socket error, credential failure) through
   * the same error channel as store errors. Lets the caller wire one handler
   * for both sources.
   */
  fnHandleAdapterError(oError: Error): void {
    this.fnEmitError(oError);
  }

  // --- Private event handlers ---

  private async fnOnSessionCreated(
    oEvent: Extract<TSessionLifecycleEvent, { eType: 'session.created' }>,
  ): Promise<void> {
    // Track current session so the heartbeat timer knows what to update.
    this.sCurrentStationId = oEvent.sStationId;
    this.sCurrentSessionId = oEvent.sSessionId;

    const oRecord: TSessionCreateRecord = {
      sStationId: oEvent.sStationId,
      sSessionId: oEvent.sSessionId,
      sIngestProtocol: oEvent.sIngestProtocol,
      sAdapterType: oEvent.sAdapterType,
      sStartedAt: oEvent.sStartedAt,
      sIngestNodeId: oEvent.sIngestNodeId,
    };

    try {
      await this.oStore.fnCreate(oRecord);
    } catch (oErr) {
      this.fnEmitError(fnWrapError('Session create failed', oErr));
      // Do not return — start the heartbeat anyway so the session has a chance
      // to recover if the DynamoDB write was a transient failure.
    }

    // Start the heartbeat timer after writing the record.
    // If create failed above, the heartbeat will keep retrying the update path
    // (which will also fail with ConditionExpression until the record exists,
    // but that failure is caught and logged — it does not crash the process).
    this.fnStartHeartbeat();
  }

  private async fnOnSessionReconnected(
    oEvent: Extract<TSessionLifecycleEvent, { eType: 'session.reconnected' }>,
  ): Promise<void> {
    // Update our local tracking in case the station or session changed.
    this.sCurrentStationId = oEvent.sStationId;
    this.sCurrentSessionId = oEvent.sSessionId;

    try {
      await this.oStore.fnReconnect(
        oEvent.sStationId,
        oEvent.sSessionId,
        oEvent.nReconnectCount,
        oEvent.sOccurredAt,
      );
    } catch (oErr) {
      this.fnEmitError(fnWrapError('Session reconnect update failed', oErr));
    }

    // Restart the heartbeat timer — the previous connection may have already
    // cleared it on its 'ended' event before the reconnect arrived.
    this.fnRestartHeartbeat();
  }

  private async fnOnSessionEnded(
    oEvent: Extract<TSessionLifecycleEvent, { eType: 'session.ended' }>,
  ): Promise<void> {
    // Stop the heartbeat before writing the terminal state.
    // This prevents a heartbeat firing between the end write and the timer
    // clearance, which would try to update a just-ended session.
    this.fnStopHeartbeat();

    const eStatus = oEvent.eReason === 'error' ? 'failed' : 'ended';

    try {
      await this.oStore.fnEnd(
        oEvent.sStationId,
        oEvent.sSessionId,
        oEvent.sEndedAt,
        eStatus,
      );
    } catch (oErr) {
      this.fnEmitError(fnWrapError('Session end update failed', oErr));
    }

    // Clear local state so a future session.created starts clean.
    this.sCurrentStationId = null;
    this.sCurrentSessionId = null;
  }

  private async fnOnHeartbeat(
    sSessionId: string,
    sStationId: string,
    sOccurredAt: string,
  ): Promise<void> {
    const oHeartbeatEvent: TSessionHeartbeatEvent = {
      eType: 'session.heartbeat',
      sSessionId,
      sStationId,
      sOccurredAt,
    };

    try {
      await this.oStore.fnHeartbeat(sStationId, sSessionId, sOccurredAt);
      // Emit only after the store update succeeds so downstream health state
      // reflects persisted heartbeat progress.
      this.fnHeartbeatEventHandler?.(oHeartbeatEvent);
    } catch (oErr) {
      this.fnEmitError(fnWrapError('Session heartbeat failed', oErr));
    }
  }

  // --- Heartbeat timer ---

  private fnStartHeartbeat(): void {
    this.fnStopHeartbeat(); // Clear any leftover timer before starting a new one.

    this.oHeartbeatTimer = setInterval(() => {
      // Capture the IDs at tick time. If the session ended between ticks,
      // these will be null and we skip the write rather than updating a
      // stale or non-existent record.
      const sStationId = this.sCurrentStationId;
      const sSessionId = this.sCurrentSessionId;

      if (!sStationId || !sSessionId) return;

      void this.fnOnHeartbeat(sSessionId, sStationId, new Date().toISOString());
    }, this.nHeartbeatIntervalMs);

    // Mark the timer as non-blocking so the process can exit cleanly if
    // everything else finishes — the timer should not keep Node alive alone.
    if (this.oHeartbeatTimer.unref) {
      this.oHeartbeatTimer.unref();
    }
  }

  private fnStopHeartbeat(): void {
    if (this.oHeartbeatTimer !== null) {
      clearInterval(this.oHeartbeatTimer);
      this.oHeartbeatTimer = null;
    }
  }

  private fnRestartHeartbeat(): void {
    this.fnStopHeartbeat();
    this.fnStartHeartbeat();
  }

  // --- Error routing ---

  private fnEmitError(oError: Error): void {
    if (this.fnErrorHandler) {
      this.fnErrorHandler(oError);
    } else {
      // Fallback so errors are never silently swallowed when no handler is set.
      console.error('[SessionManager]', oError.message, oError);
    }
  }
}

// Wrap an unknown caught value in an Error with a context prefix.
// Using 'unknown' for caught values is required by TypeScript strict mode.
function fnWrapError(sContext: string, oErr: unknown): Error {
  const sMessage = oErr instanceof Error ? oErr.message : String(oErr);
  return new Error(`${sContext}: ${sMessage}`);
}
