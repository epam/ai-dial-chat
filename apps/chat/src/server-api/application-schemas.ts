import type { ApplicationSchemasResponseDto } from '@epam/chat-api-client';
import { applicationsApi } from './api-client';

export const getApplicationSchemas =
  (): Promise<ApplicationSchemasResponseDto> =>
    applicationsApi.listApplicationSchemas();

export const getApplicationSchema = (
  id: string,
): Promise<Record<string, unknown>> =>
  applicationsApi.getApplicationSchema({ id });
