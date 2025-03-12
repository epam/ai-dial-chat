import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  ApiDetailedApplicationTypeSchema,
  ApplicationTypeSchema,
} from '@/src/types/application-type-schema';

import * as ApplicationTypesSchemasSelectors from './applicationTypeSchemas.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';

export { ApplicationTypesSchemasSelectors };

export interface ApplicationTypesSchemasState {
  schemasLoading: UploadStatus;
  schemas: ApplicationTypeSchema[];
  detailedApplicationTypeSchema: ApiDetailedApplicationTypeSchema | null;
  detailedApplicationTypeSchemaLoading: UploadStatus;
}

const initialState: ApplicationTypesSchemasState = {
  schemasLoading: UploadStatus.UNINITIALIZED,
  schemas: [],
  detailedApplicationTypeSchema: null,
  detailedApplicationTypeSchemaLoading: UploadStatus.UNINITIALIZED,
};

export const applicationTypesSchemasSlice = createSlice({
  name: 'applicationTypesSchemas',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.schemasLoading = UploadStatus.LOADED;
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
    fetchDetailedApplicationTypeSchema: (
      state,
      _action: PayloadAction<string>,
    ) => {
      state.detailedApplicationTypeSchemaLoading = UploadStatus.LOADING;
    },
    fetchDetailedApplicationTypeSchemaSuccess: (
      state,
      action: PayloadAction<{ schema: ApiDetailedApplicationTypeSchema }>,
    ) => {
      state.detailedApplicationTypeSchemaLoading = UploadStatus.LOADED;
      state.detailedApplicationTypeSchema = action.payload.schema;
    },
    fetchDetailedApplicationTypeSchemaFail: (state) => {
      state.detailedApplicationTypeSchemaLoading = UploadStatus.FAILED;
    },
    resetDetailedApplicationTypeSchema: (state) => {
      state.detailedApplicationTypeSchema = null;
      state.detailedApplicationTypeSchemaLoading = UploadStatus.UNINITIALIZED;
    },
  },
});

export const ApplicationTypesSchemasActions =
  applicationTypesSchemasSlice.actions;

export default applicationTypesSchemasSlice.reducer;
