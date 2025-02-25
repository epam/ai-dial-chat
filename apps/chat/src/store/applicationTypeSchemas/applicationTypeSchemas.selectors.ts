import { RootState } from '@/src/types/store';

import { ApplicationTypesSchemasState } from './applicationTypeSchemas.types';

const rootSelector = (state: RootState): ApplicationTypesSchemasState =>
  state.applicationTypesSchemas;

const selectAllSchemas = (state: RootState) => rootSelector(state).schemas;

const selectDetailedApplicationTypeSchema = (state: RootState) =>
  rootSelector(state).detailedApplicationTypeSchema;

const selectSchemasLoading = (state: RootState) =>
  rootSelector(state).schemasLoading;

const selectSchemaById = (state: RootState, id: string) =>
  selectAllSchemas(state).find((schema) => schema.id === id);

export const ApplicationTypesSchemasSelectors = {
  selectAllSchemas,
  selectDetailedApplicationTypeSchema,
  selectSchemasLoading,
  selectSchemaById,
};
