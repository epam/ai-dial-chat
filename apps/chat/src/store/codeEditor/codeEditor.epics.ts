import {
  EMPTY,
  Observable,
  catchError,
  concat,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { FileService } from '@/src/utils/app/data/file-service';
import { TextFileService } from '@/src/utils/app/data/text-file-service';
import { selectFirstFileAction$ } from '@/src/utils/app/epics-helpers/code-editor.epic-helpers';
import { parseApiError } from '@/src/utils/app/epics-helpers/common.epic-helpers';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';

import { AppAction, AppEpic } from '@/src/types/store';
import { Translation } from '@/src/types/translation';

import {
  CodeEditorActions,
  FilesActions,
  UIActions,
} from '@/src/store/actions';
import {
  CodeEditorSelectors,
  FilesSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { TEMP_FILE_NAME_IN_FILE_MANAGER } from '@/src/constants/file';
import { ChatI18nKeys } from '@/src/constants/i18n';

import intersectionWith from 'lodash-es/intersectionWith';

const initCodeEditorEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(CodeEditorActions.initCodeEditor.type),
    switchMap(({ payload }) => {
      const files = FilesSelectors.selectFiles(state$.value);
      return selectFirstFileAction$(payload.sourcesFolderId, files);
    }),
  );

const getFileTextContentEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(CodeEditorActions.getFileTextContent.type),
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
          const { traceId } = parseApiError(error);
          return concat(
            of(
              UIActions.showErrorToast({
                message: translate(ChatI18nKeys.FileContentRequestFailed, {
                  ns: Translation.Chat,
                }),
                traceId,
              }),
            ),
            of(CodeEditorActions.getFileTextContentFail()),
          );
        }),
      );
    }),
  );

const setSelectedFileEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(CodeEditorActions.setSelectedFileId.type),
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
    ofType(CodeEditorActions.deleteFile.type),
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
          const actions: Observable<AppAction>[] = [];
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
                file.id !== payload.id &&
                file.name !== TEMP_FILE_NAME_IN_FILE_MANAGER,
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
        catchError((err) => {
          const { traceId } = parseApiError(err);
          return of(
            FilesActions.deleteFileFail({
              fileName: file.name,
              traceId,
            }),
          );
        }),
      );
    }),
  );

const updateFileContentEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(CodeEditorActions.updateFileContent.type),
    mergeMap(({ payload }) => {
      const file = FilesSelectors.selectFileById(state$.value, payload.id);

      if (!file) {
        return EMPTY;
      }

      const { bucket } = splitEntityId(file.id);
      return TextFileService.updateContent({
        relativePath:
          file.relativePath ?? getIdWithoutRootPathSegments(file.folderId),
        fileName: file.name,
        content: payload.content,
        contentType: file.contentType,
        bucket,
      }).pipe(
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
          const { traceId } = parseApiError(error);
          return of(
            UIActions.showErrorToast({
              message: translate(ChatI18nKeys.FileContentUpdateFailed, {
                ns: Translation.Chat,
              }),
              traceId,
            }),
          );
        }),
      );
    }),
  );

const saveAllModifiedFilesEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(CodeEditorActions.saveAllModifiedFiles.type),
    switchMap(() => {
      const modifiedFileIds = CodeEditorSelectors.selectModifiedFileIds(
        state$.value,
      );
      const filesContent = CodeEditorSelectors.selectFilesContent(state$.value);

      const changedFiles = intersectionWith(
        filesContent,
        modifiedFileIds,
        (file, id) => file.id === id,
      );

      return concat(
        changedFiles.map((file) =>
          CodeEditorActions.updateFileContent({
            id: file.id,
            content: file.modifiedContent ?? file.content,
          }),
        ),
      );
    }),
  );

const selectFirstFileAfterSharedLoadEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.addSharedFiles.type),
    switchMap(() => {
      const sourcesFolderId = CodeEditorSelectors.selectSourcesFolderId(
        state$.value,
      );
      const selectedFileId = CodeEditorSelectors.selectSelectedFile(
        state$.value,
      );

      if (!sourcesFolderId || selectedFileId !== undefined) {
        return EMPTY;
      }

      const files = FilesSelectors.selectFiles(state$.value);
      return selectFirstFileAction$(sourcesFolderId, files);
    }),
  );

export const CodeEditorEpics = combineEpics(
  initCodeEditorEpic,
  getFileTextContentEpic,
  setSelectedFileEpic,
  deleteFileEpic,
  updateFileContentEpic,
  saveAllModifiedFilesEpic,
  selectFirstFileAfterSharedLoadEpic,
);
