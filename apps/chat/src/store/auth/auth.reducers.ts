import { SessionContextValue } from 'next-auth/react';

import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { isClientSessionValid } from '@/src/utils/auth/session';

import { RootState } from '../index';
import { SettingsState } from '../settings/settings.reducers';

interface AuthState {
  session: SessionContextValue<boolean> | undefined;
  isAdmin: boolean;
}

const initialState: AuthState = {
  session: undefined,
  isAdmin: false,
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
    setIdAdmin: (state, { payload }: PayloadAction<boolean>) => {
      state.isAdmin = payload;
    },
  },
});

const settingsSelector = (state: RootState): SettingsState => state.settings;
const rootSelector = (state: RootState): AuthState => state.auth;

const selectSession = createSelector([rootSelector], (state) => {
  return state.session;
});
const selectStatus = createSelector([selectSession], (state) => {
  return state?.status ?? 'loading';
});
const selectIsShouldLogin = createSelector(
  [selectSession, selectStatus, settingsSelector],
  (session, sessionStatus, settings) => {
    return (
      !settings.isAuthDisabled &&
      (sessionStatus === 'unauthenticated' ||
        (sessionStatus === 'authenticated' && !isClientSessionValid(session)))
    );
  },
);
const selectIsAdmin = createSelector([rootSelector], (state) => {
  return state.isAdmin;
});

export const AuthSelectors = {
  selectIsShouldLogin,
  selectSession,
  selectStatus,
  selectIsAdmin,
};

export const AuthActions = authSlice.actions;
