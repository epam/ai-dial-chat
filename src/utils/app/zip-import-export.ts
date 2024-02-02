import { Conversation } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';

import { AttachmentToUpload } from '@/src/store/import-export/importExport.reducers';

import { constructPath, triggerDownload } from './file';
import { prepareConversationsForExport } from './import-export';

import JSZip from 'jszip';

interface GetZippedFile {
  files: DialFile[];
  conversations: Conversation[];
  folders: FolderInterface[];
}
export async function getZippedFile({
  files,
  conversations,
  folders,
}: GetZippedFile) {
  const zip = new JSZip();
  const filesPromises = files.map(async (file) => {
    const fileResult = await fetch(
      `api/files/file/${constructPath(file.absolutePath, file.name)}`,
    );

    zip.file(`res/${file.id}`, fileResult.blob());
  });

  await Promise.all(filesPromises);
  const history = prepareConversationsForExport({ conversations, folders });
  const jsonHistory = JSON.stringify(history, null, 2);
  zip.file(`conversations/conversations_history.json`, jsonHistory);

  const content = await zip.generateAsync({ type: 'base64' });
  return content;
}

export const downloadExportZip = (content: string) => {
  triggerDownload('data:application/zip;base64,' + content, 'ai_dial_chat.zip');
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

  zip.forEach((relativePath, zipEntry) => {
    const regExpConversationsFolder = 'conversations/*';
    const regExpConversationsHistory = /\.json$/i;
    const regExpResFolder = 'res/*';
    const regExpRes = /^.+\..+$/;
    if (
      relativePath.match(regExpConversationsFolder) &&
      relativePath.match(regExpConversationsHistory)
    ) {
      chatsLib.history = zipEntry;
    }

    if (relativePath.match(regExpResFolder) && relativePath.match(regExpRes)) {
      chatsLib.res.push({ relativePath, zipEntry });
    }
  });
  chatsLib.zip = zip;

  return chatsLib;
}

export const getUnZipAttachments = async ({
  attachments,
  preUnzipedHistory,
}: {
  attachments: Partial<DialFile>[];
  preUnzipedHistory: PreUnZipedHistory;
}) => {
  const getAllAttachments = attachments.map(async (attachment) => {
    const fileToUpload = preUnzipedHistory.res.find(({ relativePath }) => {
      const firstSlashIndex = relativePath.indexOf('/');

      const fileId = relativePath.slice(firstSlashIndex + 1);
      return fileId === attachment.id;
    });

    if (!fileToUpload) {
      return;
    }

    const { relativePath, zipEntry } = fileToUpload;
    const { zip } = preUnzipedHistory;
    const fileContent = await zip.file(zipEntry.name)?.async('blob');

    if (!fileContent) {
      return;
    }

    const firstSlashIndex = relativePath.indexOf('/');
    const lastSlashIndex = zipEntry.name.lastIndexOf('/');

    const fileName = zipEntry.name.slice(lastSlashIndex + 1);
    const fileRelativePath = relativePath.slice(
      firstSlashIndex + 1,
      lastSlashIndex,
    );

    const attachmentToUpload = {
      fileContent,
      id: relativePath,
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
