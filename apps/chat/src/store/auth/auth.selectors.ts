import { createSelector } from '@reduxjs/toolkit';

import { isClientSessionValid } from '@/src/utils/auth/session';

import { RootState } from '@/src/types/store';

import { SettingsState } from '@/src/store/settings/settings.types';

import { AuthState } from './auth.types';

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
  return !!state.session?.data?.user.isAdmin;
});

const selectUserName = (state: RootState) =>
  selectSession(state)?.data?.user?.name ?? '';

const selectCanCreateCodeApps = createSelector([rootSelector], (state) => {
  return !!state.session?.data?.user.canCreateCodeApps;
});

export const AuthSelectors = {
  selectIsShouldLogin,
  selectSession,
  selectStatus,
  selectIsAdmin,
  selectUserName,
  selectCanCreateCodeApps,
};
