import { of } from 'rxjs';

import { DialFile } from '@/src/types/files';

import { CodeEditorActions } from '@/src/store/actions';

import { CODEAPPS_REQUIRED_FILES } from '@/src/constants/applications';
import { TEMP_FILE_NAME_IN_FILE_MANAGER } from '@/src/constants/file';

import { addTrailingSlashIfAbsent } from '../common';

export const selectFirstFileAction$ = (
  sourcesFolderId: string,
  files: DialFile[],
) => {
  const filteredFiles = files.filter(
    (file) => file.name !== TEMP_FILE_NAME_IN_FILE_MANAGER,
  );
  const sourcesFolderIdWithTrailingSlash =
    addTrailingSlashIfAbsent(sourcesFolderId);
  const folderFiles = filteredFiles.filter((file) =>
    file.id.startsWith(sourcesFolderIdWithTrailingSlash),
  );
  const rootFiles = filteredFiles.filter(
    (file) => file.folderId === sourcesFolderId,
  );

  if (folderFiles.length) {
    const appFile = rootFiles.find(
      (file) => file.name === CODEAPPS_REQUIRED_FILES.APP && !file.status,
    );

    if (appFile) {
      return of(CodeEditorActions.setSelectedFileId(appFile.id));
    } else {
      return of(CodeEditorActions.setSelectedFileId(folderFiles[0].id));
    }
  }

  return of(CodeEditorActions.setSelectedFileId(undefined));
};
