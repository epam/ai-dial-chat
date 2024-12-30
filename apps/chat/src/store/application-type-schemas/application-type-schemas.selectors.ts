import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { ApplicationTypesSchemasState } from './application-type-schemas.reducer';

const rootSelector = (state: RootState): ApplicationTypesSchemasState =>
  state.applicationTypesSchemas;

export const selectAllSchemas = createSelector(
  [rootSelector],
  (state) => state.schemas,
);
