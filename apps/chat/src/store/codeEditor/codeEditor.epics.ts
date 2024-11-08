import {
  EMPTY,
  Observable,
  catchError,
  concat,
  filter,
  iif,
  map,
  of,
  switchMap,
} from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { FileService } from '@/src/utils/app/data/file-service';
import { TextFileService } from '@/src/utils/app/data/text-file-service';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';
import { translate } from '@/src/utils/app/translation';

import { AppEpic } from '@/src/types/store';

import { CODEAPPS_REQUIRED_FILES } from '@/src/constants/applications';

import { FilesActions, FilesSelectors } from '../files/files.reducers';
import { UIActions, UISelectors } from '../ui/ui.reducers';
import { CodeEditorActions, CodeEditorSelectors } from './codeEditor.reducer';

const initCodeEditorEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(CodeEditorActions.initCodeEditor.match),
    switchMap(({ payload }) => {
      const folderFiles = FilesSelectors.selectFiles(state$.value).filter(
        (file) => file.id.startsWith(`${payload.sourcesFolderId}/`),
      );
      const rootFiles = FilesSelectors.selectFiles(state$.value).filter(
        (file) => file.folderId === payload.sourcesFolderId,
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
    }),
  );

const getFileTextContentEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(CodeEditorActions.getFileTextContent.match),
    switchMap(({ payload }) => {
      return TextFileService.getFileContent(payload.id).pipe(
        map((content) => {
          return CodeEditorActions.getFileTextContentSuccess({
            id: payload.id,
            content,
          });
        }),
        catchError((error) => {
          console.error(error);
          return concat(
            of(
              UIActions.showErrorToast(
                translate('File content request failed'),
              ),
            ),
            of(CodeEditorActions.getFileTextContentFail()),
          );
        }),
      );
    }),
  );

const setSelectedFileEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(CodeEditorActions.setSelectedFileId.match),
    switchMap(({ payload }) => {
      if (!payload) {
        return EMPTY;
      }

      const filesContent = CodeEditorSelectors.selectFilesContent(state$.value);
      if (filesContent.some((file) => file.id === payload)) {
        return EMPTY;
      }

      return of(CodeEditorActions.getFileTextContent({ id: payload }));
    }),
  );

const deleteFileEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(CodeEditorActions.deleteFile.match),
    switchMap(({ payload }) => {
      const file = FilesSelectors.selectFileById(state$.value, payload.id);

      if (!file?.serverSynced) {
        return concat(
          of(
            FilesActions.uploadFileCancel({
              id: payload.id,
            }),
          ),
          of(
            FilesActions.deleteFileSuccess({
              fileId: payload.id,
            }),
          ),
        );
      }

      return FileService.deleteFile(payload.id).pipe(
        switchMap(() => {
          const actions: Observable<AnyAction>[] = [];
          const filesContent = CodeEditorSelectors.selectFilesContent(
            state$.value,
          ).filter((file) => file.id !== payload.id);
          const customLogo = UISelectors.selectCustomLogo(state$.value);

          if (filesContent.length) {
            actions.push(
              of(CodeEditorActions.setSelectedFileId(filesContent[0].id)),
            );
          } else {
            const childFiles = FilesSelectors.selectFiles(state$.value).filter(
              (file) =>
                file.id.startsWith(`${payload.sourcesFolderId}/`) &&
                file.id !== payload.id,
            );

            actions.push(
              of(
                CodeEditorActions.setSelectedFileId(
                  childFiles.length ? childFiles[0].id : undefined,
                ),
              ),
            );
          }

          return concat(
            iif(
              () => !!customLogo && customLogo === payload.id,
              of(UIActions.deleteCustomLogo()),
              EMPTY,
            ),
            of(
              FilesActions.deleteFileSuccess({
                fileId: payload.id,
              }),
            ),
            of(
              CodeEditorActions.deleteFileSuccess({
                id: payload.id,
              }),
            ),
            ...actions,
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

const updateFileContentEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(CodeEditorActions.updateFileContent.match),
    switchMap(({ payload }) => {
      const file = FilesSelectors.selectFileById(state$.value, payload.id);

      if (!file) {
        return EMPTY;
      }

      return TextFileService.updateContent(
        file.relativePath ?? getIdWithoutRootPathSegments(file.id),
        file.name,
        payload.content,
        file.contentType,
      ).pipe(
        filter(({ success }) => !!success),
        switchMap(({ success }) => {
          if (success) {
            return of(
              CodeEditorActions.updateFileContentSuccess({
                id: payload.id,
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

export const CodeEditorEpics = combineEpics(
  initCodeEditorEpic,
  getFileTextContentEpic,
  setSelectedFileEpic,
  deleteFileEpic,
  updateFileContentEpic,
);
