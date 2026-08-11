import type {
  ApplicationsResponseDto,
  CreateApplicationBodyDto,
  CreatedApplicationDto,
  UpdateApplicationBodyDto,
  UpdatedApplicationDto,
} from '@epam/ai-dial-chat-api-client';
import { applicationsApi } from './api-client';

export const getApplications = (): Promise<ApplicationsResponseDto> =>
  applicationsApi.listApplications();

export const createApplication = (
  body: CreateApplicationBodyDto,
): Promise<CreatedApplicationDto> =>
  applicationsApi.createApplication({ createApplicationBodyDto: body });

export const updateApplication = (
  applicationName: string,
  body: UpdateApplicationBodyDto,
): Promise<UpdatedApplicationDto> =>
  applicationsApi.updateApplication({
    applicationName,
    updateApplicationBodyDto: body,
  });

export const deleteApplication = (applicationName: string): Promise<void> =>
  applicationsApi.deleteApplication({ applicationName });
