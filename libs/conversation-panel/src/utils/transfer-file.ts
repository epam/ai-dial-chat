import { IconFile, IconFileZip, IconJson } from '@tabler/icons-react';

/* Every Tabler icon shares one component type; borrow it rather than restate it. */
type TransferFileIcon = typeof IconFile;

const ARCHIVE_EXTENSIONS = ['.dial', '.zip'];

/**
 * Returns the icon for a transfer row, chosen from the file name's extension:
 * the archive icon for `.dial`/`.zip`, the JSON icon for `.json`, and a
 * generic file icon for anything else.
 */
export const getTransferFileIcon = (fileName: string): TransferFileIcon => {
  const lowerName = fileName.toLowerCase();
  if (ARCHIVE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return IconFileZip;
  }
  if (lowerName.endsWith('.json')) {
    return IconJson;
  }
  return IconFile;
};
