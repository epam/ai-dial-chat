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
  appDetails: ApplicationDetailsResponse | null;
  appDetailsReadOnly: ReadOnlyAppDetailsResponse | null; 
  applications: ApplicationListResponseModel[];
  openaiApplications: OpenAIApplicationListResponse | null;
}

const initialState: ApplicationState = {
  loading: false, 
  error: false, 
  application: null,
  appDetails: null,
  appDetailsReadOnly: null,
  applications: [],
  openaiApplications: null,
};

export const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    // create: (state, action: PayloadAction<CreateApplicationModel>) => {
    //   state.loading = true;
    // },
    create: (state, action: PayloadAction<{ applicationName: string; applicationData: CreateApplicationModel }>) => {
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

    fetchReadOnlyAppDetailsSuccess: (state, action: PayloadAction<ReadOnlyAppDetailsResponse>) => {
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
    fetchOpenAIApplicationsSuccess: (state, action: PayloadAction<OpenAIApplicationListResponse>) => {
      state.loading = false;
      state.openaiApplications = action.payload;
    },
    fetchOpenAIApplicationsFail: (state) => {
      state.loading = false;
      state.error = true;
    },
  },
});

export const ApplicationActions = applicationSlice.actions;

export default applicationSlice.reducer;
