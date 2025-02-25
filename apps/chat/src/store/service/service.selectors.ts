import { createSelector } from '@reduxjs/toolkit';

import { ServiceState } from '@/src/types/service';

import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState): ServiceState => state.service;

const selectIsSuccessfullySent = createSelector(
  [rootSelector],
  (state) => state.isSuccessfullySent,
);

export const ServiceSelectors = { selectIsSuccessfullySent };
