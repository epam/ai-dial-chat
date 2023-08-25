import { addonsSlice } from './addons/addons.reducers';
import ModelsEpics from './models/models.epics';
import { modelsSlice } from './models/models.reducers';

import { configureStore } from '@reduxjs/toolkit';
import { combineEpics, createEpicMiddleware } from 'redux-observable';

const epicMiddleware = createEpicMiddleware();

export const rootEpic = combineEpics(ModelsEpics);

export const store = configureStore({
  reducer: {
    models: modelsSlice.reducer,
    addons: addonsSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(epicMiddleware),
});

epicMiddleware.run(rootEpic);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
