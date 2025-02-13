import { RootState } from '../index';
import { ApplicationTypesSchemasState } from './applicationTypeSchemas.reducer';

const rootSelector = (state: RootState): ApplicationTypesSchemasState =>
  state.applicationTypesSchemas;

export const selectAllSchemas = (state: RootState) =>
  rootSelector(state).schemas;

export const selectDetailedApplicationTypeSchema = (state: RootState) =>
  rootSelector(state).detailedApplicationTypeSchema;

export const selectSchemasLoading = (state: RootState) =>
  rootSelector(state).schemasLoading;

export const selectSchemaById = (state: RootState, id: string) =>
  selectAllSchemas(state).find((schema) => schema.id === id);
