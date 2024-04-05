import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { RootState } from '../index';

export interface ServiceState {
  isSuccessfullySent: true | undefined;
}

const initialState: ServiceState = {
  isSuccessfullySent: undefined,
};

export const serviceSlice = createSlice({
  name: 'service',
  initialState,
  reducers: {
    reportIssue: (
      state,
      _action: PayloadAction<{ title: string; description: string }>,
    ) => state,
    reportIssueSuccess: (state) => {
      state.isSuccessfullySent = true;
    },
    reportIssueFail: (state) => state,
    requestApiKey: (
      state,
      _action: PayloadAction<{
        access_scenario: string;
        business_reason: string;
        project_end: string;
        project_id: string;
        project_lead: string;
        project_stream: string;
        workload_pattern: string;
      }>,
    ) => state,
    requestApiKeySuccess: (state) => {
      state.isSuccessfullySent = true;
    },
    requestApiKeyFail: (state) => state,
    resetIsSuccessfullySent: (state) => {
      state.isSuccessfullySent = undefined;
    },
  },
});

const rootSelector = (state: RootState): ServiceState => state.service;

const selectIsSuccessfullySent = createSelector(
  [rootSelector],
  (state) => state.isSuccessfullySent,
);

export const ServiceSelectors = { selectIsSuccessfullySent };

export const ServiceActions = serviceSlice.actions;
