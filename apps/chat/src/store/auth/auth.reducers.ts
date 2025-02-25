import { SessionContextValue } from 'next-auth/react';

import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { AuthState } from '@/src/types/auth';

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
      state.session = payload;
    },
  },
});

export { AuthSelectors } from './auth.selectors';

export const AuthActions = authSlice.actions;
