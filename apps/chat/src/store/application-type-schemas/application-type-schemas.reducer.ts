import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface ApplicationTypesSchemasState {
  schemasLoading: UploadStatus;
  schemaDetailsLoading: UploadStatus;
  schemas: any[];
  selectedSchema: any | undefined;
}

const initialState: ApplicationTypesSchemasState = {
  schemasLoading: UploadStatus.UNINITIALIZED,
  schemaDetailsLoading: UploadStatus.UNINITIALIZED,
  schemas: [],
  selectedSchema: undefined,
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
    fetchSchemasSuccess: (state, action: PayloadAction<{ schemas: any[] }>) => {
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
