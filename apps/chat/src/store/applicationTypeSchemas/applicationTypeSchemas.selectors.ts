import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '../index';
import { ApplicationTypesSchemasState } from './applicationTypeSchemas.reducer';

const rootSelector = (state: RootState): ApplicationTypesSchemasState =>
  state.applicationTypesSchemas;

export const selectAllSchemas = (state: RootState) =>
  rootSelector(state).schemas;

export const selectSchemaById = (id: string) =>
  createSelector([selectAllSchemas], (schemas) =>
    schemas.find((s) => s.id === id),
  );
