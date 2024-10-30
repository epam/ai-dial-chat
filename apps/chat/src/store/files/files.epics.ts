import {
  EMPTY,
  catchError,
  concat,
  filter,
  ignoreElements,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { FileService } from '@/src/utils/app/data/file-service';
import { TextFileService } from '@/src/utils/app/data/text-file-service';
import { getDownloadPath, triggerDownload } from '@/src/utils/app/file';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import { AppEpic } from '@/src/types/store';

import { PublicationActions } from '../publication/publication.reducers';
import { UIActions, UISelectors } from '../ui/ui.reducers';
import { FilesActions, FilesSelectors } from './files.reducers';

import { UploadStatus } from '@epam/ai-dial-shared';

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.init.match),
    switchMap(() =>
      of(
        PublicationActions.uploadPublishedWithMeItems({
          featureType: FeatureType.File,
        }),
      ),
    ),
  );

const uploadFileEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.uploadFile.match),
    mergeMap(({ payload }) => {
      const formData = new FormData();
      formData.append('attachment', payload.fileContent, payload.name);

      return FileService.sendFile(
        formData,
        payload.relativePath,
        payload.name,
      ).pipe(
        filter(
          ({ percent, result }) =>
            typeof percent !== 'undefined' || typeof result !== 'undefined',
        ),
        map(({ percent, result }) => {
          if (result) {
            return FilesActions.uploadFileSuccess({
              apiResult: result,
            });
          }

          return FilesActions.uploadFileTick({
            id: payload.id,
            percent: percent!,
          });
        }),
        takeUntil(
          action$.pipe(
            filter(FilesActions.uploadFileCancel.match),
            filter((action) => action.payload.id === payload.id),
          ),
        ),
        catchError(() => {
          return of(FilesActions.uploadFileFail({ id: payload.id }));
        }),
      );
    }),
  );

const reuploadFileEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(FilesActions.reuploadFile.match),
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

const getFilesEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.getFiles.match),
    switchMap(({ payload }) =>
      FileService.getFiles(payload.id).pipe(
        map((files) =>
          FilesActions.getFilesSuccess({
            files,
          }),
        ),
        catchError(() => of(FilesActions.getFilesFail())),
      ),
    ),
  );

const getFileFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.getFolders.match),
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
    filter(FilesActions.getFilesWithFolders.match),
    switchMap(({ payload }) => {
      return concat(
        of(FilesActions.getFolders(payload)),
        of(FilesActions.getFiles(payload)),
      );
    }),
  );

const getFoldersListEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.getFoldersList.match),
    switchMap(({ payload }) => {
      return concat(
        ...(payload.paths
          ? payload.paths.map((path) =>
              of(FilesActions.getFolders({ id: path })),
            )
          : [of(FilesActions.getFolders({}))]),
      );
    }),
  );

const deleteFileEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(FilesActions.deleteFile.match),
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
          return of(FilesActions.deleteFileFail({ fileName: file.name }));
        }),
      );
    }),
  );

const deleteFileFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.deleteFileFail.match),
    map(({ payload }) => {
      return UIActions.showToast({
        message: translate(
          'Deleting file {{fileName}} failed. Please try again later',
          {
            ns: 'file',
            fileName: payload.fileName,
          },
        ),
      });
    }),
    ignoreElements(),
  );

const deleteMultipleFilesEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.deleteFilesList.match),
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
    filter(FilesActions.unselectFiles.match),
    switchMap(({ payload }) => {
      const files = FilesSelectors.selectFilesByIds(state$.value, payload.ids);
      const cancelFileActions = files
        .filter(
          (file) => !file.serverSynced && file.status === UploadStatus.LOADING,
        )
        .map((file) => of(FilesActions.uploadFileCancel({ id: file.id })));

      return cancelFileActions.length ? concat(...cancelFileActions) : EMPTY;
    }),
  );

const downloadFilesListEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(FilesActions.downloadFilesList.match),
    map(({ payload }) => ({
      files: FilesSelectors.selectFilesByIds(state$.value, payload.fileIds),
    })),
    tap(({ files }) => {
      files.forEach((file) => {
        const filePath = getDownloadPath(file);
        return triggerDownload(
          `api/${ApiUtils.encodeApiUrl(filePath)}`,
          file.name,
        );
      });
    }),
    ignoreElements(),
  );

const getFileTextContentEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.getFileTextContent.match),
    switchMap(({ payload }) => {
      return TextFileService.getFileContent(payload.id).pipe(
        map((content) => {
          return FilesActions.getFileTextContentSuccess({ content });
        }),
        catchError((error) => {
          console.error(error);
          return concat(
            of(
              UIActions.showErrorToast(
                translate('File content request failed'),
              ),
            ),
            of(FilesActions.getFileTextContentFail()),
          );
        }),
      );
    }),
  );

const updateFileContentEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.updateFileContent.match),
    switchMap(({ payload }) => {
      return TextFileService.updateContent(
        payload.relativePath,
        payload.fileName,
        payload.content,
        payload.contentType,
      ).pipe(
        filter(({ success }) => !!success),
        switchMap(({ success }) => {
          if (success) {
            return of(
              FilesActions.getFileTextContentSuccess({
                content: payload.content,
              }),
            );
          }

          return EMPTY;
        }),
        catchError((error) => {
          console.error(error);
          return of(
            UIActions.showErrorToast(translate('File content update failed')),
          );
        }),
      );
    }),
  );

export const FilesEpics = combineEpics(
  initEpic,

  uploadFileEpic,
  getFileFoldersEpic,
  getFilesEpic,
  reuploadFileEpic,
  getFilesWithFoldersEpic,
  deleteFileEpic,
  getFoldersListEpic,
  deleteMultipleFilesEpic,
  downloadFilesListEpic,
  deleteFileFailEpic,
  unselectFilesEpic,
  getFileTextContentEpic,
  updateFileContentEpic,
);
