import {
  EMPTY,
  catchError,
  concat,
  filter,
  ignoreElements,
  map,
  mergeMap,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';
import { triggerDownload } from '@/src/utils/app/file';
import { translate } from '@/src/utils/app/translation';

import { AppEpic } from '@/src/types/store';

import { UIActions } from '../ui/ui.reducers';
import { FilesActions, FilesSelectors } from './files.reducers';

const uploadFileEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.uploadFile.match),
    mergeMap(({ payload }) => {
      const formData = new FormData();
      formData.append('attachment', payload.fileContent, payload.name);

      return DataService.sendFile(
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
      DataService.getFiles(payload.path).pipe(
        map((files) =>
          FilesActions.getFilesSuccess({
            relativePath: payload.path,
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
    switchMap(({ payload }) =>
      DataService.getFileFolders(payload?.path).pipe(
        map((folders) =>
          FilesActions.getFoldersSuccess({
            folders,
          }),
        ),
        catchError(() => of(FilesActions.getFoldersFail())),
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
          ? payload.paths.map((path) => of(FilesActions.getFolders({ path })))
          : [of(FilesActions.getFolders({}))]),
      );
    }),
  );

const removeFileEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(FilesActions.removeFile.match),
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
            FilesActions.removeFileSuccess({
              fileId: payload.fileId,
            }),
          ),
        );
      }

      return DataService.removeFile(payload.fileId).pipe(
        map(() => {
          return FilesActions.removeFileSuccess({
            fileId: payload.fileId,
          });
        }),
        catchError(() => {
          return of(FilesActions.removeFileFail({ fileName: file.name }));
        }),
      );
    }),
  );

const removeFileFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.removeFileFail.match),
    map(({ payload }) => {
      return UIActions.showToast({
        message: translate(
          'Removing file {{fileName}} failed. Please try again later',
          {
            ns: 'file',
            fileName: payload.fileName,
          },
        ),
      });
    }),
    ignoreElements(),
  );

const removeMultipleFilesEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.removeFilesList.match),
    switchMap(({ payload }) => {
      return concat(
        ...payload.fileIds.map((fileId) =>
          of(FilesActions.removeFile({ fileId })),
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
        .filter((file) => !file.serverSynced && file.status === 'UPLOADING')
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
      files.forEach((file) =>
        triggerDownload(
          `api/${encodeURI(`${file.absolutePath}/${file.name}`)}`,
          file.name,
        ),
      );
    }),
    ignoreElements(),
  );

export const FilesEpics = combineEpics(
  uploadFileEpic,
  getFileFoldersEpic,
  getFilesEpic,
  reuploadFileEpic,
  getFilesWithFoldersEpic,
  removeFileEpic,
  getFoldersListEpic,
  removeMultipleFilesEpic,
  downloadFilesListEpic,
  removeFileFailEpic,
  unselectFilesEpic,
);
