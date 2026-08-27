import { createFilesApiClient } from '@epam/ai-dial-chat-hooks';
import { filesApi } from './api-client';
import { uploadFileWithProgress } from './upload-file-with-progress';

const filesApiClient = createFilesApiClient(filesApi, uploadFileWithProgress);

export const listPublicFiles = filesApiClient.listPublicFiles;
export const listSharedFiles = filesApiClient.listSharedFiles;
export const listFiles = filesApiClient.listFiles;
export const uploadFile = filesApiClient.uploadFile;
export const uploadArchive = filesApiClient.uploadArchive;
export const getFileMetadata = filesApiClient.getFileMetadata;
export const downloadFile = filesApiClient.downloadFile;
export const createFolder = filesApiClient.createFolder;
export const deleteFiles = filesApiClient.deleteFiles;
export const renameFiles = filesApiClient.renameFiles;
export const copyFiles = filesApiClient.copyFiles;
export const moveFiles = filesApiClient.moveFiles;
export const downloadArchive = filesApiClient.downloadArchive;
export const revokeAccess = filesApiClient.revokeAccess;
export const discardShared = filesApiClient.discardShared;
export const listSharedByMe = filesApiClient.listSharedByMe;
