import { SessionContextValue } from 'next-auth/react';

import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { AuthState } from './auth.types';

import isEqual from 'lodash-es/isEqual';

const initialState: AuthState = {
  session: undefined,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession: (
      state,
      { payload }: PayloadAction<SessionContextValue<boolean>>,
    ) => {
      if (
        state.session?.status === payload.status &&
        isEqual(state.session?.data, payload.data)
      ) {
        return;
      }

      state.session = payload;
    },
  },
});

export const AuthActions = authSlice.actions;
