import type {
  ApplicationsResponseDto,
  CreateApplicationBodyDto,
  CreatedApplicationDto,
} from '@epam/chat-api-client';
import { applicationsApi } from './api-client';

export const getApplications = (): Promise<ApplicationsResponseDto> =>
  applicationsApi.listApplications();

export const createApplication = (
  body: CreateApplicationBodyDto,
): Promise<CreatedApplicationDto> =>
  applicationsApi.createApplication({ createApplicationBodyDto: body });

export const deleteApplication = (applicationName: string): Promise<void> =>
  applicationsApi.deleteApplication({ applicationName });
