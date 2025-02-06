import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';

import * as ApplicationTypesSchemasSelectors from './application-type-schemas.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';

export { ApplicationTypesSchemasSelectors };

export interface ApplicationTypesSchemasState {
  schemasLoading: UploadStatus;
  schemaDetailsLoading: UploadStatus;
  schemas: ApplicationTypeSchema[];
  selectedSchema: ApplicationTypeSchema | undefined;
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
