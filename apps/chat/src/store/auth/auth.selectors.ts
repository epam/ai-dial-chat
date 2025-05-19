import { createSelector } from '@reduxjs/toolkit';

import { isClientSessionValid } from '@/src/utils/auth/session';
import { isUserAdmin } from '@/src/utils/session';

import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.auth;

const selectSession = (state: RootState) => rootSelector(state)?.session;

const selectSessionData = (state: RootState) => selectSession(state)?.data;

const selectStatus = (state: RootState) =>
  selectSession(state)?.status ?? 'loading';

const selectIsShouldLogin = createSelector(
  [
    selectSession,
    selectStatus,
    (state: RootState) => state.settings.isAuthDisabled,
  ],
  (session, sessionStatus, isAuthDisabled) => {
    return (
      !isAuthDisabled &&
      (sessionStatus === 'unauthenticated' ||
        (sessionStatus === 'authenticated' && !isClientSessionValid(session)))
    );
  },
);
const selectIsAdmin = (state: RootState) =>
  isUserAdmin(selectSessionData(state));

const selectUserName = (state: RootState) =>
  selectSessionData(state)?.user?.name ?? '';

export const AuthSelectors = {
  selectIsShouldLogin,
  selectSessionData,
  selectUserName,
  selectStatus,
  selectIsAdmin,
};
