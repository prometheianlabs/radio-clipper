// Station ingest configuration — fields required at runtime when accepting a source connection.
// Mirrors the `stations` DynamoDB table. Only the fields consumed by Slice 02 ingest are here.
// Transcript, clip, and admin fields are deferred to later slices.

export type TIngestProtocol = 'shoutcast' | 'icecast' | 'webrtc_whip';

export type TStationStatus = 'active' | 'disabled';

export type TEncoderType = 'butt' | 'ffmpeg' | 'other';

export type TStationIngestConfig = {
  sStationId: string;
  sName: string;
  sSlug: string;
  eStatus: TStationStatus;
  ePrimaryIngestProtocol: TIngestProtocol;
  aFutureProtocolsEnabled: TIngestProtocol[];
  eEncoderType: TEncoderType;
  sIngestEndpoint: string;
  /** ARN of the Secrets Manager secret holding the source credential. */
  sCredentialSecretArn: string;
  nRetentionDays: number;
  sCreatedAt: string;
  sUpdatedAt: string;
};
