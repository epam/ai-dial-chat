import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { ServiceState } from './service.types';

const rootSelector = (state: RootState): ServiceState => state.service;

const selectIsSuccessfullySent = createSelector(
  [rootSelector],
  (state) => state.isSuccessfullySent,
);

export const ServiceSelectors = { selectIsSuccessfullySent };
