import { createSelector } from '@reduxjs/toolkit';

import { isClientSessionValid } from '@/src/utils/auth/session';

import { AuthState } from '@/src/types/auth';
import { SettingsState } from '@/src/types/settings';

import { RootState } from '@/src/store';

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

export const AuthSelectors = {
  selectIsShouldLogin,
  selectSession,
  selectStatus,
  selectIsAdmin,
};
