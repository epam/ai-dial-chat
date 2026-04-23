import { of } from 'rxjs';

import { RootState } from '@/src/types/store';

import { CodeEditorActions } from '@/src/store/actions';
import { CodeEditorSelectors, FilesSelectors } from '@/src/store/selectors';

import { CODEAPPS_REQUIRED_FILES } from '@/src/constants/applications';

import { addTrailingSlashIfAbsent } from '../common';

export const selectFirstFileAction$ = (
  sourcesFolderId: string,
  files: DialFile[],
) => {
  const sourcesFolderIdWithTrailingSlash =
    addTrailingSlashIfAbsent(sourcesFolderId);
  const folderFiles = files.filter((file) =>
    file.id.startsWith(sourcesFolderIdWithTrailingSlash),
  );
  const rootFiles = files.filter((file) => file.folderId === sourcesFolderId);

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
