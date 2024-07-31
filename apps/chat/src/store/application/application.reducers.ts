import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  ApplicationDetailsResponse,
  ApplicationListResponseModel,
  CreateApplicationModel,
  OpenAIApplicationListResponse,
  ReadOnlyAppDetailsResponse,
} from '@/src/types/applications';

export interface ApplicationState {
  loading: boolean;
  error: boolean;
  application: CreateApplicationModel | null;
  appDetails?: ApplicationDetailsResponse | undefined;
  appDetailsReadOnly: ReadOnlyAppDetailsResponse | null;
  applications: ApplicationListResponseModel[];
  openaiApplications: OpenAIApplicationListResponse | null;
}

const initialState: ApplicationState = {
  loading: false,
  error: false,
  application: null,
  appDetails: undefined,
  appDetailsReadOnly: null,
  applications: [],
  openaiApplications: null,
};

export const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    create: (
      state,
      action: PayloadAction<{
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
    fetchDetails: (state, action: PayloadAction<string>) => {
      state.loading = true;
    },
    fetchDetailsSuccess: (
      state,
      action: PayloadAction<ApplicationDetailsResponse>,
    ) => {
      state.loading = false;
      state.appDetails = action.payload;
    },
    fetchDetailsFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    fetchReadOnlyAppDetails: (state, action: PayloadAction<string>) => {
      state.loading = true;
    },

    fetchReadOnlyAppDetailsSuccess: (
      state,
      action: PayloadAction<ReadOnlyAppDetailsResponse>,
    ) => {
      state.loading = false;
      state.appDetailsReadOnly = action.payload;
    },

    fetchReadOnlyAppDetailsFail: (state) => {
      state.loading = false;
      state.error = true;
    },

    fetchOpenAIApplications: (state) => {
      state.loading = true;
    },
    fetchOpenAIApplicationsSuccess: (
      state,
      action: PayloadAction<OpenAIApplicationListResponse>,
    ) => {
      state.loading = false;
      state.openaiApplications = action.payload;
    },
    fetchOpenAIApplicationsFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    delete: (state, action: PayloadAction<string>) => {
      state.loading = true;
    },
    deleteSuccess: (state, action: PayloadAction<void>) => {
      state.loading = false;
    },
    deleteFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    edit: (
      state,
      action: PayloadAction<{
        oldApplicationName: string;
        applicationData: CreateApplicationModel;
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
    getOne: (state, action: PayloadAction<string>) => {
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
