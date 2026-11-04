import type {
  ApplicationsResponseDto,
  CreateApplicationBodyDto,
  CreatedApplicationDto,
  ResourceFoldersResponseDto,
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
 * The backend creates at the next free path instead (the returned `id` is
 * authoritative) and answers 409 only when no candidate path is free.
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

/** Lists one level of the caller's application folders; an empty `path` is the root. */
export const listApplicationFolders = (
  path: string,
): Promise<ResourceFoldersResponseDto> =>
  applicationsApi.listApplicationFolders({ path });
