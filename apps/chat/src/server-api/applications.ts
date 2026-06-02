import type { ApplicationsResponseDto } from '@epam/chat-api-client';
import { applicationsApi } from './api-client';

export const getApplications = (): Promise<ApplicationsResponseDto> =>
  applicationsApi.listApplications();
