import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  ApplicationListResponseModel,
  CreateApplicationModel,
} from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';

import * as ApplicationSelectors from './application.selectors';

export { ApplicationSelectors };

export interface ApplicationState {
  loading: boolean;
  error: boolean;
  application: CreateApplicationModel | null;
  appDetails: (DialAIEntityModel & { completionUrl: string }) | undefined;
  applications: ApplicationListResponseModel[];
}

const initialState: ApplicationState = {
  loading: false,
  error: false,
  application: null,
  appDetails: undefined,
  applications: [],
};

export const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    create: (
      state,
      _action: PayloadAction<{
        applicationName: string;
        applicationData: Omit<DialAIEntityModel, 'id' | 'reference'> & {
          completionUrl: string;
        };
      }>,
    ) => {
      state.loading = false;
    },
    createSuccess: (state, action: PayloadAction<CreateApplicationModel>) => {
      state.loading = false;
      state.application = action.payload;
    },
    createFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    list: (state) => {
      state.loading = true;
    },
    listSuccess: (
      state,
      action: PayloadAction<ApplicationListResponseModel[]>,
    ) => {
      state.loading = false;
      state.applications = action.payload;
    },
    listFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    delete: (
      state,
      _action: PayloadAction<{
        currentEntityName: string;
        currentEntityId: string;
      }>,
    ) => {
      state.loading = true;
    },
    deleteSuccess: (state, _action: PayloadAction<void>) => {
      state.loading = false;
    },
    deleteFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    edit: (
      state,
      _action: PayloadAction<{
        oldApplicationName: string;
        applicationData: DialAIEntityModel & { completionUrl: string };
        currentReference: string;
      }>,
    ) => {
      state.loading = true;
    },
    editSuccess: (state, action: PayloadAction<CreateApplicationModel>) => {
      state.loading = false;
      state.application = action.payload;
    },
    editFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    move: (
      state,
      _action: PayloadAction<{
        oldApplicationName: string;
        applicationData: DialAIEntityModel & { completionUrl: string };
        currentReference: string;
      }>,
    ) => {
      state.loading = true;
    },
    get: (state, _action: PayloadAction<string>) => {
      state.loading = true;
    },
    getSuccess: (
      state,
      action: PayloadAction<DialAIEntityModel & { completionUrl: string }>,
    ) => {
      state.loading = false;
      state.appDetails = action.payload;
    },
    getFail: (state) => {
      state.loading = false;
      state.error = true;
    },
  },
});

export const ApplicationActions = applicationSlice.actions;

export default applicationSlice.reducer;
