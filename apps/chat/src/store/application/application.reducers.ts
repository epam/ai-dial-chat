import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { DialAIEntityModel } from '@/src/types/models';

import * as ApplicationSelectors from './application.selectors';

export { ApplicationSelectors };

export interface ApplicationState {
  loading: boolean;
  error: boolean;
  appDetails: CustomApplicationModel | undefined;
}

const initialState: ApplicationState = {
  loading: false,
  error: false,
  appDetails: undefined,
};

export const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    create: (
      state,
      _action: PayloadAction<Omit<CustomApplicationModel, 'id' | 'reference'>>,
    ) => {
      state.loading = false;
    },
    createSuccess: (state) => {
      state.loading = false;
    },
    createFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    delete: (state, _action: PayloadAction<DialAIEntityModel>) => {
      state.loading = true;
    },
    deleteSuccess: (state, _action: PayloadAction<void>) => {
      state.loading = false;
    },
    deleteFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    edit: (state, _action: PayloadAction<CustomApplicationModel>) => {
      state.loading = true;
    },
    editSuccess: (state) => {
      state.loading = false;
    },
    editFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    update: (
      state,
      _action: PayloadAction<{
        oldApplicationId: string;
        applicationData: CustomApplicationModel;
      }>,
    ) => {
      state.loading = true;
    },
    updateFail: (state) => {
      state.loading = false;
      state.error = true;
    },
    get: (state, _action: PayloadAction<string>) => {
      state.loading = true;
    },
    getSuccess: (state, action: PayloadAction<CustomApplicationModel>) => {
      state.loading = false;
      state.appDetails = action.payload;
    },
    getFail: (state) => {
      state.loading = false;
      state.error = true;
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
  },
});

export const ApplicationActions = applicationSlice.actions;

export default applicationSlice.reducer;
