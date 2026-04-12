// Session store — the DynamoDB boundary for live_sessions records.
//
// ISessionStore defines the four operations the session manager needs.
// DynamoSessionStore is the production implementation.
//
// Why an interface instead of calling DynamoDB directly?
// The session manager is tested by passing a stub that satisfies ISessionStore.
// No real DynamoDB table or AWS credentials are needed to test session logic.
// In production, inject a DynamoSessionStore built from the real AWS client.
//
// DynamoDB table: live_sessions
//   pk  = station_id   (string)
//   sk  = session_id   (string)
//   GSI gsi1: pk = session_id            — look up a session without knowing its station
//   GSI gsi2: pk = status                — find all sessions in a given status
//
// All timestamps are ISO 8601 UTC strings, consistent with TLiveSession in contracts.

import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import type { TIngestProtocol } from '@radio-clipper/contracts';

// The fields written when a session is first created.
// Mirrors the TLiveSession type from contracts but includes only the
// immutable creation-time fields — mutable fields (heartbeat, status,
// reconnect_count, ended_at) are set by subsequent update operations.
export type TSessionCreateRecord = {
  sStationId: string;
  sSessionId: string;
  sIngestProtocol: TIngestProtocol;
  sAdapterType: string;
  sStartedAt: string;
  sIngestNodeId: string;
};

/**
 * The four DynamoDB operations the session manager needs.
 * Implement this interface with a stub in tests, DynamoSessionStore in production.
 */
export interface ISessionStore {
  /**
   * Write a new live_sessions item with status 'live'.
   * Throws if the write fails — the session manager will log and surface the error.
   */
  fnCreate(oRecord: TSessionCreateRecord): Promise<void>;

  /**
   * Update last_heartbeat_at for an active session.
   * Used by the session manager's periodic heartbeat timer.
   */
  fnHeartbeat(
    sStationId: string,
    sSessionId: string,
    sOccurredAt: string,
  ): Promise<void>;

  /**
   * Increment reconnect_count and update last_heartbeat_at.
   * Called when the encoder reconnects on an existing session.
   * nReconnectCount is the new total count after this reconnect.
   */
  fnReconnect(
    sStationId: string,
    sSessionId: string,
    nReconnectCount: number,
    sOccurredAt: string,
  ): Promise<void>;

  /**
   * Set ended_at and transition the session to a terminal status.
   * eStatus is 'ended' for clean disconnects, 'failed' for error disconnects.
   * Once ended, a session record is never written to again.
   */
  fnEnd(
    sStationId: string,
    sSessionId: string,
    sEndedAt: string,
    eStatus: 'ended' | 'failed',
  ): Promise<void>;
}

/**
 * Production ISessionStore backed by DynamoDB via the AWS SDK DocumentClient.
 *
 * Construct once per gateway process and inject it into SessionManager:
 *   const oClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
 *   const oStore = new DynamoSessionStore(oClient, sTableName);
 *   const oManager = new SessionManager(oStore, nHeartbeatIntervalMs);
 */
export class DynamoSessionStore implements ISessionStore {
  private readonly oClient: DynamoDBDocumentClient;
  private readonly sTableName: string;

  constructor(oClient: DynamoDBDocumentClient, sTableName: string) {
    this.oClient = oClient;
    this.sTableName = sTableName;
  }

  // Write a new session record with all creation-time fields.
  // status starts as 'live', reconnect_count starts at 0, ended_at starts null.
  async fnCreate(oRecord: TSessionCreateRecord): Promise<void> {
    await this.oClient.send(
      new PutCommand({
        TableName: this.sTableName,
        Item: {
          // DynamoDB primary key
          station_id: oRecord.sStationId,
          session_id: oRecord.sSessionId,

          // GSI keys — duplicated from primary key fields so the GSIs resolve
          gsi1_pk: oRecord.sSessionId,   // gsi1: look up by session_id alone
          gsi2_pk: 'live',               // gsi2: find all live sessions

          // Session identity and origin
          ingest_protocol: oRecord.sIngestProtocol,
          adapter_type: oRecord.sAdapterType,
          ingest_node_id: oRecord.sIngestNodeId,

          // Timestamps
          started_at: oRecord.sStartedAt,
          last_heartbeat_at: oRecord.sStartedAt,
          ended_at: null,

          // Mutable state
          status: 'live',
          reconnect_count: 0,

          // Delay fields start at 0; updated by transcription worker in a later slice
          monitor_delay_ms: 0,
          transcription_delay_ms: 0,
        },
        // Refuse to overwrite an existing session with the same key.
        // A duplicate session_id would indicate a bug in ID generation.
        ConditionExpression: 'attribute_not_exists(session_id)',
      }),
    );
  }

  // Update last_heartbeat_at. Status stays unchanged.
  // Uses attribute_exists guard so a heartbeat on a deleted item fails loudly.
  async fnHeartbeat(
    sStationId: string,
    sSessionId: string,
    sOccurredAt: string,
  ): Promise<void> {
    await this.oClient.send(
      new UpdateCommand({
        TableName: this.sTableName,
        Key: { station_id: sStationId, session_id: sSessionId },
        UpdateExpression: 'SET last_heartbeat_at = :ts',
        ConditionExpression: 'attribute_exists(session_id)',
        ExpressionAttributeValues: { ':ts': sOccurredAt },
      }),
    );
  }

  // Increment reconnect_count, update heartbeat, and ensure status is 'live'.
  // ADD on reconnect_count makes this safe under concurrent writes — DynamoDB
  // applies the add atomically, so two rapid reconnect events cannot both write
  // the same count value.
  //
  // Important invariant:
  // Reconnect revives the same logical session record, so ended_at must be
  // cleared back to null whenever status transitions back to live.
  async fnReconnect(
    sStationId: string,
    sSessionId: string,
    nReconnectCount: number,
    sOccurredAt: string,
  ): Promise<void> {
    await this.oClient.send(
      new UpdateCommand({
        TableName: this.sTableName,
        Key: { station_id: sStationId, session_id: sSessionId },
        // ADD increments atomically. SET updates heartbeat and status.
        // 'status' is a DynamoDB reserved word — use expression attribute name #st.
        UpdateExpression:
          'ADD reconnect_count :one SET last_heartbeat_at = :ts, #st = :live, gsi2_pk = :live, ended_at = :null',
        ConditionExpression: 'attribute_exists(session_id)',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':one': 1,
          ':ts': sOccurredAt,
          ':live': 'live',
          ':null': null,
        },
      }),
    );

    // nReconnectCount from the adapter is informational. The ADD above is the
    // authoritative increment. We accept the parameter for logging purposes only.
    void nReconnectCount;
  }

  // Transition the session to a terminal status and record ended_at.
  // Updates the gsi2_pk projection so the status GSI reflects the final state.
  async fnEnd(
    sStationId: string,
    sSessionId: string,
    sEndedAt: string,
    eStatus: 'ended' | 'failed',
  ): Promise<void> {
    await this.oClient.send(
      new UpdateCommand({
        TableName: this.sTableName,
        Key: { station_id: sStationId, session_id: sSessionId },
        UpdateExpression:
          'SET ended_at = :ts, #st = :finalStatus, gsi2_pk = :finalStatus',
        ConditionExpression: 'attribute_exists(session_id)',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':ts': sEndedAt,
          ':finalStatus': eStatus,
        },
      }),
    );
  }
}
