import { SessionContextValue } from 'next-auth/react';

import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { AuthState } from './auth.types';

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
// TODO: add to selectors
// const selectUserName = (state: RootState) =>
//   selectSession(state)?.data?.user?.name ?? '';


export { AuthSelectors } from './auth.selectors';

export const AuthActions = authSlice.actions;
