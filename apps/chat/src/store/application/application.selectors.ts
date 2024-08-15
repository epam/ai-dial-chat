import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { ApplicationState } from './application.reducers';

const rootSelector = (state: RootState): ApplicationState => state.application;

export const selectIsLoading = createSelector([rootSelector], (state) => {
  return state.loading;
});

export const selectApplicationDetail = createSelector(
  [rootSelector],
  (state) => {
    return state.appDetails;
  },
);
