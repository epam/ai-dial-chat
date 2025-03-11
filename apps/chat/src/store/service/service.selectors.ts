import { RootState } from '@/src/types/store';

import { ServiceState } from './service.types';

const rootSelector = (state: RootState): ServiceState => state.service;

const selectIsSuccessfullySent = (state: RootState) =>
  rootSelector(state).isSuccessfullySent;

export const ServiceSelectors = { selectIsSuccessfullySent };
