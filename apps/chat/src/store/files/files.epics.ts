import {
  EMPTY,
  catchError,
  concat,
  filter,
  forkJoin,
  from,
  groupBy,
  ignoreElements,
  iif,
  map,
  merge,
  mergeMap,
  of,
  scan,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { addTrailingSlashIfAbsent } from '@/src/utils/app/common';
import { FileService } from '@/src/utils/app/data/file-service';
import {
  constructPath,
  getDownloadPath,
  getRootFolderPlaceholderName,
  triggerDownload,
} from '@/src/utils/app/file';
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
import { AppAction, AppEpic } from '@/src/types/store';
import { ToastType } from '@/src/types/toasts';
import { Translation } from '@/src/types/translation';

import {
  FilesActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import { FilesSelectors, UISelectors } from '@/src/store/selectors';

import { MAX_VISIBLE_NOTIFICATION_ITEMS } from '@/src/constants/file';

import { UploadStatus } from '@epam/ai-dial-shared';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';

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

const getFileMetadataEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.getFileMetadata.type),
    switchMap(({ payload }) =>
      FileService.getFileMetadata(payload.fileId).pipe(
        map((metadata) => {
          if (!metadata) {
            return FilesActions.getFileMetadataFail();
          }
          return FilesActions.getFileMetadataSuccess({ metadata });
        }),
        catchError(() => of(FilesActions.getFileMetadataFail())),
      ),
    ),
  );

const getFullListingEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.getFullListing.type),
    switchMap(({ payload }) => {
      const folderPath = payload.folderPath || '';

      const metadata = state$.value.files.searchListingMetadata[folderPath];
      const cacheAge = metadata ? Date.now() - metadata.loadedAt : Infinity;
      const CACHE_TTL = 5 * 60 * 1000;

      if (metadata?.isFullyLoaded && cacheAge < CACHE_TTL) {
        return of(
          FilesActions.getFullListingSuccess({
            folderPath,
            files: [],
          }),
        );
      }

      return FileService.getFullListing(folderPath).pipe(
        map((files) =>
          FilesActions.getFullListingSuccess({
            folderPath,
            files,
          }),
        ),
        catchError(() => {
          return of(FilesActions.getFullListingFail());
        }),
      );
    }),
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

const setChosenFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.setChosenFolder.type),
    switchMap(({ payload }) => {
      const { folderId } = payload;
      const folders = FilesSelectors.selectFolders(state$.value);
      const selectedEmptyFolders = FilesSelectors.selectChosenEmptyFolderIds(
        state$.value,
      );
      const targetFolder = folders.find(
        ({ id }) =>
          addTrailingSlashIfAbsent(id) === addTrailingSlashIfAbsent(folderId),
      );

      if (
        targetFolder &&
        targetFolder.status !== UploadStatus.LOADED &&
        selectedEmptyFolders.includes(folderId)
      ) {
        return of(
          FilesActions.getFilesWithFolders({
            id: folderId.endsWith('/') ? folderId.slice(0, -1) : folderId,
          }),
        );
      }

      return EMPTY;
    }),
  );

const copyFilesEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.copyFiles.type),
    switchMap(({ payload }) => {
      const abortController = new AbortController();

      return concat(
        of(FilesActions.setCopyingFilesSignal(abortController)),
        FileService.copyFiles(payload, {
          signal: abortController.signal,
        }).pipe(
          switchMap((response) =>
            concat(
              of(
                FilesActions.copyFilesSuccess({
                  result: response,
                  request: payload,
                }),
              ),
              of(
                FilesActions.getFilesWithFolders({
                  id: payload.destinationFolder,
                }),
              ),
            ),
          ),
          catchError((error) => {
            if (error?.name === 'AbortError') {
              return EMPTY;
            }

            return of(
              FilesActions.copyFilesFail({
                files: payload.files,
                destinationFolder: payload.destinationFolder,
              }),
              UIActions.showErrorToast(
                translate('Failed to copy files. Please try again later.', {
                  ns: Translation.Files,
                }),
              ),
            );
          }),
          takeUntil(action$.pipe(ofType(FilesActions.cancelCopyingFiles.type))),
        ),
      );
    }),
  );

const moveFilesEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.moveFiles.type),
    switchMap(({ payload }) => {
      const abortController = new AbortController();

      return concat(
        of(FilesActions.setMovingFilesSignal(abortController)),
        FileService.moveFiles(payload, {
          signal: abortController.signal,
        }).pipe(
          switchMap((response) => {
            const actions: AppAction[] = [
              FilesActions.moveFilesSuccess({
                result: response,
                request: payload,
              }),
            ];

            if (payload.destinationFolder !== payload.sourceFolder) {
              actions.push(
                FilesActions.getFilesWithFolders({
                  id: payload.sourceFolder,
                }),
              );
            }

            actions.push(
              FilesActions.getFilesWithFolders({
                id: payload.destinationFolder,
              }),
            );

            return from(actions);
          }),
          catchError((error) => {
            if (error?.name === 'AbortError') {
              return EMPTY;
            }

            return of(
              FilesActions.moveFilesFail({
                files: payload.files,
              }),
              UIActions.showErrorToast(
                translate('Failed to move files. Please try again later.', {
                  ns: Translation.Files,
                }),
              ),
            );
          }),
          takeUntil(action$.pipe(ofType(FilesActions.cancelMovingFiles.type))),
        ),
      );
    }),
  );

const deleteFilesEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.deleteFiles.type),
    switchMap(({ payload }) => {
      return FileService.deleteFiles({ files: payload.files }).pipe(
        switchMap((response) => {
          return concat(
            of(
              FilesActions.deleteFilesSuccess({
                deletedItems: payload.files,
                result: response,
                request: payload,
              }),
            ),
            of(
              FilesActions.getFilesWithFolders({
                id: payload.folderUrl,
              }),
            ),
          );
        }),
        catchError(() => {
          return of(
            FilesActions.deleteFilesFail({
              files: payload.files,
            }),
            UIActions.showErrorToast(
              translate('Failed to delete files. Please try again later.', {
                ns: Translation.Files,
              }),
            ),
          );
        }),
      );
    }),
  );

const downloadFilesAsArchiveEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.downloadFilesAsArchive.type),
    switchMap(
      (action: ReturnType<typeof FilesActions.downloadFilesAsArchive>) => {
        const { files } = action.payload;

        if (files.length === 1 && files[0].nodeType === DialFileNodeType.ITEM) {
          const file = files[0];
          const filePath = file.path || file.id;
          if (!filePath) {
            return of(
              UIActions.showErrorToast(
                translate('Failed to download file. Please try again later.', {
                  ns: Translation.Files,
                }),
              ),
              FilesActions.downloadFilesAsArchiveFail(),
            );
          }
          triggerDownload(`/api/${ApiUtils.encodeApiUrl(filePath)}`, file.name);
          return of(FilesActions.downloadFilesAsArchiveSuccess());
        }

        return from(FileService.downloadFilesAsArchive(files)).pipe(
          map(() => FilesActions.downloadFilesAsArchiveSuccess()),
          catchError(() => {
            return of(
              UIActions.showErrorToast(
                translate('Failed to download files. Please try again later.', {
                  ns: Translation.Files,
                }),
              ),
              FilesActions.downloadFilesAsArchiveFail(),
            );
          }),
        );
      },
    ),
  );

const uploadFilesEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.uploadFiles.type),
    mergeMap(({ payload }) => {
      const urlParts = payload.destinationUrl.split('/');
      const bucket = urlParts.length > 1 ? urlParts[1] : undefined;
      const relativePath =
        urlParts.length > 2 ? urlParts.slice(2).join('/') : undefined;

      const controller = new AbortController();
      let canceled = false;

      const uploads$ = payload.files.map((file) => {
        const formData = new FormData();
        formData.append('attachment', file.fileContent, file.name);

        const fileId = constructPath(
          getFileRootId(bucket),
          relativePath,
          file.name,
        );

        return FileService.sendFile(
          formData,
          relativePath,
          file.name,
          undefined,
          bucket,
          { signal: controller.signal },
        ).pipe(
          filter(
            ({ percent, result }) =>
              typeof percent !== 'undefined' || typeof result !== 'undefined',
          ),
          map(({ percent, result }) => {
            if (result) {
              return FilesActions.uploadFileSuccess({
                apiResult: result,
                showSuccessMessage: false,
              });
            }

            return FilesActions.uploadFileTick({
              id: fileId,
              percent: percent!,
            });
          }),
          catchError(() =>
            canceled ? EMPTY : of(FilesActions.uploadFileFail({ id: fileId })),
          ),
        );
      });

      return merge(...uploads$).pipe(
        takeUntil(
          action$.pipe(
            ofType(FilesActions.cancelUploadFiles.type),
            tap(() => {
              canceled = true;
              controller.abort();
            }),
          ),
        ),
        scan(
          (acc, action) => {
            if (action.type === FilesActions.uploadFileSuccess.type) {
              acc.finished += 1;
              acc.successCount += 1;
            } else if (action.type === FilesActions.uploadFileFail.type) {
              acc.finished += 1;
              acc.failCount += 1;
            }

            acc.lastAction = action;
            return acc;
          },
          {
            finished: 0,
            total: payload.files.length,
            successCount: 0,
            failCount: 0,
            lastAction: null as any,
          },
        ),

        mergeMap(({ finished, total, successCount, lastAction }) => {
          const last$ = of(lastAction);

          if (canceled || finished !== total) {
            return last$;
          }

          const allFailed = successCount === 0;

          return concat(
            last$,

            allFailed
              ? of(
                  UIActions.showToast({
                    type: ToastType.Error,
                    title: translate('Upload failed'),
                    message: translate(
                      'Please check your internet connection and try again.',
                    ),
                  }),
                )
              : EMPTY,

            allFailed
              ? of(FilesActions.uploadFilesFail())
              : of(FilesActions.uploadFilesSuccess()),

            of(
              FilesActions.getFilesWithFolders({
                id: payload.destinationUrl,
              }),
            ),
          );
        }),
        catchError(() =>
          canceled ? EMPTY : of(FilesActions.uploadFilesFail()),
        ),
      );
    }),
  );

const uploadArchiveEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.uploadArchive.type),
    switchMap(({ payload }) => {
      return FileService.uploadArchive({
        file: payload.archive,
        destinationUrl: `${payload.destinationUrl}/${payload.name}`,
      }).pipe(
        switchMap(() =>
          of(
            FilesActions.uploadArchiveSuccess(),
            FilesActions.getFilesWithFolders({
              id: payload.destinationUrl,
            }),
          ),
        ),
        catchError(() =>
          of(
            UIActions.showErrorToast(
              translate('Failed to upload archive. Please try again later.', {
                ns: Translation.Files,
              }),
            ),
            FilesActions.uploadArchiveFail(),
          ),
        ),
      );
    }),
  );

const copyMoveFilesResultToastEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(
      FilesActions.copyFilesSuccess.type,
      FilesActions.moveFilesSuccess.type,
    ),
    map((action) => {
      const { result, request } = action.payload;

      const isRenaming = request.sourceFolder === request.destinationFolder;
      if (isRenaming) {
        return null;
      }

      const { errors } = result;
      const items = request.files;
      const isCopy = FilesActions.copyFilesSuccess.match(action);
      const verbPast = isCopy ? 'copied' : 'moved';

      if (items.length > 0) {
        const destinationUrl = action.payload.request.destinationFolder;
        const path = items[0].destinationUrl;
        const { name, bucket } = splitEntityId(path);
        const folderPlaceholder = destinationUrl.replace(
          `files/${bucket}`,
          getRootFolderPlaceholderName(bucket),
        );
        if (items.length === 1) {
          return UIActions.showToast({
            type: ToastType.Success,
            title: translate('Item {{verb}} successfully', {
              ns: Translation.Common,
              verb: verbPast,
            }),
            message: translate('“{{fileName}}” {{verb}} to {{folder}}', {
              ns: Translation.Files,
              fileName: name,
              folder: folderPlaceholder,
              verb: verbPast,
            }),
          });
        }

        return UIActions.showToast({
          type: ToastType.Success,
          title: translate('Items {{verb}} successfully', {
            ns: Translation.Common,
            verb: verbPast,
          }),
          message: translate('{{count}} items {{verb}} to {{folder}}', {
            ns: Translation.Files,
            count: items.length,
            folder: folderPlaceholder,
            verb: verbPast,
          }),
        });
      }

      if (errors && errors.length > 0) {
        const visibleErrors = errors.slice(0, MAX_VISIBLE_NOTIFICATION_ITEMS);
        const hiddenCount = errors.length - visibleErrors.length;

        const fileNames = visibleErrors
          .map((e) => splitEntityId(e.data.destinationUrl).name)
          .join(', ');

        const restText =
          hiddenCount > 0
            ? translate(' and {{count}} other items', {
                ns: Translation.Files,
                count: hiddenCount,
              })
            : '';

        return UIActions.showToast({
          type: ToastType.Error,
          title: translate('Items {{verb}} failed', {
            ns: Translation.Common,
            verb: isCopy ? 'copying' : 'moving',
          }),
          message: translate(
            '{{files}}{{rest}} were not {{verb}}. Please try again.',
            {
              ns: Translation.Files,
              files: fileNames,
              rest: restText,
              verb: verbPast,
            },
          ),
        });
      }

      return null;
    }),
    filter(Boolean),
  );

const deleteFilesResultToastEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.deleteFilesSuccess.type),
    map(({ payload }) => {
      const { result, request } = payload;
      const { errors } = result;
      const items = request.files;
      const verbPast = 'deleted';

      if (items.length > 0) {
        const destinationUrl = payload.request.folderUrl;
        const path = items[0].sourceUrl;
        const { name, bucket } = splitEntityId(path);
        const folderPlaceholder = destinationUrl.replace(
          `files/${bucket}`,
          getRootFolderPlaceholderName(bucket),
        );

        if (items.length === 1) {
          return UIActions.showToast({
            type: ToastType.Success,
            title: translate('Item {{verb}} successfully', {
              ns: Translation.Common,
              verb: verbPast,
            }),
            message: translate('“{{fileName}}” {{verb}} from {{folder}}', {
              ns: Translation.Files,
              fileName: name,
              folder: folderPlaceholder,
              verb: verbPast,
            }),
          });
        }

        return UIActions.showToast({
          type: ToastType.Success,
          title: translate('Items {{verb}} successfully', {
            ns: Translation.Common,
            verb: verbPast,
          }),
          message: translate('{{count}} items {{verb}} from {{folder}}', {
            ns: Translation.Files,
            count: items.length,
            folder: folderPlaceholder,
            verb: verbPast,
          }),
        });
      }

      if (errors && errors.length > 0) {
        const visibleErrors = errors.slice(0, MAX_VISIBLE_NOTIFICATION_ITEMS);
        const hiddenCount = errors.length - visibleErrors.length;

        const fileNames = visibleErrors
          .map((e) => splitEntityId(e.data).name)
          .join(', ');

        const restText =
          hiddenCount > 0
            ? translate(' and {{count}} other items', {
                ns: Translation.Files,
                count: hiddenCount,
              })
            : '';

        return UIActions.showToast({
          type: ToastType.Error,
          title: translate('Items deleting failed', {
            ns: Translation.Common,
          }),
          message: translate(
            '{{files}}{{rest}} were not {{verb}}. Please try again.',
            {
              ns: Translation.Files,
              files: fileNames,
              rest: restText,
              verb: verbPast,
            },
          ),
        });
      }

      return null;
    }),
    filter(Boolean),
  );

export const FilesEpics = combineEpics(
  initEpic,

  uploadFileEpic,
  uploadFilesSuccessEpic,
  getFileFoldersEpic,
  getFilesEpic,
  getFileMetadataEpic,
  getFullListingEpic,
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
  setChosenFolderEpic,
  copyFilesEpic,
  moveFilesEpic,
  deleteFilesEpic,
  downloadFilesAsArchiveEpic,
  uploadFilesEpic,
  uploadArchiveEpic,
  copyMoveFilesResultToastEpic,
  deleteFilesResultToastEpic,
);
