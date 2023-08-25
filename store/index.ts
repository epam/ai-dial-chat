import UIEpics from './ui-store/ui.epics';
import uiReducer from './ui-store/ui.reducers';

import { configureStore } from '@reduxjs/toolkit';
import { combineEpics, createEpicMiddleware } from 'redux-observable';

// Reducers

// Epics

const epicMiddleware = createEpicMiddleware();

export const rootEpic = combineEpics(UIEpics);

export const store = configureStore({
  reducer: {
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(epicMiddleware),
});

epicMiddleware.run(rootEpic);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
