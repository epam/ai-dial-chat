import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  ApplicationLogsType,
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';

import * as ApplicationSelectors from './application.selectors';

import { UploadStatus } from '@epam/ai-dial-shared';

export { ApplicationSelectors };

export interface ApplicationState {
  appLoading: UploadStatus;
  logsLoadingStatus: UploadStatus;
  appDetails: CustomApplicationModel | undefined;
  appLogs: ApplicationLogsType | undefined;
}

const initialState: ApplicationState = {
  appLoading: UploadStatus.UNINITIALIZED,
  logsLoadingStatus: UploadStatus.UNINITIALIZED,
  appDetails: undefined,
  appLogs: undefined,
};

export const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    create: (
      state,
      _action: PayloadAction<Omit<CustomApplicationModel, 'id' | 'reference'>>,
    ) => {
      state.appLoading = UploadStatus.LOADED;
    },
    createSuccess: (state) => {
      state.appLoading = UploadStatus.LOADED;
    },
    createFail: (state) => {
      state.appLoading = UploadStatus.FAILED;
    },
    delete: (state, _action: PayloadAction<DialAIEntityModel>) => {
      state.appLoading = UploadStatus.LOADING;
    },
    deleteSuccess: (state, _action: PayloadAction<void>) => {
      state.appLoading = UploadStatus.LOADED;
    },
    deleteFail: (state) => {
      state.appLoading = UploadStatus.FAILED;
    },
    edit: (state, _action: PayloadAction<CustomApplicationModel>) => {
      state.appLoading = UploadStatus.LOADING;
    },
    editSuccess: (state) => {
      state.appLoading = UploadStatus.LOADED;
    },
    editFail: (state) => {
      state.appLoading = UploadStatus.FAILED;
    },
    update: (
      state,
      _action: PayloadAction<{
        oldApplicationId: string;
        applicationData: CustomApplicationModel;
      }>,
    ) => {
      state.appLoading = UploadStatus.LOADING;
    },
    updateFail: (state) => {
      state.appLoading = UploadStatus.FAILED;
    },
    get: (state, _action: PayloadAction<string>) => {
      state.appLoading = UploadStatus.LOADING;
    },
    getSuccess: (state, action: PayloadAction<CustomApplicationModel>) => {
      state.appLoading = UploadStatus.LOADED;
      state.appDetails = action.payload;
    },
    getFail: (state) => {
      state.appLoading = UploadStatus.FAILED;
    },
    startUpdatingFunctionStatus: (
      state,
      _action: PayloadAction<{
        id: string;
        status: ApplicationStatus;
      }>,
    ) => state,
    continueUpdatingFunctionStatus: (
      state,
      _action: PayloadAction<{
        id: string;
        status: ApplicationStatus;
      }>,
    ) => state,
    updateFunctionStatus: (
      state,
      {
        payload,
      }: PayloadAction<{
        id: string;
        status: ApplicationStatus;
      }>,
    ) => {
      if (state.appDetails?.id === payload.id && state.appDetails?.function) {
        state.appDetails.function.status = payload.status;
      }
    },
    updateFunctionStatusFail: (
      state,
      _action: PayloadAction<{
        id: string;
        status: ApplicationStatus;
      }>,
    ) => state,
    getLogs: (state, _action: PayloadAction<string>) => {
      state.logsLoadingStatus = UploadStatus.LOADING;
    },
    getLogsSuccess: (
      state,
      { payload }: PayloadAction<ApplicationLogsType>,
    ) => {
      state.logsLoadingStatus = UploadStatus.LOADED;
      state.appLogs = payload;
    },
    getLogsFail: (state) => {
      state.logsLoadingStatus = UploadStatus.FAILED;
      state.appLogs = undefined;
    },
  },
});

export const ApplicationActions = applicationSlice.actions;

export default applicationSlice.reducer;
