import {
  EMPTY,
  catchError,
  concat,
  filter,
  forkJoin,
  groupBy,
  ignoreElements,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { FileService } from '@/src/utils/app/data/file-service';
import { getDownloadPath, triggerDownload } from '@/src/utils/app/file';
import {
  getFolderFromId,
  getGeneratedFolderId,
  updateMovedEntityId,
} from '@/src/utils/app/folders';
import { getFileRootId } from '@/src/utils/app/id';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import { AppEpic } from '@/src/types/store';
import { Translation } from '@/src/types/translation';

import { FilesSelectors } from '@/src/store/files/files.selectors';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { PublicationActions } from '../publication/publication.reducers';
import { FilesActions } from './files.reducers';

import { UploadStatus } from '@epam/ai-dial-shared';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.init.type),
    filter(() => !FilesSelectors.selectInitialized(state$.value)),
    switchMap(() =>
      concat(
        of(
          PublicationActions.uploadPublishedWithMeItems({
            featureType: FeatureType.File,
          }),
        ),
        of(FilesActions.initFinish()),
      ),
    ),
  );

const uploadFileEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.uploadFile.type),
    mergeMap(({ payload }) => {
      const formData = new FormData();
      formData.append('attachment', payload.fileContent, payload.name);

      return FileService.sendFile(
        formData,
        payload.relativePath,
        payload.name,
        undefined,
        payload.bucket,
      ).pipe(
        filter(
          ({ percent, result }) =>
            typeof percent !== 'undefined' || typeof result !== 'undefined',
        ),
        map(({ percent, result }) => {
          if (result) {
            return FilesActions.uploadFileSuccess({
              apiResult: result,
              showSuccessMessage: payload.showSuccessMessage,
            });
          }

          return FilesActions.uploadFileTick({
            id: payload.id,
            percent: percent!,
          });
        }),
        takeUntil(
          action$.pipe(
            ofType(FilesActions.uploadFileCancel.type),
            filter((action) => action.payload.id === payload.id),
          ),
        ),
        catchError(() => {
          return of(FilesActions.uploadFileFail({ id: payload.id }));
        }),
      );
    }),
  );

const uploadFilesSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.uploadFileSuccess.type),
    switchMap(({ payload }) => {
      if (payload.showSuccessMessage) {
        const { parentPath } = splitEntityId(payload.apiResult.id);

        return of(
          UIActions.showSuccessToast(
            translate(
              'The file has been uploaded successfully to "{{parentPath}}"',
              {
                parentPath,
              },
            ),
          ),
        );
      }

      return EMPTY;
    }),
  );

const reuploadFileEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.reuploadFile.type),
    switchMap(({ payload }) => {
      const file = FilesSelectors.selectFiles(state$.value).find(
        (file) => file.id === payload.fileId,
      );
      if (!file || !file.fileContent) {
        return of(FilesActions.uploadFileFail({ id: payload.fileId }));
      }

      return of(
        FilesActions.uploadFile({
          fileContent: file.fileContent,
          id: payload.fileId,
          relativePath: file.relativePath,
          name: file.name,
        }),
      );
    }),
  );

const renameFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.renameFolder.type),
    switchMap(({ payload }) => {
      const oldFolder = getFolderFromId(payload.folderId, FeatureType.File);
      const targetFolderId = getGeneratedFolderId({
        ...oldFolder,
        name: payload.newName,
      });
      const files = FilesSelectors.selectFiles(state$.value);

      const updatedFileIds = files
        .filter((file) => file.id.startsWith(`${targetFolderId}/`))
        .map(({ id }) => id);

      if (!updatedFileIds.length) return EMPTY;

      const sourceFileIds = updatedFileIds.map((id) =>
        updateMovedEntityId(targetFolderId, payload.folderId, id),
      );

      return forkJoin(
        updatedFileIds.map((destinationUrl, i) =>
          FileService.moveFile({
            destinationUrl,
            sourceUrl: sourceFileIds[i],
            overwrite: true,
          }),
        ),
      ).pipe(
        switchMap(() =>
          of(
            FilesActions.renameFolderSuccess({
              oldId: payload.folderId,
              newId: targetFolderId,
            }),
          ),
        ),
        catchError(() =>
          of(
            FilesActions.renameFolderFail({
              oldId: payload.folderId,
              newId: targetFolderId,
            }),
          ),
        ),
      );
    }),
  );

const renameFolderFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.renameFolderFail.type),
    switchMap(({ payload }) => {
      return of(
        UIActions.showErrorToast(
          translate(
            'Renaming folder {{folderName}} failed. Please try again later',
            {
              ns: Translation.Files,
              folderName: getFolderFromId(payload.oldId, FeatureType.File).name,
            },
          ),
        ),
      );
    }),
  );

const getFilesEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.getFiles.type),
    groupBy(({ payload }) => payload.id),
    mergeMap((group$) =>
      group$.pipe(
        switchMap(({ payload }) =>
          FileService.getFiles(payload.id).pipe(
            map((files) =>
              FilesActions.getFilesSuccess({
                files,
                foldersSet: new Set([payload.id ?? getFileRootId()]),
              }),
            ),
            catchError(() => of(FilesActions.getFilesFail())),
          ),
        ),
      ),
    ),
  );

const getFileFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.getFolders.type),
    mergeMap(({ payload }) =>
      FileService.getFileFolders(payload?.id).pipe(
        map((folders) =>
          FilesActions.getFoldersSuccess({
            folderId: payload.id,
            folders,
          }),
        ),
        catchError(() =>
          of(FilesActions.getFoldersFail({ folderId: payload.id })),
        ),
      ),
    ),
  );

const getFilesWithFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.getFilesWithFolders.type),
    switchMap(({ payload }) => {
      return concat(
        of(FilesActions.getFolders(payload)),
        of(FilesActions.getFiles(payload)),
      );
    }),
  );

const getFoldersListEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.getFoldersList.type),
    switchMap(({ payload }) => {
      if (payload.paths) {
        return concat(
          ...payload.paths.map((path) =>
            of(FilesActions.getFolders({ id: path })),
          ),
        );
      }

      return of(FilesActions.getFolders({}));
    }),
  );

const deleteFileEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.deleteFile.type),
    mergeMap(({ payload }) => {
      const file = FilesSelectors.selectFiles(state$.value).find(
        (file) => file.id === payload.fileId,
      );

      if (!file?.serverSynced) {
        return concat(
          of(
            FilesActions.uploadFileCancel({
              id: payload.fileId,
            }),
          ),
          of(
            FilesActions.deleteFileSuccess({
              fileId: payload.fileId,
            }),
          ),
        );
      }

      return FileService.deleteFile(payload.fileId).pipe(
        mergeMap(() => {
          const customLogo = UISelectors.selectCustomLogo(state$.value);

          return concat(
            iif(
              () => !!customLogo && customLogo === payload.fileId,
              of(UIActions.deleteCustomLogo()),
              EMPTY,
            ),
            of(
              FilesActions.deleteFileSuccess({
                fileId: payload.fileId,
              }),
            ),
          );
        }),
        catchError(() => {
          return of(
            FilesActions.deleteFileFail({
              fileName: file.name,
            }),
          );
        }),
      );
    }),
  );

const deleteFileFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.deleteFileFail.type),
    map(({ payload }) => {
      return UIActions.showToast({
        message: translate(
          'Deleting file {{fileName}} failed. Please try again later',
          {
            ns: Translation.Files,
            fileName: payload.fileName,
          },
        ),
      });
    }),
    ignoreElements(),
  );

const deleteMultipleFilesEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.deleteFilesList.type),
    switchMap(({ payload }) => {
      return concat(
        ...payload.fileIds.map((fileId) =>
          of(FilesActions.deleteFile({ fileId })),
        ),
      );
    }),
  );

const unselectFilesEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.unselectFiles.type),
    switchMap(({ payload }) => {
      const files = FilesSelectors.selectFilesByIds(state$.value, payload.ids);
      const cancelFileActions = files
        .filter(
          (file) => !file.serverSynced && file.status === UploadStatus.LOADING,
        )
        .map((file) => of(FilesActions.uploadFileCancel({ id: file.id })));

      return concat(...cancelFileActions);
    }),
  );

const downloadFilesListEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.downloadFilesList.type),
    map(({ payload }) =>
      FilesSelectors.selectFilesByIds(state$.value, payload.fileIds),
    ),
    tap((files) => {
      files.forEach((file) => {
        const filePath = getDownloadPath(file);
        return triggerDownload(
          `/api/${ApiUtils.encodeApiUrl(filePath)}`,
          file.name,
        );
      });
    }),
    ignoreElements(),
  );

export const FilesEpics = combineEpics(
  initEpic,

  uploadFileEpic,
  uploadFilesSuccessEpic,
  getFileFoldersEpic,
  getFilesEpic,
  reuploadFileEpic,
  renameFolderEpic,
  renameFolderFailEpic,
  getFilesWithFoldersEpic,
  deleteFileEpic,
  getFoldersListEpic,
  deleteMultipleFilesEpic,
  downloadFilesListEpic,
  deleteFileFailEpic,
  unselectFilesEpic,
);
