import {
  EMPTY,
  catchError,
  concat,
  exhaustMap,
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
  take,
  takeUntil,
  tap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { addTrailingSlashIfAbsent } from '@/src/utils/app/common';
import { DataService } from '@/src/utils/app/data/data-service';
import { FileService } from '@/src/utils/app/data/file-service';
import {
  isResourcePathTooLongError,
  parseApiError,
} from '@/src/utils/app/epics-helpers/common.epic-helpers';
import { getCurrentReviewBucket } from '@/src/utils/app/epics-helpers/publications.epic-helpers';
import {
  constructPath,
  getDownloadPath,
  getFileWithType,
  getRootFolderPlaceholderName,
  triggerDownload,
} from '@/src/utils/app/file';
import {
  getFolderFromId,
  getFolderNestingLevel,
  getGeneratedFolderId,
  updateMovedEntityId,
} from '@/src/utils/app/folders';
import {
  getFileRootId,
  stripTrailingSlashForSelectedPath,
} from '@/src/utils/app/id';
import { applyUploadReplaceActions } from '@/src/utils/app/prepare-files-for-upload';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import {
  ensureLocaleNamespaceFromStaticFiles,
  translate,
} from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import { HTTPMethod } from '@/src/types/http';
import { AppAction, AppEpic } from '@/src/types/store';
import { ToastType } from '@/src/types/toasts';
import { Translation } from '@/src/types/translation';

import {
  FilesActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import {
  FilesSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { MAX_VISIBLE_NOTIFICATION_ITEMS } from '@/src/constants/file';
import { MAX_NESTED_FOLDERS } from '@/src/constants/folders';
import {
  ChatI18nKeys,
  CommonI18nKeys,
  FilesI18nKeys,
} from '@/src/constants/i18n';

import { UploadStatus } from '@epam/ai-dial-shared';
import { DialCopiedItem, DialFileNodeType } from '@epam/ai-dial-ui-kit';

const exceedsMaxNesting = (folderId: string) =>
  getFolderNestingLevel(folderId) > MAX_NESTED_FOLDERS;

const maxNestingErrorToast = () =>
  UIActions.showErrorToast({
    message: translate(ChatI18nKeys.NotAllowedMoreNestedFolders, {
      ns: Translation.Chat,
    }),
  });

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

const initFileSizeCacheEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.init.type),
    switchMap(() =>
      DataService.getFileSizeCache().pipe(
        map((cache) => FilesActions.initFileSizeCache(cache)),
      ),
    ),
  );

const syncFileSizeCacheEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.getFilesSuccess.type),
    switchMap(({ payload }) => {
      const resolvedIds = new Set(
        payload.files
          .filter((file) => file.contentLength)
          .map((file) => file.id),
      );

      if (!resolvedIds.size) return EMPTY;

      return DataService.getFileSizeCache().pipe(
        switchMap((cache) => {
          const updatedCache = Object.fromEntries(
            Object.entries(cache).filter(([id]) => !resolvedIds.has(id)),
          );
          return DataService.setFileSizeCache(updatedCache);
        }),
        ignoreElements(),
      );
    }),
  );

const uploadFileEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.uploadFile.type),
    mergeMap(({ payload }) => {
      const formData = new FormData();
      formData.append(
        'attachment',
        getFileWithType(payload.fileContent),
        payload.name,
      );

      return FileService.sendFile(
        formData,
        payload.relativePath,
        payload.name,
        payload.httpMethod,
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
        catchError((error) => {
          const { message, traceId } = parseApiError(error);
          return of(
            FilesActions.uploadFileFail({
              id: payload.id,
              errorMessage: message,
              traceId,
            }),
          );
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
          ...(file.isFromDeviceAttachment && {
            isFromDeviceAttachment: true,
          }),
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
        catchError((err) =>
          of(
            FilesActions.renameFolderFail({
              oldId: payload.folderId,
              newId: targetFolderId,
              ...parseApiError(err),
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
        UIActions.showErrorToast({
          traceId: payload?.traceId,
          message: translate(FilesI18nKeys.FailedToRename, {
            ns: Translation.Files,
            folderName: getFolderFromId(payload.oldId, FeatureType.File).name,
          }),
        }),
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
            catchError((err) =>
              of(FilesActions.getFilesFail(parseApiError(err))),
            ),
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
        catchError((err) =>
          of(FilesActions.getFileMetadataFail(parseApiError(err))),
        ),
      ),
    ),
  );

const getFullListingEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.getFullListing.type),
    switchMap(({ payload }) => {
      const folderPath = payload.folderPath || '';
      const paths = payload.paths;

      if (paths) {
        if (paths.length === 0) {
          return of(
            FilesActions.getFullListingSuccess({
              folderPath,
              files: [],
            }),
          );
        }

        return FileService.getMultipleFoldersFiles(paths, true).pipe(
          mergeMap((files) => {
            const actions: AppAction[] = [
              FilesActions.getFullListingSuccess({
                folderPath,
                files,
              }),
            ];
            if (payload.autoChoseFiles) {
              actions.push(
                FilesActions.addChosenFiles({
                  ids: files.map((file) => file.id),
                }),
              );
            }
            return from(actions);
          }),
          catchError((err) =>
            of(FilesActions.getFullListingFail(parseApiError(err))),
          ),
        );
      }

      const metadata = state$.value.files.searchListingMetadata[folderPath];
      const cacheAge = metadata ? Date.now() - metadata.loadedAt : Infinity;
      const CACHE_TTL = 5 * 60 * 1000;

      if (metadata?.isFullyLoaded && cacheAge < CACHE_TTL) {
        return of(
          FilesActions.getFullListingSuccess({
            folderPath,
            files: [],
            fromCache: true,
          }),
        );
      }

      return FileService.getFullListing(folderPath).pipe(
        mergeMap((files) => {
          const actions: AppAction[] = [
            FilesActions.getFullListingSuccess({
              folderPath,
              files,
            }),
          ];
          if (payload.autoChoseFiles) {
            actions.push(
              FilesActions.addChosenFiles({
                ids: files.map((file) => file.id),
              }),
            );
          }
          return from(actions);
        }),
        catchError((err) => {
          const { traceId } = parseApiError(err);
          return of(FilesActions.getFullListingFail({ traceId }));
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
        catchError((err) =>
          of(
            FilesActions.getFoldersFail({
              folderId: payload.id,
              ...parseApiError(err),
            }),
          ),
        ),
      ),
    ),
  );

const getFilesWithFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.getFilesWithFolders.type),
    exhaustMap(({ payload }) => {
      const trigger$ = from([
        FilesActions.getFolders(payload),
        FilesActions.getFiles(payload),
      ]);

      const wait$ = action$.pipe(
        ofType(
          FilesActions.getFoldersSuccess.type,
          FilesActions.getFoldersFail.type,
          FilesActions.getFilesSuccess.type,
          FilesActions.getFilesFail.type,
        ),
        take(2),
      );

      return concat(trigger$, wait$.pipe(ignoreElements()));
    }),
  );

const getFilesWithFoldersFailToastEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.getFoldersFail.type, FilesActions.getFilesFail.type),
    scan(
      (acc, { payload }) => {
        acc.count += 1;
        acc.traceId = payload?.traceId ?? acc.traceId;
        return acc;
      },
      { count: 0, traceId: undefined as string | undefined },
    ),
    filter(({ count }) => count === 2),
    take(1),
    map(({ traceId }) =>
      UIActions.showToast({
        type: ToastType.Error,
        title: translate(CommonI18nKeys.FailedToLoadFilesAndFolders, {
          ns: Translation.Common,
        }),
        message: translate(CommonI18nKeys.CheckInternetConnection, {
          ns: Translation.Common,
        }),
        traceId,
      }),
    ),
  );

const getFoldersListEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.getFoldersList.type),
    switchMap(({ payload }) => {
      const listPath = (path?: string) =>
        payload.withFiles
          ? [
              FilesActions.getFolders({ id: path }),
              FilesActions.getFiles({ id: path }),
            ]
          : [FilesActions.getFolders({ id: path })];

      return from((payload.paths ?? [undefined]).flatMap((p) => listPath(p)));
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
        catchError((err) => {
          return of(
            FilesActions.deleteFileFail({
              fileName: file.name,
              ...parseApiError(err),
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
        message: translate(FilesI18nKeys.FailedToDelete, {
          ns: Translation.Files,
          fileName: payload.fileName,
          traceId: payload?.traceId,
        }),
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
      const deleteActions = files
        .filter((file) => file.isFromDeviceAttachment)
        .map((file) => of(FilesActions.deleteFile({ fileId: file.id })));

      return concat(...deleteActions);
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

const addChosenFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.addChosenFolder.type),
    mergeMap(({ payload }) => {
      const { folderId } = payload;
      const folders = FilesSelectors.selectFolders(state$.value);
      const targetFolder = folders.find(
        ({ id }) =>
          addTrailingSlashIfAbsent(id) === addTrailingSlashIfAbsent(folderId),
      );

      if (!targetFolder) {
        return EMPTY;
      }

      if (targetFolder.status !== UploadStatus.LOADED) {
        const cleanId = stripTrailingSlashForSelectedPath(folderId);
        return of(
          FilesActions.getFullListing({
            folderPath: cleanId,
            autoChoseFiles: true,
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
              from([
                FilesActions.getFolders({ id: payload.destinationFolder }),
                FilesActions.getFiles({ id: payload.destinationFolder }),
              ]),
            ),
          ),
          catchError((error) => {
            if (error?.name === 'AbortError') {
              return EMPTY;
            }
            const { message, traceId } = parseApiError(error);
            // On full failure the core message is nested inside the serialized
            // "errors" array, so also inspect the raw error message.
            const isPathTooLong =
              isResourcePathTooLongError(message) ||
              isResourcePathTooLongError(error?.message);

            return of(
              FilesActions.copyFilesFail({
                files: payload.files,
                destinationFolder: payload.destinationFolder,
              }),
              UIActions.showErrorToast({
                message: isPathTooLong
                  ? translate(CommonI18nKeys.ResourcePathTooLong, {
                      ns: Translation.Common,
                    })
                  : translate(FilesI18nKeys.FailedToCopy, {
                      ns: Translation.Files,
                    }),
                traceId,
              }),
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
      const landsTooDeep = payload.files.some(
        (file: DialCopiedItem) =>
          file.nodeType === DialFileNodeType.FOLDER &&
          exceedsMaxNesting(file.destinationUrl),
      );

      if (landsTooDeep) {
        return of(FilesActions.moveFilesFail({ files: payload.files }));
      }

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
                FilesActions.getFolders({ id: payload.sourceFolder }),
                FilesActions.getFiles({ id: payload.sourceFolder }),
              );
            }

            actions.push(
              FilesActions.getFolders({ id: payload.destinationFolder }),
              FilesActions.getFiles({ id: payload.destinationFolder }),
            );

            return from(actions);
          }),
          catchError((error) => {
            if (error?.name === 'AbortError') {
              return EMPTY;
            }
            const { message, traceId } = parseApiError(error);
            // On full failure the core message is nested inside the serialized
            // "errors" array, so also inspect the raw error message.
            const isPathTooLong =
              isResourcePathTooLongError(message) ||
              isResourcePathTooLongError(error?.message);

            return of(
              FilesActions.moveFilesFail({
                files: payload.files,
              }),
              UIActions.showErrorToast({
                message: isPathTooLong
                  ? translate(CommonI18nKeys.ResourcePathTooLong, {
                      ns: Translation.Common,
                    })
                  : translate(FilesI18nKeys.FailedToMove, {
                      ns: Translation.Files,
                    }),
                traceId,
              }),
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
            from([
              FilesActions.getFolders({ id: payload.folderUrl }),
              FilesActions.getFiles({ id: payload.folderUrl }),
            ]),
          );
        }),
        catchError((err) => {
          const { traceId } = parseApiError(err);
          return of(
            FilesActions.deleteFilesFail({
              files: payload.files,
            }),
            UIActions.showErrorToast({
              message: translate(FilesI18nKeys.FailedToDeleteFiles, {
                ns: Translation.Files,
              }),
              traceId,
            }),
          );
        }),
      );
    }),
  );

const downloadFilesAsArchiveEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.downloadFilesAsArchive.type),
    switchMap(
      (action: ReturnType<typeof FilesActions.downloadFilesAsArchive>) => {
        const appName = SettingsSelectors.selectAppName(state$.value);
        const { files } = action.payload;

        if (files.length === 1 && files[0].nodeType === DialFileNodeType.ITEM) {
          const file = files[0];
          const filePath = file.path || file.id;
          if (!filePath) {
            return of(
              UIActions.showErrorToast({
                message: translate(FilesI18nKeys.FailedToDownload, {
                  ns: Translation.Files,
                }),
              }),
              FilesActions.downloadFilesAsArchiveFail(),
            );
          }
          triggerDownload(`/api/${ApiUtils.encodeApiUrl(filePath)}`, file.name);
          return of(FilesActions.downloadFilesAsArchiveSuccess());
        }

        return from(FileService.downloadFilesAsArchive(files, appName)).pipe(
          map(() => FilesActions.downloadFilesAsArchiveSuccess()),
          catchError((err) => {
            const { traceId } = parseApiError(err);
            return of(
              UIActions.showErrorToast({
                message: translate(FilesI18nKeys.FailedToDownload, {
                  ns: Translation.Files,
                }),
                traceId,
              }),
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
        formData.append(
          'attachment',
          getFileWithType(file.fileContent),
          file.name,
        );

        const fileId = constructPath(
          getFileRootId(bucket),
          relativePath,
          file.name,
        );

        return FileService.sendFile(
          formData,
          relativePath,
          file.name,
          HTTPMethod.PUT,
          bucket,
          { signal: controller.signal },
        ).pipe(
          filter(
            ({ percent, result }) =>
              typeof percent !== 'undefined' || typeof result !== 'undefined',
          ),
          map(({ percent, result }) => {
            if (result) {
              if (file.fileContent.size) {
                DataService.getFileSizeCache()
                  .pipe(
                    switchMap((cache) =>
                      DataService.setFileSizeCache({
                        ...cache,
                        [result.id]: file.fileContent.size,
                      }),
                    ),
                  )
                  .subscribe();
              }
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
          catchError((error) => {
            if (canceled) {
              return EMPTY;
            }
            const { message, traceId } = parseApiError(error);
            return of(
              FilesActions.uploadFileFail({
                id: fileId,
                errorMessage: message,
                traceId,
              }),
            );
          }),
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
              acc.traceId = (action.payload as { traceId?: string })?.traceId;

              if (
                isResourcePathTooLongError(
                  (action.payload as { errorMessage?: string })?.errorMessage,
                )
              ) {
                acc.pathTooLong = true;
              }
            }

            acc.lastAction = action;
            return acc;
          },
          {
            finished: 0,
            total: payload.files.length,
            successCount: 0,
            failCount: 0,
            pathTooLong: false,
            lastAction: null as any,
            traceId: undefined as string | undefined,
          },
        ),

        mergeMap(
          ({
            finished,
            total,
            successCount,
            pathTooLong,
            lastAction,
            traceId,
          }) => {
            const actions: AppAction[] = [lastAction];

            if (canceled || finished !== total) {
              return from(actions);
            }

            const allFailed = successCount === 0;

            if (allFailed) {
              actions.push(
                UIActions.showToast({
                  type: ToastType.Error,
                  title: translate(CommonI18nKeys.UploadFailed, {
                    ns: Translation.Common,
                  }),
                  message: pathTooLong
                    ? translate(CommonI18nKeys.ResourcePathTooLong, {
                        ns: Translation.Common,
                      })
                    : translate(CommonI18nKeys.CheckInternetConnection, {
                        ns: Translation.Common,
                      }),
                  traceId,
                }),
                FilesActions.uploadFilesFail(),
              );

              return from(actions);
            }

            actions.push(
              FilesActions.uploadFilesSuccess(),
              FilesActions.getFilesWithFolders({
                id: payload.destinationUrl,
              }),
            );

            return from(actions);
          },
        ),
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
      const destinationUrl = `${payload.destinationUrl}/${payload.name}`;

      if (exceedsMaxNesting(destinationUrl)) {
        return of(maxNestingErrorToast(), FilesActions.uploadArchiveFail());
      }

      return FileService.uploadArchive({
        file: payload.archive,
        destinationUrl,
      }).pipe(
        switchMap(() =>
          of(
            FilesActions.uploadArchiveSuccess(),
            FilesActions.getFilesWithFolders({
              id: destinationUrl,
            }),
          ),
        ),
        catchError((err) => {
          const { traceId } = parseApiError(err);
          return of(
            UIActions.showErrorToast({
              message: translate(FilesI18nKeys.FailedToUploadArchive, {
                ns: Translation.Files,
              }),
              traceId,
            }),
            FilesActions.uploadArchiveFail(),
          );
        }),
      );
    }),
  );

const copyMoveFilesResultToastEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(
      FilesActions.copyFilesSuccess.type,
      FilesActions.moveFilesSuccess.type,
    ),
    switchMap((action) => {
      const locale = router?.locale ?? 'en';

      return from(
        ensureLocaleNamespaceFromStaticFiles(locale, Translation.Files),
      ).pipe(
        map(() => {
          const { result, request } = action.payload;

          const isRenaming = request.sourceFolder === request.destinationFolder;
          if (isRenaming) {
            return null;
          }

          const { errors } = result;
          const items = request.files;
          const isCopy = FilesActions.copyFilesSuccess.match(action);
          const verbPast = translate(
            isCopy ? FilesI18nKeys.VerbCopied : FilesI18nKeys.VerbMoved,
            { ns: Translation.Files, lng: locale },
          );
          const verbGerund = translate(
            isCopy ? FilesI18nKeys.VerbCopying : FilesI18nKeys.VerbMoving,
            { ns: Translation.Files, lng: locale },
          );
          const reviewBucket = getCurrentReviewBucket(state$.value, router);

          if (items.length > 0) {
            const destinationUrl = action.payload.request.destinationFolder;
            const path = items[0].destinationUrl;
            const { name, bucket } = splitEntityId(path);
            const folderPlaceholder = destinationUrl.replace(
              `files/${bucket}`,
              bucket === reviewBucket
                ? translate(ChatI18nKeys.ReviewFiles, { ns: Translation.Chat })
                : getRootFolderPlaceholderName(bucket),
            );
            if (items.length === 1) {
              return UIActions.showToast({
                type: ToastType.Success,
                title: translate(CommonI18nKeys.ItemVerbSuccessfully, {
                  ns: Translation.Common,
                  verb: verbPast,
                }),
                message: translate(FilesI18nKeys.FileNameVerbToFolder, {
                  ns: Translation.Files,
                  fileName: name,
                  folder: folderPlaceholder,
                  verb: verbPast,
                }),
              });
            }

            return UIActions.showToast({
              type: ToastType.Success,
              title: translate(CommonI18nKeys.ItemVerbSuccessfully, {
                ns: Translation.Common,
                verb: verbPast,
              }),
              message: translate(FilesI18nKeys.ItemsVerbToFolder, {
                ns: Translation.Files,
                count: items.length,
                folder: folderPlaceholder,
                verb: verbPast,
              }),
            });
          }

          if (errors && errors.length > 0) {
            const visibleErrors = errors.slice(
              0,
              MAX_VISIBLE_NOTIFICATION_ITEMS,
            );
            const hiddenCount = errors.length - visibleErrors.length;

            const fileNames = visibleErrors
              .map((e) => splitEntityId(e.data.destinationUrl).name)
              .join(', ');

            const restText =
              hiddenCount > 0
                ? translate(FilesI18nKeys.AndOtherItems, {
                    ns: Translation.Files,
                    count: hiddenCount,
                  })
                : '';

            return UIActions.showToast({
              type: ToastType.Error,
              title: translate(CommonI18nKeys.ItemsDeletingFailed, {
                ns: Translation.Common,
                verb: verbGerund,
              }),
              message: translate(FilesI18nKeys.SomeItemsNotSomething, {
                ns: Translation.Files,
                files: fileNames,
                rest: restText,
                verb: verbPast,
              }),
            });
          }

          return null;
        }),
      );
    }),
    filter(Boolean),
  );

const deleteFilesResultToastEpic: AppEpic = (action$, state$, { router }) =>
  action$.pipe(
    ofType(FilesActions.deleteFilesSuccess.type),
    switchMap((action) => {
      const locale = router?.locale ?? 'en';

      return from(
        ensureLocaleNamespaceFromStaticFiles(locale, Translation.Files),
      ).pipe(
        map(() => {
          const { payload } = action;
          const { result, request } = payload;
          const { errors } = result;
          const items = request.files;
          const verbPast = translate(FilesI18nKeys.VerbDeleted, {
            ns: Translation.Files,
            lng: locale,
          });

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
                title: translate(CommonI18nKeys.ItemVerbSuccessfully, {
                  ns: Translation.Common,
                  verb: verbPast,
                  lng: locale,
                }),
                message: translate(FilesI18nKeys.FileNameVerbFromFolder, {
                  ns: Translation.Files,
                  fileName: name,
                  folder: folderPlaceholder,
                  verb: verbPast,
                  lng: locale,
                }),
              });
            }

            return UIActions.showToast({
              type: ToastType.Success,
              title: translate(CommonI18nKeys.ItemsVerbSuccessfully, {
                ns: Translation.Common,
                verb: verbPast,
                lng: locale,
              }),
              message: translate(FilesI18nKeys.ItemsVerbFromFolder, {
                ns: Translation.Files,
                count: items.length,
                folder: folderPlaceholder,
                verb: verbPast,
                lng: locale,
              }),
            });
          }

          if (errors && errors.length > 0) {
            const visibleErrors = errors.slice(
              0,
              MAX_VISIBLE_NOTIFICATION_ITEMS,
            );
            const hiddenCount = errors.length - visibleErrors.length;

            const fileNames = visibleErrors
              .map((e) => splitEntityId(e.data).name)
              .join(', ');

            const restText =
              hiddenCount > 0
                ? translate(FilesI18nKeys.AndOtherItems, {
                    ns: Translation.Files,
                    count: hiddenCount,
                    lng: locale,
                  })
                : '';

            return UIActions.showToast({
              type: ToastType.Error,
              title: translate(CommonI18nKeys.ItemsDeletingFailed, {
                ns: Translation.Common,
                lng: locale,
              }),
              message: translate(FilesI18nKeys.SomeItemsNotSomething, {
                ns: Translation.Files,
                files: fileNames,
                rest: restText,
                verb: verbPast,
                lng: locale,
              }),
            });
          }

          return null;
        }),
      );
    }),
    filter(Boolean),
  );

const createNewFolderEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(FilesActions.createNewFolder.type),
    mergeMap(({ payload }) => {
      if (exceedsMaxNesting(payload.destinationUrl)) {
        return of(maxNestingErrorToast());
      }

      return concat(
        of(
          FilesActions.uploadFiles({
            files: payload.files,
            destinationUrl: payload.destinationUrl,
          }),
        ),
        action$.pipe(
          ofType(FilesActions.uploadFilesSuccess.type),
          take(1),
          mergeMap(() => {
            const urlParts = payload.destinationUrl.split('/');
            const bucket = urlParts.length > 1 ? urlParts[1] : undefined;
            const parentFolderId =
              urlParts.length > 2
                ? urlParts.slice(0, -1).join('/')
                : getFileRootId(bucket);

            return of(
              FilesActions.getFolders({
                id: parentFolderId,
              }),
            );
          }),
        ),
      );
    }),
  );

const continueUploadReplaceDialogEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(FilesActions.continueUploadReplaceDialog.type),
    switchMap(({ payload }) => {
      const dialog = FilesSelectors.selectUploadReplaceDialog(state$.value);

      if (!dialog) {
        return EMPTY;
      }

      const existingFiles = FilesSelectors.selectFiles(state$.value);
      const resolvedFiles = applyUploadReplaceActions({
        duplicatedFiles: dialog.duplicatedFiles,
        nonDuplicatedFiles: dialog.nonDuplicatedFiles,
        mappedActions: payload.mappedActions,
        existingFiles,
        folderId: dialog.folderId,
        bucket: dialog.bucket,
      });

      const actions: AppAction[] = [
        FilesActions.clearUploadReplaceDialog(),
        ...resolvedFiles.map((file, index) =>
          FilesActions.uploadFile({
            fileContent: file.fileContent,
            id: file.id,
            relativePath: dialog.folderPath,
            name: file.name,
            ...(dialog.bucket && { bucket: dialog.bucket }),
            ...(file.httpMethod && { httpMethod: file.httpMethod }),
            ...(dialog.showSuccessMessage && {
              showSuccessMessage: index === resolvedFiles.length - 1,
            }),
            ...(dialog.isFromDeviceAttachment && {
              isFromDeviceAttachment: true,
            }),
          }),
        ),
      ];

      if (dialog.selectFileIds && resolvedFiles.length) {
        actions.push(
          FilesActions.selectFiles({
            ids: resolvedFiles.map(({ id }) => id),
          }),
        );
      }

      if (resolvedFiles.length) {
        actions.push(
          FilesActions.setResolvedUploadIds({
            ids: resolvedFiles.map(({ id }) => id),
          }),
        );
      }

      return from(actions);
    }),
  );

export const FilesEpics = combineEpics(
  initEpic,
  initFileSizeCacheEpic,
  syncFileSizeCacheEpic,

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
  getFilesWithFoldersFailToastEpic,
  deleteFileEpic,
  getFoldersListEpic,
  deleteMultipleFilesEpic,
  downloadFilesListEpic,
  deleteFileFailEpic,
  unselectFilesEpic,
  addChosenFolderEpic,
  copyFilesEpic,
  moveFilesEpic,
  deleteFilesEpic,
  downloadFilesAsArchiveEpic,
  createNewFolderEpic,
  uploadFilesEpic,
  uploadArchiveEpic,
  copyMoveFilesResultToastEpic,
  deleteFilesResultToastEpic,
  continueUploadReplaceDialogEpic,
);
