import { RootState } from '../index';
import { SettingsState } from '../settings/settings.reducers';



import { isClientSessionValid } from '@/src/utils/auth/session';
import { isUserAdmin } from '@/src/utils/session';
import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';
import { SessionContextValue } from 'next-auth/react';

interface AuthState {
  session: SessionContextValue<boolean> | undefined;
}

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

const settingsSelector = (state: RootState): SettingsState => state.settings;
const rootSelector = (state: RootState): AuthState => state.auth;

const selectSession = (state: RootState) => rootSelector(state)?.session;

const selectSessionData = (state: RootState) => selectSession(state)?.data;

const selectUserName = (state: RootState) =>
  selectSessionData(state)?.user?.name ?? '';

const selectStatus = (state: RootState) =>
  selectSession(state)?.status ?? 'loading';

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
  return isUserAdmin(selectSessionData(state));
});

export const AuthSelectors = {
  selectIsShouldLogin,
  selectSession,
  selectSessionData,
  selectUserName,
  selectStatus,
  selectIsAdmin,
};

export const AuthActions = authSlice.actions;
