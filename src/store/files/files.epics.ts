import {
  catchError,
  concat,
  filter,
  ignoreElements,
  map,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';

import { AppEpic } from '@/src/types/store';

import { FilesActions, FilesSelectors } from './files.reducers';

const initEpic: AppEpic = (action$) =>
  action$.pipe(filter(FilesActions.init.match), ignoreElements());

const uploadFileEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.uploadFile.match),
    mergeMap(({ payload }) => {
      const formData = new FormData();
      formData.append('attachment', payload.fileContent, payload.name);

      return DataService.sendFile(formData, payload.relativePath).pipe(
        map(({ percent, result }) => {
          if (percent !== undefined) {
            return FilesActions.uploadFileTick({ id: payload.id, percent });
          }

          if (result) {
            return FilesActions.uploadFileSuccess({
              apiResult: result,
            });
          }

          return FilesActions.uploadFileFail({ id: payload.id });
        }),
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
    switchMap(({ payload }) => {
      return DataService.getFiles(payload.path).pipe(
        map((files) => {
          return FilesActions.getFilesSuccess({
            relativePath: payload.path,
            files,
          });
        }),
        catchError(() => {
          return of(FilesActions.getFilesFail());
        }),
      );
    }),
  );

const getFileFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.getFolders.match),
    switchMap(({ payload }) => {
      return DataService.getFileFolders(payload?.path).pipe(
        map((folders) => {
          return FilesActions.getFoldersSuccess({
            folders,
          });
        }),
        catchError(() => {
          return of(FilesActions.getFoldersFail());
        }),
      );
    }),
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

const removeFileEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(FilesActions.removeFile.match),
    switchMap(({ payload }) => {
      return DataService.removeFile(payload.fileId).pipe(
        map(() => {
          return FilesActions.removeFileSuccess({
            fileId: payload.fileId,
          });
        }),
        catchError(() => {
          return of(FilesActions.removeFileFail());
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
  removeFileEpic,
);
