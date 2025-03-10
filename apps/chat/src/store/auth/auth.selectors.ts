import { createSelector } from '@reduxjs/toolkit';

import { isClientSessionValid } from '@/src/utils/auth/session';
import { isUserAdmin } from '@/src/utils/session';

import { RootState } from '@/src/types/store';

import { SettingsState } from '@/src/store/settings/settings.types';

import { AuthState } from './auth.types';

// settings
const settingsSelector = (state: RootState): SettingsState => state.settings;

const selectIsAuthDisabled = (state: RootState) =>
  settingsSelector(state).isAuthDisabled;

// auth
const rootSelector = (state: RootState): AuthState => state.auth;

const selectSession = (state: RootState) => rootSelector(state)?.session;

const selectSessionData = (state: RootState) => selectSession(state)?.data;

const selectStatus = (state: RootState) =>
  selectSession(state)?.status ?? 'loading';

const selectIsShouldLogin = createSelector(
  [selectSession, selectStatus, selectIsAuthDisabled],
  (session, sessionStatus, isAuthDisabled) => {
    return (
      !isAuthDisabled &&
      (sessionStatus === 'unauthenticated' ||
        (sessionStatus === 'authenticated' && !isClientSessionValid(session)))
    );
  },
);
const selectIsAdmin = createSelector([selectSessionData], (sessionData) => {
  return isUserAdmin(sessionData);
});

const selectUserName = (state: RootState) =>
  selectSessionData(state)?.user?.name ?? '';

export const AuthSelectors = {
  selectIsShouldLogin,
  selectIsAuthDisabled,
  selectSession,
  selectSessionData,
  selectUserName,
  selectStatus,
  selectIsAdmin,
};
