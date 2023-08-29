import { AddonsEpics } from './addons/addons.epics';
import { addonsSlice } from './addons/addons.reducers';
import { ModelsEpics } from './models/models.epics';
import { modelsSlice } from './models/models.reducers';
import UIEpics from './ui-store/ui.epics';
import { uiSlice } from './ui-store/ui.reducers';

import { configureStore } from '@reduxjs/toolkit';
import { Epic, combineEpics, createEpicMiddleware } from 'redux-observable';

export const rootEpic = combineEpics(ModelsEpics, AddonsEpics, UIEpics);
const epicMiddleware = createEpicMiddleware();

export const store = configureStore({
  reducer: {
    models: modelsSlice.reducer,
    addons: addonsSlice.reducer,
    ui: uiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(epicMiddleware),
});

epicMiddleware.run(rootEpic as unknown as Epic);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
