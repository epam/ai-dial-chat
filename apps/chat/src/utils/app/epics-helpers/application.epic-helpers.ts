import { concat, forkJoin, mergeMap, of, switchMap } from 'rxjs';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { CustomApplicationModel } from '@/src/types/applications';

import {
  ApplicationActions,
  FilesActions,
  ModelsActions,
} from '@/src/store/actions';

import { FileService } from '../data/file-service';
import { constructPath, splitEntityId } from '../shared-utils';

// Helper to create actions for duplicating source folders
export function duplicateAndUpdateSourceFolderActions(
  newAgent: CustomApplicationModel,
  folderDestination: string,
) {
  const sourceFolder = newAgent.function?.sourceFolder;
  if (sourceFolder && newAgent.function) {
    return concat(
      of(
        FilesActions.duplicateFilesFolder({
          folderId: sourceFolder,
          destinationUrl: folderDestination,
        }),
      ),
      of(
        ApplicationActions.update({
          oldApplication: newAgent,
          applicationData: {
            ...newAgent,
            function: {
              ...newAgent.function,
              sourceFolder: folderDestination,
            },
          },
        }),
      ),
    );
  }

  return of();
}

// Helper to create actions for copying document-relative URLs
export function duplicateAndUpdateDocumentsActions(
  newAgent: CustomApplicationModel,
  schema: ApiDetailedApplicationTypeSchema | undefined,
  documentsDestination: string,
) {
  const documentRelativeUrl = newAgent.applicationProperties
    ?.document_relative_url as string[] | undefined;

  if (documentRelativeUrl?.length && schema) {
    const copyFilesObservables = documentRelativeUrl.map((url) =>
      FileService.copyFile({
        sourceUrl: url,
        destinationUrl: constructPath(
          documentsDestination,
          splitEntityId(url).name,
        ),
      }),
    );

    return forkJoin(copyFilesObservables).pipe(
      switchMap(() =>
        of(
          ApplicationActions.update({
            oldApplication: newAgent,
            applicationData: {
              ...newAgent,
              applicationProperties: {
                ...newAgent.applicationProperties,
                document_relative_url: documentRelativeUrl.map((url) =>
                  constructPath(documentsDestination, splitEntityId(url).name),
                ),
              },
            },
            schema,
          }),
        ),
      ),
    );
  }

  return of();
}
