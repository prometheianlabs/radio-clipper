import { oAuthResourcePlan } from './auth/resource.js';
import { oCustomResourceBoundaries } from './custom-resources/resource-boundaries.js';
import { oFrontendOutputPlan } from './outputs.js';

export const oBackendScaffold = {
  sProject: 'radio-clipper',
  sSlice: 'slice-01-foundation',
  oAuthResourcePlan,
  oCustomResourceBoundaries,
  oFrontendOutputPlan,
};

export type TBackendScaffold = typeof oBackendScaffold;