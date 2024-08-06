import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  ApplicationDetailsResponse,
  ApplicationListResponseModel,
  CreateApplicationModel,
} from '@/src/types/applications';

export interface ApplicationState {
  loading: boolean;
  error: boolean;
  application: CreateApplicationModel | null;
  appDetails?: ApplicationDetailsResponse | undefined;
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
        applicationData: CreateApplicationModel;
      }>,
    ) => {
      state.loading = true;
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
    delete: (state, _action: PayloadAction<string>) => {
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
        applicationData: CreateApplicationModel;
        currentReference: string;
        oldApplicationId: string;
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
    getOne: (state, _action: PayloadAction<string>) => {
      state.loading = true;
    },
    getOneSuccess: (
      state,
      action: PayloadAction<ApplicationDetailsResponse>,
    ) => {
      state.loading = false;
      state.appDetails = action.payload;
    },
    getOneFail: (state) => {
      state.loading = false;
      state.error = true;
    },
  },
});

export const ApplicationActions = applicationSlice.actions;

export default applicationSlice.reducer;
