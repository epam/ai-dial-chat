import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { RequestAPIKeyBody } from '@/src/types/request-api-key';

import { ServiceState } from './service.types';

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
    requestApiKey: (state, _action: PayloadAction<RequestAPIKeyBody>) => state,
    requestApiKeySuccess: (state) => {
      state.isSuccessfullySent = true;
    },
    requestApiKeyFail: (state) => state,
    resetIsSuccessfullySent: (state) => {
      state.isSuccessfullySent = undefined;
    },
  },
});

export { ServiceSelectors } from './service.selectors';

export const ServiceActions = serviceSlice.actions;
