import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';

import * as ApplicationTypesSchemasSelectors from './applicationTypeSchemas.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';

export { ApplicationTypesSchemasSelectors };

export interface ApplicationTypesSchemasState {
  schemasLoading: UploadStatus;
  schemas: ApplicationTypeSchema[];
}

const initialState: ApplicationTypesSchemasState = {
  schemasLoading: UploadStatus.UNINITIALIZED,
  schemas: [],
};

export const applicationTypesSchemasSlice = createSlice({
  name: 'applicationTypesSchemas',
  initialState,
  reducers: {
    init: (state) => {
      state.schemasLoading = UploadStatus.LOADING;
    },
    initFinish: (state) => {
      state.schemasLoading = UploadStatus.LOADED;
    },
    fetchSchemas: (state) => {
      state.schemasLoading = UploadStatus.LOADING;
    },
    fetchSchemasSuccess: (
      state,
      action: PayloadAction<{ schemas: ApplicationTypeSchema[] }>,
    ) => {
      state.schemasLoading = UploadStatus.LOADED;
      state.schemas = action.payload.schemas;
    },
    fetchSchemasFail: (state) => {
      state.schemasLoading = UploadStatus.FAILED;
    },
  },
});

export const ApplicationTypesSchemasActions =
  applicationTypesSchemasSlice.actions;

export default applicationTypesSchemasSlice.reducer;
