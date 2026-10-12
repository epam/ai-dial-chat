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

/*
 * Always a conditional create: the app's storage path is derived from its
 * name and version, so an unconditional write would silently overwrite an
 * existing app (including a renamed one that still owns the original path).
 * The backend answers 409 when the path is already taken.
 */
export const createApplication = (
  body: CreateApplicationBodyDto,
): Promise<CreatedApplicationDto> =>
  applicationsApi.createApplication({
    createApplicationBodyDto: { ...body, createOnly: true },
  });

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
