import { Conversation } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';

import { AttachmentToUpload } from '@/src/store/import-export/importExport.reducers';

import { constructPath, getNextFileName, triggerDownload } from './file';
import {
  currentDate,
  getDownloadFileName,
  prepareConversationsForExport,
} from './import-export';

import JSZip from 'jszip';
import { contentType } from 'mime-types';

interface GetZippedFile {
  files: DialFile[];
  conversations: Conversation[];
  folders: FolderInterface[];
}

const getAttachmentFromApi = async (file: DialFile) => {
  const path = encodeURI(constructPath(file.absolutePath, file.name));

  const fileResult = await fetch(`/api/${path}`);
  return fileResult.blob();
};

const splitFolderId = (folderId: string) => {
  const parts = folderId.split('/');
  const parentPath =
    parts.length > 2 ? constructPath(...parts.slice(2)) : undefined;

  return parentPath;
};

export const getRelativeParentPath = (folderId: string) => {
  const parentPath = splitFolderId(folderId);
  return parentPath;
};

export async function getZippedFile({
  files,
  conversations,
  folders,
}: GetZippedFile) {
  const zip = new JSZip();
  files.forEach((file) => {
    const fileBlob = getAttachmentFromApi(file);
    const relativeParentPath = getRelativeParentPath(file.folderId);
    const filePath = constructPath('res', relativeParentPath, file.name);

    zip.file(filePath, fileBlob);
  });

  const history = prepareConversationsForExport({ conversations, folders });
  const jsonHistory = JSON.stringify(history, null, 2);
  zip.file(`conversations/conversations_history.json`, jsonHistory);

  const content = await zip.generateAsync({ type: 'base64' });
  return content;
}

export const downloadExportZip = (content: string, fileName?: string) => {
  const downloadName = getDownloadFileName(fileName);
  triggerDownload(
    `data:application/zip;base64,${content}`,
    `${downloadName}_chat_with_attachments_${currentDate()}.dial`,
  );
};

export interface PreUnZipedHistory {
  zip: JSZip;
  history: JSZip.JSZipObject;
  res: { relativePath: string; zipEntry: JSZip.JSZipObject }[];
}
export async function importZippedHistory(zipFile: File) {
  const zip = await JSZip.loadAsync(zipFile);
  const chatsLib = {} as PreUnZipedHistory;
  chatsLib.res = [];
  const regExpConversationsFolder = /^conversations\/*/;
  const regExpConversationsHistory = /\.json$/i;
  const regExpResFolder = /^res\/*/;
  const regExpRes = /\..+$/;

  zip.forEach((relativePath, zipEntry) => {
    if (
      regExpConversationsFolder.test(relativePath) &&
      regExpConversationsHistory.test(relativePath) &&
      !zipEntry.dir
    ) {
      chatsLib.history = zipEntry;
    }

    if (
      regExpResFolder.test(relativePath) &&
      regExpRes.test(relativePath) &&
      !zipEntry.dir
    ) {
      chatsLib.res.push({ relativePath, zipEntry });
    }
  });
  chatsLib.zip = zip;
  return chatsLib;
}

const getFieldsFromZipName = (zipName: string) => {
  const parts = zipName.split('/');

  const fileName = parts[parts.length - 1];
  const fileId = constructPath(...parts.slice(1));
  const fileRelativePath = constructPath(...parts.slice(1, parts.length - 1));

  return {
    fileId,
    fileRelativePath,
    fileName,
  };
};

export const getUnZipAttachments = async ({
  attachments,
  preUnzipedHistory,
}: {
  attachments: Partial<DialFile>[];
  preUnzipedHistory: PreUnZipedHistory;
}) => {
  const getAllAttachments = attachments.map(async (attachment) => {
    const fileToUpload = preUnzipedHistory.res.find((file) => {
      const fileId = file.relativePath.replace(/^res\//, '');

      if (!attachment.folderId) {
        return false;
      }
      const attachmentId = constructPath(
        getRelativeParentPath(attachment.folderId),
        attachment.name,
      );

      return fileId === attachmentId;
    });

    if (!fileToUpload) {
      return;
    }

    const { zipEntry } = fileToUpload;
    const { zip } = preUnzipedHistory;
    const file = zip.file(zipEntry.name);

    if (!file) {
      return;
    }

    const { fileId, fileRelativePath, fileName } = getFieldsFromZipName(
      zipEntry.name,
    );

    const fileContentBlob = await file.async('blob');

    const fileContent = fileContentBlob.type.length
      ? fileContentBlob
      : new File([fileContentBlob], fileName, {
          type: contentType(fileName) || 'application/octet-stream',
        });

    if (!fileContent) {
      return;
    }

    const attachmentToUpload = {
      fileContent,
      id: fileId,
      relativePath: fileRelativePath,
      name: fileName,
    };
    return attachmentToUpload;
  });

  const attachmentsToUpload = await Promise.all(getAllAttachments);

  return attachmentsToUpload.filter(Boolean) as AttachmentToUpload[];
};

export const compressConversationInZip = async ({
  attachments,
  conversation,
  parentFolders,
}: {
  attachments: DialFile[];
  conversation: Conversation;
  parentFolders: FolderInterface[];
}) => {
  const content = await getZippedFile({
    files: attachments,
    conversations: [conversation],
    folders: parentFolders,
  });
  return content;
};

export const updateAttachmentsNames = ({
  filesFromFolder,
  attachmentsToPostfix,
}: {
  filesFromFolder: DialFile[];
  attachmentsToPostfix: DialFile[];
}) => {
  const existingFiles = filesFromFolder;

  const updatedAttachments = attachmentsToPostfix.map((attachment) => {
    if (
      existingFiles.length &&
      existingFiles.some(({ name }) => name === attachment.name)
    ) {
      const newName = getNextFileName(attachment.name, existingFiles, 0, true);

      const updatedAttachment = { ...attachment, name: newName };

      existingFiles.push(updatedAttachment);
      return updatedAttachment;
    }

    existingFiles.push(attachment);
    return attachment;
  });

  return updatedAttachments;
};
