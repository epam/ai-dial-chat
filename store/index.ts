import ModelsEpics from './models/models.epics';
import { modelsSlice } from './models/models.reducers';
import UIEpics from './ui-store/ui.epics';
import { uiSlice } from './ui-store/ui.reducers';

import { configureStore } from '@reduxjs/toolkit';
import { combineEpics, createEpicMiddleware } from 'redux-observable';

const epicMiddleware = createEpicMiddleware();

export const rootEpic = combineEpics(ModelsEpics, UIEpics);

export const store = configureStore({
  reducer: {
    models: modelsSlice.reducer,
    ui: uiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(epicMiddleware),
});

epicMiddleware.run(rootEpic);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
