import { Conversation } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';

import { AttachmentToUpload } from '@/src/store/import-export/importExport.reducers';

import { constructPath, triggerDownload } from './file';
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

  const fileResult = await fetch(`api/${path}`);
  return fileResult.blob();
};

export const getFolderPath = (folderId: string) =>
  folderId.replace(/^files\/[\w]+\//, '');

export async function getZippedFile({
  files,
  conversations,
  folders,
}: GetZippedFile) {
  const zip = new JSZip();
  files.forEach((file) => {
    const fileBlob = getAttachmentFromApi(file);
    const folderPath = getFolderPath(file.folderId);
    zip.file(`res/${folderPath}/${file.name}`, fileBlob);
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
    `${downloadName}_chat_with_attachments_${currentDate()}.zip`,
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
  const regExpConversationsFolder = 'conversations/*';
  const regExpConversationsHistory = /\.json$/i;
  const regExpResFolder = 'res/*';
  const regExpRes = /^.+\..+$/;

  zip.forEach((relativePath, zipEntry) => {
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

const searchSubstring = 'res/';
const substringLength = searchSubstring.length;

const getFirstSlashIndex = (relativePath: string) => {
  return relativePath.indexOf('res/');
};

export const getUnZipAttachments = async ({
  attachments,
  preUnzipedHistory,
}: {
  attachments: Partial<DialFile>[];
  preUnzipedHistory: PreUnZipedHistory;
}) => {
  const getAllAttachments = attachments.map(async (attachment) => {
    const fileToUpload = preUnzipedHistory.res.find(({ relativePath }) => {
      const fileId = relativePath.slice(
        getFirstSlashIndex(relativePath) + substringLength,
      );

      if (!attachment.folderId) {
        return false;
      }
      const attachmentId = `${getFolderPath(attachment.folderId)}/${attachment.name}`;

      return fileId === attachmentId;
    });

    if (!fileToUpload) {
      return;
    }

    const { relativePath, zipEntry } = fileToUpload;
    const { zip } = preUnzipedHistory;
    const file = zip.file(zipEntry.name);

    if (!file) {
      return;
    }

    const firstSlashIndex = getFirstSlashIndex(relativePath);
    const lastSlashIndex = zipEntry.name.lastIndexOf('/');

    const fileName = zipEntry.name.slice(lastSlashIndex + 1);
    const fileRelativePath = relativePath.slice(
      firstSlashIndex + substringLength,
      lastSlashIndex,
    );
    const fileId = relativePath.slice(firstSlashIndex + substringLength);
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
