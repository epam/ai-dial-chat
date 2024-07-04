import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CreateApplicationModel, ApplicationListResponseModel } from '@/src/types/applications';

export interface ApplicationState {
    loading: boolean;
    error: boolean;
    application: CreateApplicationModel | null;
    applications: ApplicationListResponseModel | null;
}

const initialState: ApplicationState = {
    loading: false,
    error: false,
    application: null,
    applications: null
};

export const applicationSlice = createSlice({
    name: 'application',
    initialState,
    reducers: {
        create: (state, action: PayloadAction<CreateApplicationModel>) => {
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
        listSuccess: (state, action: PayloadAction<ApplicationListResponseModel>) => {
            state.loading = false;
            state.applications = action.payload;
        },
        listFail: (state) => {
            state.loading = false;
            state.error = true;
        }
    },
});

export const { create, createSuccess, createFail, list, listSuccess, listFail } = applicationSlice.actions;

export default applicationSlice.reducer;

//change