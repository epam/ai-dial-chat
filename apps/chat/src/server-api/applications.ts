import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import type {
  ApplicationResourceDependenciesDto,
  ApplicationResourceDependencyDto,
  ApplicationsResponseDto,
  CreateApplicationBodyDto,
  CreatedApplicationDto,
  ResourceFoldersResponseDto,
  UpdateApplicationBodyDto,
  UpdatedApplicationDto,
} from '@epam/ai-dial-chat-api-client';
import { composeLocalePayload } from '@epam/ai-dial-chat-hooks';
import { PRIMARY_LOCALE } from '../utils/locale';
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

/** Reads the resource dependencies stored on an application; never cached. */
export const getApplicationResourceDependencies = (
  applicationName: string,
): Promise<ApplicationResourceDependenciesDto> =>
  applicationsApi.getApplicationResourceDependencies({ applicationName });

/*
 * The update replaces the display fields it receives, so the Access step
 * sends the values the Metadata form holds, trimmed the way each definition's
 * own update trims them, together with the full dependency list.
 */
export const updateApplicationAccess = (
  applicationName: string,
  metadata: DeploymentCreationFormValues,
  resourceDependencies: ApplicationResourceDependencyDto[],
): Promise<UpdatedApplicationDto> => {
  const locales = composeLocalePayload(metadata.otherLocales, PRIMARY_LOCALE);
  return updateApplication(applicationName, {
    name: metadata.name.trim(),
    description: metadata.description.trim() || undefined,
    iconUrl: metadata.iconUrl.trim() || undefined,
    version: metadata.version.trim() || undefined,
    topics: metadata.topics,
    locales,
    primaryLocale: locales ? PRIMARY_LOCALE : undefined,
    resourceDependencies,
  });
};

export const deleteApplication = (applicationName: string): Promise<void> =>
  applicationsApi.deleteApplication({ applicationName });

/** Lists one level of the caller's application folders; an empty `path` is the root. */
export const listApplicationFolders = (
  path: string,
): Promise<ResourceFoldersResponseDto> =>
  applicationsApi.listApplicationFolders({ path });
