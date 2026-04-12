export type TUserGroup = 'producer' | 'admin' | 'platform_admin';

export const oAuthResourcePlan = {
  sProvider: 'Amplify Auth with Cognito',
  asUserGroups: ['producer', 'admin', 'platform_admin'] as TUserGroup[],
  asFrontendResponsibilities: [
    'sign-in',
    'sign-out',
    'guarded-routes',
    'current-user-role-inspection',
  ],
  asBackendResponsibilities: [
    'jwt-validation',
    'group-based-authorization',
    'environment-outputs-for-web-app',
  ],
};