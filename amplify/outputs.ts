export const oFrontendOutputPlan = {
  sConsumer: 'apps/web',
  asRequiredOutputs: [
    'auth-region',
    'user-pool-id',
    'user-pool-client-id',
    'identity-pool-id-if-needed',
    'api-base-url-placeholder',
  ],
  asDeferredOutputs: [
    's3-monitor-bucket-urls',
    'clip-library-bucket-urls',
    'service-endpoint-urls',
  ],
};