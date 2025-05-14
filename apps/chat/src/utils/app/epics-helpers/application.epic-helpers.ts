import { EMPTY, concat, forkJoin, of, switchMap } from 'rxjs';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { CustomApplicationModel } from '@/src/types/applications';

import { ApplicationActions, FilesActions } from '@/src/store/actions';

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

  return EMPTY;
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
    // handle case if some files have the same name
    const existingNames = new Set<string>();
    const uniquePaths = documentRelativeUrl.map((url: string) => {
      const originalName = splitEntityId(url).name;
      let uniqueName = originalName;
      let counter = 1;

      while (existingNames.has(uniqueName)) {
        uniqueName = `${originalName} ${counter}`;
        counter++;
      }

      existingNames.add(uniqueName);
      return constructPath(documentsDestination, uniqueName);
    });

    const copyFilesObservables = documentRelativeUrl.map((url, i) =>
      FileService.copyFile({
        sourceUrl: url,
        destinationUrl: uniquePaths[i],
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
                document_relative_url: uniquePaths,
              },
            },
            schema,
          }),
        ),
      ),
    );
  }

  return EMPTY;
}
