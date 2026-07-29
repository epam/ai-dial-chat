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
import { MarketplaceEditorSteps } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';

import { ApplicationState } from './applications.types';

import { SharePermission, UploadStatus } from '@epam/ai-dial-shared';
import uniqBy from 'lodash-es/uniqBy';

const initialState: ApplicationState = {
  initialized: false,
  appLoading: UploadStatus.UNINITIALIZED,
  logsLoadingStatus: UploadStatus.UNINITIALIZED,
  appDetails: undefined,
  appLogs: undefined,
  publicFolders: [],
  logsEntityId: undefined,
  editorStep: MarketplaceEditorSteps.General,
  shouldTriggerEditorAutoUpdate: false,
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
    deleteSuccess: (state) => {
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
        redirectUrl?: URL | string;
        schema?: ApiDetailedApplicationTypeSchema;
        publicationUrl?: string;
        tabToOpen?: MarketplaceEditorSteps;
        isSaveAndExit?: boolean;
        shouldSelectApplication?: boolean;
        shouldSetEditorError?: boolean;
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
    setShouldTriggerEditorAutoUpdate: (
      state,
      { payload }: PayloadAction<boolean>,
    ) => {
      state.shouldTriggerEditorAutoUpdate = payload;
    },
    get: (
      state,
      _action: PayloadAction<{
        applicationId: string;
        isForSharing?: boolean;
        showCard?: boolean;
        acceptSharePermissions?: SharePermission[];
      }>,
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
        state.appDetails.functionStatus = payload.status;
      }
    },
    updateFunctionStatusFail: (
      state,
      _action: PayloadAction<{
        id: string;
        status: ApplicationStatus;
        traceId?: string;
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
    getLogsFail: (
      state,
      _action: PayloadAction<{ traceId?: string } | undefined>,
    ) => {
      state.logsLoadingStatus = UploadStatus.FAILED;
      state.appLogs = undefined;
    },
    updateStart: (state) => {
      state.appLoading = UploadStatus.LOADING;
    },
    updateComplete: (state) => {
      state.appLoading = UploadStatus.LOADED;
    },
    updateSuccess: (
      state,
      action: PayloadAction<{
        appDetails: CustomApplicationModel;
        isExitingAfterSave?: boolean;
      }>,
    ) => {
      state.appDetails = action.payload.appDetails;
    },
    setAppDetails: (
      state,
      { payload }: PayloadAction<CustomApplicationModel | undefined>,
    ) => {
      state.appDetails = payload;
      if (!payload) {
        state.appLoading = UploadStatus.UNINITIALIZED;
      }
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
        redirectUrl?: URL | string;
        shouldSelectApplication?: boolean;
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
    setSelectedWidget(state, { payload }: PayloadAction<string | undefined>) {
      state.selectedWidget = payload;
    },
    setLogsEntityId(state, { payload }: PayloadAction<string | undefined>) {
      state.logsEntityId = payload;
    },
    setEditorStep(state, { payload }: PayloadAction<MarketplaceEditorSteps>) {
      state.editorStep = payload;
    },
    initQueryParams: (state) => state,
    setEditorError: (state, { payload }: PayloadAction<string | undefined>) => {
      state.editorError = payload;
    },
    setEditorSelectedEntity: (
      state,
      { payload }: PayloadAction<ApplicationState['editorSelectedEntity']>,
    ) => {
      state.editorSelectedEntity = payload;
    },
  },
});

export const ApplicationActions = applicationSlice.actions;

export default applicationSlice.reducer;
