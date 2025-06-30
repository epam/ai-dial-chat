import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  getFolderFromId,
  getParentFolderIdsFromEntityId,
} from '@/src/utils/app/folders';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationLogsType,
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { ApplicationState } from './applications.types';

import { UploadStatus } from '@epam/ai-dial-shared';
import uniqBy from 'lodash-es/uniqBy';

const initialState: ApplicationState = {
  initialized: false,
  appLoading: UploadStatus.UNINITIALIZED,
  logsLoadingStatus: UploadStatus.UNINITIALIZED,
  appDetails: undefined,
  appLogs: undefined,
  shouldSaveApplication: false,
  exitAfterSave: false,
  publicFolders: [],
  hasUnsavedChanges: false,
  logsEntityId: undefined,
};

export const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    create: (
      state,
      _action: PayloadAction<{
        applicationData: Omit<CustomApplicationModel, 'id' | 'reference'>;
        slug?: string;
        schema?: ApiDetailedApplicationTypeSchema;
      }>,
    ) => {
      state.appLoading = UploadStatus.LOADING;
    },
    createSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        applicationData: CustomApplicationModel;
      }>,
    ) => {
      state.appLoading = UploadStatus.LOADED;
      state.appDetails = payload.applicationData;
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
    edit: (
      state,
      _action: PayloadAction<{
        oldApplication: CustomApplicationModel;
        updatedApplication: CustomApplicationModel;
        redirectUrl?: string;
        schema?: ApiDetailedApplicationTypeSchema;
      }>,
    ) => {
      state.appLoading = UploadStatus.LOADING;
    },
    editSuccess: (state) => {
      state.appLoading = UploadStatus.LOADED;
    },
    editFail: (
      state,
      {
        payload,
      }: PayloadAction<{
        oldApplication: CustomApplicationModel;
      }>,
    ) => {
      state.appDetails = payload.oldApplication;
      state.appLoading = UploadStatus.FAILED;
    },
    update: (
      state,
      {
        payload,
      }: PayloadAction<{
        oldApplication: CustomApplicationModel;
        applicationData: CustomApplicationModel;
        redirectUrl?: string;
        schema?: ApiDetailedApplicationTypeSchema;
        publicationUrl?: string;
      }>,
    ) => {
      state.appLoading = UploadStatus.LOADING;
      state.appDetails = payload.applicationData;
    },
    updateFail: (
      state,
      { payload }: PayloadAction<{ oldApplication: CustomApplicationModel }>,
    ) => {
      state.appDetails = payload.oldApplication;
      state.appLoading = UploadStatus.FAILED;
    },
    get: (
      state,
      _action: PayloadAction<{ applicationId: string; isForSharing?: boolean }>,
    ) => {
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
    updateStart: (state) => {
      state.appLoading = UploadStatus.LOADING;
    },
    updateComplete: (state) => {
      state.appLoading = UploadStatus.LOADED;
    },
    updateSuccess: (state, action: PayloadAction<CustomApplicationModel>) => {
      state.appDetails = action.payload;
    },
    setShouldSaveApplication: (state, action: PayloadAction<boolean>) => {
      state.shouldSaveApplication = action.payload;
    },
    setExitAfterSave: (state, action: PayloadAction<boolean>) => {
      state.exitAfterSave = action.payload;
    },
    enterEditMode: (
      state,
      _action: PayloadAction<{
        entity: { id: string; reference: string };
        applicationType: string;
        detailedApplicationTypeSchemaId?: string;
        publicationUrl?: string;
      }>,
    ) => {
      state.appLoading = UploadStatus.LOADING;
    },
    exitEditor: (
      state,
      _action: PayloadAction<{
        redirectUrl?: string;
      }>,
    ) => state,
    enterEditModeComplete: (state) => {
      state.appLoading = UploadStatus.LOADED;
    },
    setFolders: (state, { payload }: PayloadAction<string[]>) => {
      const folders = payload
        .flatMap((id) => getParentFolderIdsFromEntityId(id).slice(0, -1))
        .map((id) =>
          getFolderFromId(id, FeatureType.Application, UploadStatus.LOADED),
        );

      state.publicFolders = uniqBy(folders, 'id');
    },
    setReturnConversationIds(
      state,
      { payload }: PayloadAction<string[] | undefined>,
    ) {
      state.returnConversationIds = payload;
    },
    setHasUnsavedChanges(state, action: PayloadAction<boolean>) {
      state.hasUnsavedChanges = action.payload;
    },
    setSelectedWidget(state, { payload }: PayloadAction<string | undefined>) {
      state.selectedWidget = payload;
    },
    setLogsEntityId(state, { payload }: PayloadAction<string | undefined>) {
      state.logsEntityId = payload;
    },
    updateApplicationPublicationUrls(
      state,
      _action: PayloadAction<{
        publicationUrl?: string;
        oldApplicationId: string;
        newApplicationId: string;
      }>,
    ) {
      return state;
    },
  },
});

export const ApplicationActions = applicationSlice.actions;

export default applicationSlice.reducer;
